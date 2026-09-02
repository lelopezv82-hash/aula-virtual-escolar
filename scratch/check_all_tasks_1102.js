const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allTasks = await prisma.task.findMany({
    include: {
      course: { select: { id: true, name: true, teacherId: true } },
      groups: { select: { id: true, name: true, grade: { select: { name: true } } } },
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`TOTAL DE TAREAS EN BASE DE DATOS: ${allTasks.length}`);
  allTasks.forEach(t => {
    const grps = t.groups.map(g => `${g.grade?.name || ''}-${g.name}`).join(', ');
    console.log(`ID: ${t.id} | Titulo: "${t.title}" | Periodo: ${t.period} | Curso: "${t.course?.name}" | Grupos: [${grps}] | Entregas: ${t._count.submissions} | Creado: ${t.createdAt}`);
  });

  // Check students of 11-02
  const g1102 = await prisma.gradeGroup.findFirst({
    where: { name: '02', grade: { name: '11' } },
    include: {
      students: {
        include: {
          submissions: {
            include: { task: true }
          }
        }
      }
    }
  });

  console.log(`\n=== ESTUDIANTES DE 11-02 (${g1102?.students.length || 0}) Y SUS ENTREGAS ===`);
  if (g1102) {
    let totalSubs = 0;
    g1102.students.forEach(s => {
      if (s.submissions.length > 0) {
        totalSubs += s.submissions.length;
        console.log(`Estudiante: ${s.name} | Entregas (${s.submissions.length}): ${s.submissions.map(sub => `"${sub.task?.title}" (Nota: ${sub.grade})`).join(', ')}`);
      }
    });
    console.log(`Total entregas encontradas para estudiantes de 11-02: ${totalSubs}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
