const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. REVISANDO TABLA PENDING DRIVE UPLOAD ===');
  try {
    const pending = await prisma.pendingDriveUpload.findMany();
    console.log('Pending uploads count:', pending.length);
    pending.forEach(p => {
      console.log(`- ID: ${p.id} | Filename: ${p.filename} | SupabaseUrl: ${p.supabaseUrl} | FolderPath: ${p.folderPath}`);
    });
  } catch (e) {
    console.log('PendingDriveUpload table:', e.message);
  }

  console.log('\n=== 2. REVISANDO CUENTAS DE GOOGLE DRIVE Y TOKENS ===');
  const accounts = await prisma.googleDriveAccount.findMany();
  console.log('Cuentas encontradas:', accounts.length);
  for (const acc of accounts) {
    console.log(`Email: ${acc.email} | TeacherID: ${acc.teacherId} | RefreshToken: ${!!acc.refreshToken} | RootFolderId: ${acc.rootFolderId}`);
  }

  const usersWithDrive = await prisma.user.findMany({
    where: {
      OR: [
        { googleRefreshToken: { not: null } },
        { googleAccessToken: { not: null } }
      ]
    },
    select: { id: true, name: true, googleRefreshToken: true, googleDriveFolderId: true }
  });
  console.log('\nUsuarios con Google Drive:', usersWithDrive.map(u => ({ id: u.id, name: u.name, hasRefresh: !!u.googleRefreshToken })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
