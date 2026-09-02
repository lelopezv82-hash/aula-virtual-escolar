const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. BUSCANDO TODAS LAS CALIFICACIONES / SUBMISSIONS RECIENTES ===');
  const allRecentSubs = await prisma.submission.findMany({
    where: {
      grade: { not: null }
    },
    include: {
      task: { select: { id: true, title: true, type: true, courseId: true, course: { select: { name: true } } } },
      student: {
        select: {
          id: true,
          name: true,
          groupId: true,
          group: { select: { id: true, name: true, grade: { select: { name: true } } } }
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });

  console.log(`Total de submissions con nota encontradas: ${allRecentSubs.length}`);
  const byGroup = {};
  allRecentSubs.forEach(s => {
    const grp = s.student?.group ? `${s.student.group.grade?.name}-${s.student.group.name}` : 'Sin grupo';
    if (!byGroup[grp]) byGroup[grp] = [];
    byGroup[grp].push(s);
  });

  for (const [grp, subs] of Object.entries(byGroup)) {
    console.log(`\n-- Grupo: ${grp} (${subs.length} notas) --`);
    console.log(`Tareas calificadas: ${[...new Set(subs.map(s => `"${s.task?.title}"`))].join(', ')}`);
    subs.slice(0, 5).forEach(s => {
      console.log(`  Estudiante: ${s.student?.name} | Tarea: "${s.task?.title}" | Nota: ${s.grade} | Fecha: ${s.updatedAt}`);
    });
  }

  console.log('\n=== 2. REVISANDO TABLA ADDITIONAL GRADES ===');
  const addGrades = await prisma.additionalGrade.findMany({
    include: { student: { select: { name: true, group: true } } }
  });
  console.log(`Total en AdditionalGrade: ${addGrades.length}`);
  addGrades.forEach(g => {
    console.log(`Estudiante: ${g.student?.name} | Tipo: ${g.type} | Nota: ${g.grade}`);
  });

  console.log('\n=== 3. REVISANDO PLANILLA DATA EN CURSOS ===');
  const courses = await prisma.course.findMany({
    select: { id: true, name: true, planillaData: true, gDriveSyncFiles: true }
  });
  courses.forEach(c => {
    if (c.planillaData) {
      console.log(`Curso ${c.name} tiene planillaData:`, JSON.stringify(c.planillaData).slice(0, 300));
    }
  });

  console.log('\n=== 4. VER TODOS LOS ESTUDIANTES DE 11-02 ===');
  const g1102Students = await prisma.user.findMany({
    where: {
      group: { name: '02', grade: { name: '11' } }
    },
    include: {
      submissions: {
        include: { task: true }
      }
    },
    orderBy: { name: 'asc' }
  });
  console.log(`Estudiantes en 11-02: ${g1102Students.length}`);
  g1102Students.forEach(s => {
    console.log(`- ${s.name} (id: ${s.id}) | Submissions: ${s.submissions.length}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
