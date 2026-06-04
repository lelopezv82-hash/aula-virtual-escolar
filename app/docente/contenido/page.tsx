import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import ContenidoClient from "./ContenidoClient";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function ContenidoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;

  // Fetch all courses including all resources and tasks with their groups
  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: {
      groups: {
        include: {
          grade: true
        }
      },
      resources: {
        include: {
          groups: {
            include: {
              grade: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      tasks: {
        include: {
          groups: {
            include: {
              grade: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Serialize dates safely for client rendering
  const serializedCourses = courses.map(course => ({
    id: course.id,
    name: course.name,
    description: course.description,
    period1Active: course.period1Active,
    period2Active: course.period2Active,
    period3Active: course.period3Active,
    period4Active: course.period4Active,
    groups: course.groups.map(g => ({
      id: g.id,
      name: g.name,
      grade: {
        name: g.grade.name
      }
    })),
    resources: course.resources.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      url: r.url,
      theme: r.theme,
      period: r.period,
      active: r.active,
      gdriveEmail: r.gdriveEmail,
      groups: r.groups.map(g => ({
        id: g.id,
        name: g.name,
        grade: {
          name: g.grade.name
        }
      }))
    })),
    tasks: course.tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate.toISOString(),
      attachmentUrl: t.attachmentUrl,
      theme: t.theme,
      weight: t.weight,
      period: t.period,
      active: t.active,
      allowLateSubmission: t.allowLateSubmission,
      gdriveEmail: t.gdriveEmail,
      lateSubmissionUntil: t.lateSubmissionUntil ? t.lateSubmissionUntil.toISOString() : null,
      groups: t.groups.map(g => ({
        id: g.id,
        name: g.name,
        grade: {
          name: g.grade.name
        }
      }))
    }))
  }));

  // Fetch and seed periods
  let periods = await prisma.period.findMany();
  if (periods.length === 0) {
    await prisma.period.createMany({
      data: [
        { name: "Periodo 1", active: true },
        { name: "Periodo 2", active: true },
        { name: "Periodo 3", active: true },
        { name: "Periodo 4", active: true }
      ]
    });
    periods = await prisma.period.findMany();
  }
  periods.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const serializedPeriods = periods.map(p => ({
    id: p.id,
    name: p.name,
    active: p.active
  }));

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header mb-6">
        <h1>Gestión de Contenido</h1>
        <p className="text-muted">Crea, edita y elimina tus tareas y materiales de clase de manera centralizada.</p>
      </div>

      <ContenidoClient courses={serializedCourses} initialPeriods={serializedPeriods} />
    </div>
  );
}
