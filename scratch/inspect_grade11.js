const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const groups11 = await prisma.gradeGroup.findMany({
    where: {
      grade: { name: { contains: '11' } }
    },
    include: {
      grade: true,
      students: { select: { id: true, name: true } },
      courses: { select: { id: true, name: true } }
    }
  });

  console.log('=== GRUPOS DE GRADO 11 ===');
  for (const g of groups11) {
    console.log(`Grupo ID: ${g.id} | Grado: ${g.grade?.name} | Nombre: ${g.name} | Estudiantes: ${g.students.length} | Cursos asignados: ${g.courses.map(c => c.name).join(', ')}`);
  }

  const tasks11 = await prisma.task.findMany({
    where: {
      course: {
        groups: {
          some: {
            grade: { name: { contains: '11' } }
          }
        }
      }
    },
    include: {
      course: { select: { id: true, name: true } },
      groups: { select: { id: true, name: true, grade: { select: { name: true } } } },
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\n=== TAREAS DE CURSOS DE GRADO 11 ===');
  for (const t of tasks11) {
    const grps = t.groups.map(g => `${g.grade?.name || ''}-${g.name} (id:${g.id})`).join(', ');
    console.log(`ID: ${t.id} | Titulo: "${t.title}" | Periodo: ${t.period} | Curso: "${t.course?.name}" (id: ${t.course?.id}) | Grupos asignados a la tarea: [${grps}] | Entregas: ${t._count.submissions} | Creado: ${t.createdAt}`);
  }

  console.log('\n=== BUSCAR SI HAY TAREAS CON "1102" o "11-02" o "02" O TAREAS SIN GRUPOS ===');
  const allTasks = await prisma.task.findMany({
    include: {
      course: { select: { id: true, name: true } },
      groups: { select: { id: true, name: true, grade: { select: { name: true } } } },
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  for (const t of allTasks) {
    if (t.groups.length === 0) {
      console.log(`[TAREA SIN GRUPOS] ID: ${t.id} | Titulo: "${t.title}" | Curso: ${t.course?.name} | Entregas: ${t._count.submissions}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
