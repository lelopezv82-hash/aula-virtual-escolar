import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { getGoogleAccessToken, getGoogleAccessTokenForAccount } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-educational-key-2026'
);

function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function extractDriveFileId(url: string): string | null {
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

/**
 * GET /api/recursos/[id]/view
 * 
 * Proxy endpoint: fetches the resource file from Google Drive (using the
 * teacher's stored OAuth token) and streams it to the student. This way
 * students never need to authenticate with Google themselves.
 * 
 * For non-Drive URLs (Supabase, external links) it redirects directly.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resourceId } = await params;

    // Auth: any logged-in user (student or teacher)
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    await jwtVerify(token, JWT_SECRET);

    // Load resource + teacher info
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        course: { select: { teacherId: true } },
      },
    });

    if (!resource) {
      return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 });
    }

    const url = resource.url;

    // --- Non-Drive URL: redirect directly ---
    if (!isGoogleDriveUrl(url)) {
      return NextResponse.redirect(url);
    }

    // --- Google Drive URL: proxy through our server ---
    const fileId = extractDriveFileId(url);
    if (!fileId) {
      // Couldn't parse the file ID — fall back to redirect
      return NextResponse.redirect(url);
    }

    const teacherId = resource.course.teacherId;
    let accessToken: string | null = null;
    if (teacherId) {
      accessToken = await getGoogleAccessToken(teacherId);
    }
    if (!accessToken && resource.gdriveEmail) {
      const gAcc = await prisma.googleDriveAccount.findFirst({
        where: { email: resource.gdriveEmail },
      });
      if (gAcc) {
        accessToken = await getGoogleAccessTokenForAccount(gAcc.id);
      }
    }
    if (!accessToken) {
      const anyAcc = await prisma.googleDriveAccount.findFirst();
      if (anyAcc) {
        accessToken = await getGoogleAccessTokenForAccount(anyAcc.id);
      }
    }

    if (!accessToken) {
      // No Drive token available — redirect to original URL as fallback
      return NextResponse.redirect(url);
    }

    // Fetch metadata to get mimeType and name
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,mimeType,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!metaRes.ok) {
      // Metadata fetch failed — redirect as fallback
      console.warn(`Drive metadata failed for resource ${resourceId}:`, await metaRes.text());
      return NextResponse.redirect(url);
    }

    const meta = await metaRes.json();
    const mimeType: string = meta.mimeType || 'application/octet-stream';
    const originalName: string = meta.name || resource.title || 'archivo';
    const isNativeSheet = mimeType === 'application/vnd.google-apps.spreadsheet';
    const isNativeDoc = mimeType === 'application/vnd.google-apps.document';
    const isNativePres = mimeType === 'application/vnd.google-apps.presentation';

    let downloadUrl: string;
    let serveMimeType: string = mimeType;

    if (isNativeSheet) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (isNativeDoc) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.wordprocessingml.document`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (isNativePres) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.presentationml.presentation`;
      serveMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileRes.ok) {
      console.warn(`Drive download failed for resource ${resourceId}:`, await fileRes.text());
      return NextResponse.redirect(url);
    }

    // Decide content-disposition: inline for PDFs and images, attachment for others
    const isInline =
      serveMimeType.startsWith('image/') || serveMimeType === 'application/pdf';
    const disposition = isInline
      ? `inline; filename="${originalName}"`
      : `attachment; filename="${originalName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;

    const body = await fileRes.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': serveMimeType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Error en proxy de recurso:', error);
    return NextResponse.json({ error: 'Error interno al abrir el recurso' }, { status: 500 });
  }
}
