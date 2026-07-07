const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listFilesForAccount(account) {
  console.log(`\nListing files for account: ${account.email}`);
  let token = account.googleAccessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (account.googleRefreshToken && clientId && clientSecret) {
    try {
      const resToken = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.googleRefreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (resToken.ok) {
        const data = await resToken.json();
        token = data.access_token;
        console.log('Token refreshed.');
      }
    } catch (e) {
      console.error('Failed refreshing token:', e.message);
    }
  }

  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet%27%20or%20mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27&fields=files(id,name,mimeType,modifiedTime,webViewLink)', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error(`API request failed: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    const files = data.files || [];
    console.log(`Found ${files.length} spreadsheet files:`);
    files.forEach(f => {
      console.log(`- Name: "${f.name}"\n  ID: ${f.id}\n  Modified: ${f.modifiedTime}\n  Link: ${f.webViewLink}`);
    });
  } catch (e) {
    console.error('Error querying files:', e.message);
  }
}

async function main() {
  const accounts = await prisma.googleDriveAccount.findMany();
  for (const acc of accounts) {
    await listFilesForAccount(acc);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
