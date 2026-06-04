const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function refreshGoogleToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured in environment variables.');
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
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  };
}

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
  console.log('Iniciando migración de cuentas de Google Drive...');

  const users = await prisma.user.findMany({
    where: {
      googleRefreshToken: {
        not: null,
      },
    },
  });

  console.log(`Se encontraron ${users.length} usuarios con Google Drive vinculado.`);

  for (const user of users) {
    console.log(`Procesando usuario: ${user.username} (${user.id})`);
    let email = 'cuenta-principal@gmail.com';
    let currentAccessToken = user.googleAccessToken;
    let currentExpiry = user.googleTokenExpiry || new Date(Date.now() + 3600 * 1000);

    try {
      // Intentar obtener el email con el access token actual
      if (currentAccessToken) {
        try {
          email = await fetchEmail(currentAccessToken);
          console.log(`  Email obtenido directamente: ${email}`);
        } catch (err) {
          console.log('  Token de acceso actual inválido/expirado, intentando refrescar...');
          if (user.googleRefreshToken) {
            const refreshRes = await refreshGoogleToken(user.googleRefreshToken);
            currentAccessToken = refreshRes.accessToken;
            currentExpiry = new Date(Date.now() + refreshRes.expiresIn * 1000);
            email = await fetchEmail(currentAccessToken);
            console.log(`  Email obtenido tras refrescar token: ${email}`);
          }
        }
      }
    } catch (error) {
      console.warn(`  No se pudo obtener el email del usuario ${user.username} (${error.message}). Usando fallback.`);
    }

    try {
      await prisma.googleDriveAccount.upsert({
        where: {
          userId_email: {
            userId: user.id,
            email: email,
          },
        },
        update: {
          googleAccessToken: currentAccessToken || '',
          googleRefreshToken: user.googleRefreshToken || '',
          googleTokenExpiry: currentExpiry,
          googleDriveFolderId: user.googleDriveFolderId,
        },
        create: {
          userId: user.id,
          email: email,
          googleAccessToken: currentAccessToken || '',
          googleRefreshToken: user.googleRefreshToken || '',
          googleTokenExpiry: currentExpiry,
          googleDriveFolderId: user.googleDriveFolderId,
        },
      });
      console.log(`  ✓ Conexión migrada exitosamente para ${user.username} con email ${email}`);
    } catch (dbError) {
      console.error(`  ✗ Error al migrar conexión en BD para ${user.username}:`, dbError);
    }
  }

  console.log('Migración finalizada.');
}

main()
  .catch((e) => {
    console.error('Error en el script de migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
