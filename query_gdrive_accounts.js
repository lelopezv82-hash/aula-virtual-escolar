const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccount(account) {
  console.log(`Checking account: ${account.email} (${account.id})`);
  console.log(`- Token Expiry: ${account.googleTokenExpiry}`);
  console.log(`- Access Token: ${account.googleAccessToken ? 'exists' : 'null'}`);
  console.log(`- Refresh Token: ${account.googleRefreshToken ? 'exists' : 'null'}`);
  console.log(`- Folder ID: ${account.googleDriveFolderId}`);

  try {
    // 1. Try querying about
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=*', {
      headers: { Authorization: `Bearer ${account.googleAccessToken}` },
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('- Access token check: VALID');
      const fs = require('fs');
      fs.writeFileSync('about_response.json', JSON.stringify(data, null, 2));
      console.log('- Saved full response to about_response.json');
    } else {
      console.log(`- Access token check: INVALID (Status ${res.status}: ${res.statusText})`);
      
      // 2. Try refreshing
      console.log('- Attempting refresh...');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.googleRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        console.log('  - Refresh: SUCCESS');
        console.log(`  - New Access Token: ${refreshData.access_token}`);
        
        // Test new token
        const res2 = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
          headers: { Authorization: `Bearer ${refreshData.access_token}` },
        });
        if (res2.ok) {
          const data2 = await res2.json();
          console.log('  - Quota with new token:', JSON.stringify(data2.storageQuota));
        } else {
          console.log(`  - Quota request failed with new token: ${res2.statusText}`);
        }
      } else {
        const refreshErr = await refreshRes.text();
        console.log(`  - Refresh: FAILED (${refreshErr})`);
      }
    }
  } catch (err) {
    console.error('Error during API check:', err);
  }
}

async function main() {
  const accounts = await prisma.googleDriveAccount.findMany();
  console.log(`Found ${accounts.length} Google Drive accounts in DB:`);
  for (const account of accounts) {
    await checkAccount(account);
    console.log('-------------------------------------------');
  }
  await prisma.$disconnect();
}

main().catch(console.error);
