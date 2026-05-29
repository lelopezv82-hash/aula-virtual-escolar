const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Create Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      passwordPlain: 'admin123',
      name: 'Administrador del Sistema',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Created admin:', admin.username);

  // Create Teacher
  const hashedPassword = await bcrypt.hash('profesor123', 10);
  const teacher = await prisma.user.upsert({
    where: { username: 'profesor1' },
    update: {},
    create: {
      username: 'profesor1',
      password: hashedPassword,
      name: 'Prof. Carlos Mendoza',
      role: 'TEACHER',
    },
  });
  console.log('Created teacher:', teacher.username);

  // Create Sample Course
  const course = await prisma.course.create({
    data: {
      name: 'Matemáticas 10°',
      description: 'Curso de matemáticas avanzadas para grado 10',
      teacherId: teacher.id,
    },
  });
  console.log('Created course:', course.name);

  // Create Grades and Groups
  console.log('Creating grades and groups...');
  const grade10 = await prisma.grade.upsert({
    where: { name: '10°' },
    update: {},
    create: { name: '10°' }
  });

  const grade11 = await prisma.grade.upsert({
    where: { name: '11°' },
    update: {},
    create: { name: '11°' }
  });

  const group10A = await prisma.gradeGroup.upsert({
    where: { gradeId_name: { gradeId: grade10.id, name: '10-A' } },
    update: {},
    create: { name: '10-A', gradeId: grade10.id }
  });

  await prisma.gradeGroup.upsert({
    where: { gradeId_name: { gradeId: grade10.id, name: '10-B' } },
    update: {},
    create: { name: '10-B', gradeId: grade10.id }
  });

  await prisma.gradeGroup.upsert({
    where: { gradeId_name: { gradeId: grade11.id, name: '11-A' } },
    update: {},
    create: { name: '11-A', gradeId: grade11.id }
  });

  // Create Students
  const studentPassword = await bcrypt.hash('estudiante123', 10);
  
  await prisma.user.deleteMany({
    where: { username: { in: ['juan.perez', 'maria.gomez'] } }
  });
  
  const student1 = await prisma.user.create({
    data: {
      username: 'juan.perez',
      password: studentPassword,
      name: 'Juan Pérez',
      role: 'STUDENT',
      grade: '10',
      groupName: 'A',
      groupId: group10A.id
    }
  });
  
  const student2 = await prisma.user.create({
    data: {
      username: 'maria.gomez',
      password: studentPassword,
      name: 'María Gómez',
      role: 'STUDENT',
      grade: '10',
      groupName: 'A',
      groupId: group10A.id
    }
  });
  console.log('Created students: juan.perez, maria.gomez associated with 10-A');

  // Create a Task
  await prisma.task.create({
    data: {
      title: 'Taller de Álgebra',
      description: 'Resolver los ejercicios de la página 45 a 50 del libro texto.',
      dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // In 7 days
      courseId: course.id
    }
  });

  // Create a Resource
  await prisma.resource.create({
    data: {
      title: 'Guía de Estudio - Álgebra',
      type: 'PDF',
      url: '/uploads/guia_algebra.pdf',
      courseId: course.id
    }
  });

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
