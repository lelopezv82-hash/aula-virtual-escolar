const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

async function main() {
  const accountId = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
  const fileId = '1TNxpM1C6SSS9AEKN0OSYGaqK_bsutR05';

  // 1. Get token
  const account = await prisma.googleDriveAccount.findUnique({
    where: { id: accountId }
  });
  if (!account) throw new Error('Account not found');
  console.log('Account email:', account.email);

  let token = account.googleAccessToken;
  console.log('Checking token...');
  // Force a refresh request to ensure token is valid
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (account.googleRefreshToken && clientId && clientSecret) {
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
      console.log('Token refreshed successfully');
    } else {
      console.log('Token refresh failed, using stored token');
    }
  }

  // 2. Download file
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!fileRes.ok) {
    throw new Error(`Failed to download file: ${fileRes.status} ${fileRes.statusText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  
  // 3. Read sheet
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log('Sheets in file:', workbook.SheetNames);
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  console.log('Number of rows in sheet:', rows.length);
  console.log('First 12 rows:');
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
