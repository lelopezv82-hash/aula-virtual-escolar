const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL || 'https://clseykxgfuilqnzukogj.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_23_FJkr5Iv3cDj0IvXQb7Q_Ztvai_la';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== LISTANDO ARCHIVOS EN SUPABASE STORAGE (BUCKET: aula-virtual) ===');
  
  // List root folders
  const { data: rootFiles, error: rootErr } = await supabase.storage.from('aula-virtual').list('', { limit: 100 });
  if (rootErr) console.error('Error root:', rootErr);
  console.log('Carpetas/Archivos en root:', rootFiles?.map(f => f.name));

  // Let's inspect subfolders if any (submissions, tareas, etc.)
  if (rootFiles) {
    for (const item of rootFiles) {
      if (!item.id) { // it's a folder
        const { data: subFiles } = await supabase.storage.from('aula-virtual').list(item.name, { limit: 100 });
        console.log(`\nArchivos en carpeta "${item.name}": (${subFiles?.length || 0})`);
        subFiles?.forEach(f => {
          console.log(`- ${item.name}/${f.name} (creado: ${f.created_at || f.updated_at}, tamaño: ${f.metadata?.size})`);
        });
      }
    }
  }

  // Also check Google Drive files
  console.log('\n=== REVISANDO CUENTAS DE GOOGLE DRIVE ===');
  const gdrive = await prisma.googleDriveAccount.findMany();
  console.log('GDrive Accounts count:', gdrive.length);
  for (const acc of gdrive) {
    console.log(`Email: ${acc.email} | Token presente: ${!!acc.accessToken}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
