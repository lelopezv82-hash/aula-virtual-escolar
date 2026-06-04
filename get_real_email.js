const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`UserInfo request failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.email;
}

async function main() {
  const account = await prisma.googleDriveAccount.findFirst({
    where: { email: 'cuenta-principal@gmail.com' }
  });

  if (!account) {
    console.log('No principal account found.');
    return;
  }

  try {
    const email = await fetchEmail(account.googleAccessToken);
    console.log(`Real email found: ${email}`);

    // Update the record with the real email
    await prisma.googleDriveAccount.update({
      where: { id: account.id },
      data: { email: email }
    });
    console.log('Database updated successfully.');
  } catch (err) {
    console.error('Error fetching real email:', err);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
