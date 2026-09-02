const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const originalTask = await prisma.task.findUnique({
    where: { id: 'ee243904-a751-4d74-ab90-d486c8c87857' }
  });

  if (!originalTask) {
    throw new Error('No se encontró la tarea original');
  }

  const group1102 = await prisma.gradeGroup.findFirst({
    where: { name: '02', grade: { name: '11' } }
  });

  if (!group1102) {
    throw new Error('No se encontró el grupo 11-02');
  }

  console.log(`Clonando tarea para el grupo ${group1102.name} (ID: ${group1102.id})...`);

  const newTask = await prisma.task.create({
    data: {
      title: originalTask.title,
      description: originalTask.description,
      type: originalTask.type,
      period: originalTask.period || 'Periodo 3',
      dueDate: originalTask.dueDate || new Date('2026-08-31T23:59:00.000Z'),
      courseId: originalTask.courseId,
      isExternal: originalTask.isExternal,
      weight: originalTask.weight,
      allowLateSubmission: originalTask.allowLateSubmission,
      lateSubmissionUntil: originalTask.lateSubmissionUntil,
      attachmentUrl: originalTask.attachmentUrl,
      active: true,
      groups: {
        connect: [{ id: group1102.id }]
      }
    },
    include: {
      groups: { include: { grade: true } },
      course: true
    }
  });

  console.log('¡Tarea creada exitosamente!');
  console.log({
    id: newTask.id,
    title: newTask.title,
    period: newTask.period,
    course: newTask.course.name,
    groups: newTask.groups.map(g => `${g.grade?.name}-${g.name}`)
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
