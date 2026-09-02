const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== GRUPOS DE GRADO 11 ===');
  const groups = await prisma.gradeGroup.findMany({
    include: { grade: true }
  });
  const g11 = groups.filter(g => g.grade?.name?.includes('11') || g.name?.includes('11') || g.name?.includes('02'));
  console.log(g11.map(g => ({ id: g.id, name: g.name, grade: g.grade?.name })));

  console.log('\n=== TAREAS RECIENTES (ÚLTIMAS 50) ===');
  const allTasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      course: { select: { id: true, name: true, teacherId: true } },
      groups: { select: { id: true, name: true, grade: { select: { name: true } } } },
      assignedStudents: { select: { id: true, name: true } },
      _count: { select: { submissions: true } }
    }
  });

  allTasks.forEach(t => {
    const grps = t.groups.map(g => `${g.grade?.name || ''}-${g.name}`).join(', ');
    console.log(`[${t.id}] "${t.title}" | Tipo: ${t.type} | Periodo: ${t.period} | Curso: ${t.course?.name} | Grupos: [${grps}] | Entregas: ${t._count.submissions} | Creado: ${t.createdAt} | Actualizado: ${t.updatedAt}`);
  });

  console.log('\n=== ENTREGAS (SUBMISSIONS) RECIENTES ===');
  const submissionsToday = await prisma.submission.findMany({
    include: {
      task: { select: { id: true, title: true, course: { select: { name: true } } } },
      student: { select: { id: true, name: true, group: { select: { name: true, grade: { select: { name: true } } } } } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 40
  });

  console.log(`Encontradas ${submissionsToday.length} entregas:`);
  submissionsToday.forEach(s => {
    console.log(`Estudiante: ${s.student?.name} (${s.student?.group?.grade?.name}-${s.student?.group?.name}) | Tarea: "${s.task?.title}" (${s.task?.course?.name}) | Nota: ${s.grade} | Status: ${s.status} | Fecha: ${s.updatedAt}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
