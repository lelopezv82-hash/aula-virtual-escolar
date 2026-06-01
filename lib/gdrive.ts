import prisma from './prisma';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Refreshes the Google Access Token for a teacher using their refresh token.
 */
async function refreshGoogleToken(teacherId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured in environment variables.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Failed to refresh Google token:', errText);
    throw new Error(`Google token refresh failed: ${res.statusText}`);
  }

  const data: GoogleTokenResponse = await res.json();
  const expiryDate = new Date(Date.now() + data.expires_in * 1000);

  // Update DB
  await prisma.user.update({
    where: { id: teacherId },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiry: expiryDate,
    },
  });

  return data.access_token;
}

/**
 * Gets a valid Google access token for the teacher. Refreshes if expired.
 */
export async function getGoogleAccessToken(teacherId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user || !user.googleRefreshToken) {
    return null; // Not connected to Google Drive
  }

  // If we have an access token and it is still valid (with 5 mins buffer)
  if (user.googleAccessToken && user.googleTokenExpiry) {
    const isExpired = new Date(user.googleTokenExpiry).getTime() - 5 * 60 * 1000 < Date.now();
    if (!isExpired) {
      return user.googleAccessToken;
    }
  }

  // Otherwise, refresh it
  try {
    return await refreshGoogleToken(teacherId, user.googleRefreshToken);
  } catch (error) {
    console.error(`Error refreshing token for teacher ${teacherId}:`, error);
    return null;
  }
}

/**
 * Creates a folder in Google Drive.
 */
async function createDriveFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Google Drive folder "${folderName}": ${errText}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Uploads a file buffer directly to Google Drive under the teacher's configured folder.
 */
export async function uploadToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  teacherId: string,
  subfolderName?: string
): Promise<string> {
  const accessToken = await getGoogleAccessToken(teacherId);
  if (!accessToken) {
    throw new Error('El docente no tiene Google Drive vinculado o no se pudo renovar la credencial.');
  }

  // Get or create parent folder ID for the app
  let mainFolderId = '';
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { googleDriveFolderId: true },
  });

  if (teacher?.googleDriveFolderId) {
    mainFolderId = teacher.googleDriveFolderId;
  } else {
    // Create new main folder
    mainFolderId = await createDriveFolder(accessToken, 'Aula Virtual Escolar');
    await prisma.user.update({
      where: { id: teacherId },
      data: { googleDriveFolderId: mainFolderId },
    });
  }

  let uploadFolderId = mainFolderId;

  // If a subfolder name (like "Recursos" or "Entregas") is requested, we can create or find it
  if (subfolderName) {
    const parts = subfolderName.split('/').filter(Boolean);
    let currentParentId = mainFolderId;

    for (const part of parts) {
      // Find or create "part" inside "currentParentId"
      const escapedPart = part.replace(/'/g, "\\'");
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${escapedPart}' and '${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          currentParentId = searchData.files[0].id;
        } else {
          currentParentId = await createDriveFolder(accessToken, part, currentParentId);
        }
      } else {
        currentParentId = await createDriveFolder(accessToken, part, currentParentId);
      }
    }
    uploadFolderId = currentParentId;
  }

  // Upload file via multipart/related
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: mimeType || 'application/octet-stream',
    parents: [uploadFolderId],
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + (mimeType || 'application/octet-stream') + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    buffer.toString('base64') +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartRequestBody.length.toString(),
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload file to Google Drive: ${errText}`);
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;

  // Set permissions: Anyone with link can view (reader)
  const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  if (!permRes.ok) {
    const errText = await permRes.text();
    console.warn(`Could not set permissions for file ${fileId} to public: ${errText}`);
  }

  // Get webViewLink
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    throw new Error(`Failed to fetch Google Drive file metadata for link: ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  return metaData.webViewLink;
}
