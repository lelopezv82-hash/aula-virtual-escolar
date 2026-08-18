import prisma from './prisma';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface AccountSpace {
  id: string;
  email: string;
  accessToken: string;
  googleDriveFolderId: string | null;
  freeSpace: number; // in bytes
  usage: number; // in bytes
  limit: number; // in bytes
  customLimit?: number | null;
}

/**
 * Refreshes the Google Access Token for a specific linked account.
 */
async function refreshGoogleToken(accountId: string, refreshToken: string): Promise<string> {
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
  await prisma.googleDriveAccount.update({
    where: { id: accountId },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiry: expiryDate,
    },
  });

  return data.access_token;
}

/**
 * Gets a valid Google access token. Looks at all connected accounts for the teacher
 * and returns the first one that is valid or can be successfully refreshed.
 */
export async function getGoogleAccessToken(teacherId: string): Promise<string | null> {
  const accounts = await prisma.googleDriveAccount.findMany({
    where: { userId: teacherId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (accounts.length === 0) {
    return null; // Not connected to any Google Drive
  }

  for (const account of accounts) {
    // If we have an access token and it is still valid (with 5 mins buffer)
    if (account.googleAccessToken && account.googleTokenExpiry) {
      const isExpired = new Date(account.googleTokenExpiry).getTime() - 5 * 60 * 1000 < Date.now();
      if (!isExpired) {
        return account.googleAccessToken;
      }
    }

    // Otherwise, refresh it
    if (account.googleRefreshToken) {
      try {
        return await refreshGoogleToken(account.id, account.googleRefreshToken);
      } catch (error) {
        console.error(`Error refreshing token for account ${account.id} of teacher ${teacherId}:`, error);
      }
    }
  }

  return null;
}

/**
 * Gets a valid Google access token for a specific account.
 */
export async function getGoogleAccessTokenForAccount(accountId: string): Promise<string | null> {
  const account = await prisma.googleDriveAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!account) return null;

  if (account.googleAccessToken && account.googleTokenExpiry) {
    const isExpired = new Date(account.googleTokenExpiry).getTime() - 5 * 60 * 1000 < Date.now();
    if (!isExpired) {
      return account.googleAccessToken;
    }
  }

  if (account.googleRefreshToken) {
    try {
      return await refreshGoogleToken(account.id, account.googleRefreshToken);
    } catch (error) {
      console.error(`Error refreshing token for account ${account.id}:`, error);
    }
  }

  return null;
}

/**
 * Fetches all Google Drive accounts for a teacher with their current storage spaces.
 */
export async function getAccountsWithSpace(teacherId: string): Promise<AccountSpace[]> {
  const accounts = await prisma.googleDriveAccount.findMany({
    where: { userId: teacherId },
  });

  if (accounts.length === 0) {
    return [];
  }

  const results: AccountSpace[] = [];

  // Query quotas in parallel
  await Promise.all(
    accounts.map(async (account) => {
      try {
        let token = account.googleAccessToken;
        const isExpired = account.googleTokenExpiry && new Date(account.googleTokenExpiry).getTime() - 5 * 60 * 1000 < Date.now();
        
        if (isExpired && account.googleRefreshToken) {
          token = await refreshGoogleToken(account.id, account.googleRefreshToken);
        }

        const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch storage quota: ${res.statusText}`);
        }

        const data = await res.json();
        const storageQuota = data.storageQuota || {};
        const apiLimitStr = storageQuota.limit;
        
        // Google Workspace Education/Enterprise with pooled or unlimited storage often omit the limit field.
        // If missing, we assume 100 TB to allow uploads and display properly.
        const isUnlimited = !apiLimitStr;
        const apiLimit = isUnlimited ? 109951162777600 : parseInt(apiLimitStr, 10);
        const limit = account.customLimit ? Number(account.customLimit) : apiLimit;
        
        // Google Workspace pooled storage reports total domain usage in storageQuota.usage.
        // We use usageInDrive + usageInDriveTrash to get the individual user's file usage in their Drive.
        const usageInDrive = parseInt(storageQuota.usageInDrive || '0', 10);
        const usageInTrash = parseInt(storageQuota.usageInDriveTrash || '0', 10);
        const userUsage = usageInDrive + usageInTrash;

        const apiUsage = parseInt(storageQuota.usage || '0', 10);
        
        // Personal gmail.com accounts should show their total account usage (Drive + Gmail + Photos).
        // Workspace pooled storage accounts should show userUsage (Drive files only) to avoid domain total leak.
        const isWorkspace = !account.email.endsWith('@gmail.com') && (account.customLimit || apiLimit > 1099511627776 || isUnlimited);
        const usage = isWorkspace ? userUsage : apiUsage;
        const freeSpace = limit - usage;

        results.push({
          id: account.id,
          email: account.email,
          accessToken: token,
          googleDriveFolderId: account.googleDriveFolderId,
          freeSpace,
          usage,
          limit,
          customLimit: account.customLimit ? Number(account.customLimit) : null
        });
      } catch (err) {
        console.error(`Error querying space for account ${account.email}:`, err);
        // If query fails but we have a token, we list it with 0 free space as a fallback
        results.push({
          id: account.id,
          email: account.email,
          accessToken: account.googleAccessToken,
          googleDriveFolderId: account.googleDriveFolderId,
          freeSpace: 0,
          usage: 0,
          limit: 0,
        });
      }
    })
  );

  return results;
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
 * Uploads a file buffer directly to Google Drive.
 * Selects the connected account with the most free space.
 */
export async function uploadToGoogleDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  teacherId: string,
  subfolderName?: string
): Promise<{ id: string; url: string; email: string }> {
  const accounts = await getAccountsWithSpace(teacherId);
  if (accounts.length === 0) {
    throw new Error('El docente no tiene cuentas de Google Drive vinculadas o no se pudo renovar la credencial.');
  }

  // Sort by free space descending
  accounts.sort((a, b) => b.freeSpace - a.freeSpace);

  // Use the one with the most free space
  const selectedAccount = accounts[0];
  const accessToken = selectedAccount.accessToken;

  // Get or create parent folder ID for the app on this specific account
  let mainFolderId = '';
  if (selectedAccount.googleDriveFolderId) {
    mainFolderId = selectedAccount.googleDriveFolderId;
  } else {
    // Create new main folder
    mainFolderId = await createDriveFolder(accessToken, 'Aula Virtual Escolar');
    await prisma.googleDriveAccount.update({
      where: { id: selectedAccount.id },
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

  // Check if a file with the same name already exists in this folder (and is not trashed)
  let existingFileId: string | null = null;
  let existingWebViewLink: string | null = null;
  
  try {
    const escapedFilename = filename.replace(/'/g, "\\'");
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${escapedFilename}' and '${uploadFolderId}' in parents and trashed=false&fields=files(id,webViewLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
        existingWebViewLink = searchData.files[0].webViewLink;
      }
    }
  } catch (err) {
    console.error('Error checking duplicate in uploadToGoogleDrive:', err);
  }

  if (existingFileId) {
    // File exists — update it in-place
    await updateDriveFile(accessToken, existingFileId, buffer, mimeType);
    return { id: existingFileId, url: existingWebViewLink || '', email: selectedAccount.email };
  }

  // Upload new file via multipart/related
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: mimeType || 'application/octet-stream',
    parents: [uploadFolderId],
  };

  const part1 = Buffer.from(
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + (mimeType || 'application/octet-stream') + '\r\n\r\n'
  );
  const part2 = buffer;
  const part3 = Buffer.from(closeDelimiter);

  const multipartRequestBody = Buffer.concat([part1, part2, part3]);

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
  return { id: fileId, url: metaData.webViewLink, email: selectedAccount.email };
}

/**
 * Resolves a Google Drive subfolder path recursively.
 * Returns the final folder ID.
 */
export async function resolveDriveFolderPath(
  accessToken: string,
  teacherId: string,
  subfolderPath: string
): Promise<string> {
  const accounts = await getAccountsWithSpace(teacherId);
  if (accounts.length === 0) {
    throw new Error('El docente no tiene cuentas de Google Drive vinculadas.');
  }
  
  accounts.sort((a, b) => b.freeSpace - a.freeSpace);
  const selectedAccount = accounts[0];
  // Always use the token that belongs to the selected account
  const token = selectedAccount.accessToken || accessToken;

  let mainFolderId = '';
  if (selectedAccount.googleDriveFolderId) {
    // Verify the stored folder still exists in Drive before trusting it
    const checkRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${selectedAccount.googleDriveFolderId}?fields=id`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (checkRes.ok) {
      mainFolderId = selectedAccount.googleDriveFolderId;
    } else {
      // Stored folder is gone — create a new root folder
      mainFolderId = await createDriveFolder(token, 'Aula Virtual Escolar');
      await prisma.googleDriveAccount.update({
        where: { id: selectedAccount.id },
        data: { googleDriveFolderId: mainFolderId },
      });
    }
  } else {
    mainFolderId = await createDriveFolder(token, 'Aula Virtual Escolar');
    await prisma.googleDriveAccount.update({
      where: { id: selectedAccount.id },
      data: { googleDriveFolderId: mainFolderId },
    });
  }

  let currentParentId = mainFolderId;
  if (subfolderPath) {
    const parts = subfolderPath.split('/').filter(Boolean);
    for (const part of parts) {
      const escapedPart = part.replace(/'/g, "\\'");
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${escapedPart}' and '${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          currentParentId = searchData.files[0].id;
        } else {
          currentParentId = await createDriveFolder(token, part, currentParentId);
        }
      } else {
        currentParentId = await createDriveFolder(token, part, currentParentId);
      }
    }
  }

  return currentParentId;
}


/**
 * Searches for a file by name inside a specific folder.
 */
export async function findFileInFolder(
  accessToken: string,
  folderId: string,
  filename: string
): Promise<{ id: string; name: string; webViewLink?: string } | null> {
  const query = `name='${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.error(`findFileInFolder failed: ${errText}`);
    return null;
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

/**
 * Downloads a file's content as a Buffer.
 * Handles both regular binary files (.xlsx) and native Google Sheets
 * (application/vnd.google-apps.spreadsheet) by using the export endpoint.
 */
export async function downloadDriveFile(accessToken: string, fileId: string): Promise<Buffer> {
  // First fetch the file metadata to check its MIME type
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Failed to fetch metadata for Drive file (ID: ${fileId}): ${errText}`);
  }

  const meta = await metaRes.json();
  const isNativeSheet = meta.mimeType === 'application/vnd.google-apps.spreadsheet';

  // Native Google Sheets must be exported as xlsx
  const downloadUrl = isNativeSheet
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to download file from Google Drive (ID: ${fileId}, native=${isNativeSheet}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Updates an existing file's binary content in-place.
 */
export async function updateDriveFile(
  accessToken: string,
  fileId: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': mimeType,
      'Content-Length': buffer.length.toString()
    },
    body: buffer as any
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update file in Google Drive (ID: ${fileId}): ${errText}`);
  }
}
