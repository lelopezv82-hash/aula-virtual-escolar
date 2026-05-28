import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Represents teacher ID passed during redirect
    const error = searchParams.get('error');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error) {
      console.error('Google OAuth callback error:', error);
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=google_auth_failed`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=invalid_callback`);
    }

    // Authenticate the current session to ensure it matches the state
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=not_authorized`);
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.id !== state || payload.role !== 'TEACHER') {
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=session_mismatch`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=missing_credentials`);
    }

    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Error exchanging Google OAuth code:', errText);
      return NextResponse.redirect(`${appUrl}/docente/configuracion?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const expiryDate = new Date(Date.now() + tokenData.expires_in * 1000);

    // Save credentials to database
    await prisma.user.update({
      where: { id: state },
      data: {
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token || undefined, // refresh token is only sent on first prompt or when prompt=consent is used
        googleTokenExpiry: expiryDate,
      },
    });

    return NextResponse.redirect(`${appUrl}/docente/configuracion?success=google_connected`);
  } catch (error) {
    console.error('Google OAuth Callback error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/docente/configuracion?error=server_error`);
  }
}
