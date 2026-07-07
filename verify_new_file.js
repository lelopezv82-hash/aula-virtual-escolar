const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

const ACCOUNT_ID = '52a17cc7-b4a4-4a5e-8c3f-70f78c5c39a3';
const NEW_FILE_ID = '1GzslwtZEG-e-dItXvDXfvlk9KKsMSDwz';

async function getToken() {
  const account = await prisma.googleDriveAccount.findUnique({ where: { id: ACCOUNT_ID } });
  let token = account.googleAccessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (account.googleRefreshToken && clientId && clientSecret) {
    const resToken = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: account.googleRefreshToken, grant_type: 'refresh_token',
      }),
    });
    if (resToken.ok) { const d = await resToken.json(); token = d.access_token; }
  }
  return token;
}

async function main() {
  const token = await getToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${NEW_FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) { console.error(`Download failed: ${res.status}`); return; }
  const buffer = Buffer.from(await res.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  console.log(`Sheet: "${wb.SheetNames[0]}", Total rows: ${rows.length}`);
  console.log('\nHeader row (row 2 = readable names):');
  console.log(rows[1]);
  console.log('\nMisael Jose row:');
  for (let i = 2; i < rows.length; i++) {
    if (rows[i][1] && String(rows[i][1]).includes('MISAEL')) {
      console.log(rows[i]);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
