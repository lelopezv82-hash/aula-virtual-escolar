import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import PeriodosClient from "./PeriodosClient";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function PeriodosDocentePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;

  // Fetch all courses including all resources and tasks
  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: {
      resources: {
        orderBy: { createdAt: 'desc' }
      },
      tasks: {
        orderBy: { dueDate: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Serialize dates safely
  const serializedCourses = courses.map(course => ({
    id: course.id,
    name: course.name,
    description: course.description,
    period1Active: course.period1Active,
    period2Active: course.period2Active,
    period3Active: course.period3Active,
    period4Active: course.period4Active,
    resources: course.resources.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      url: r.url,
      theme: r.theme,
      period: r.period
    })),
    tasks: course.tasks.map(t => ({
      id: t.id,
      title: t.title,
      theme: t.theme,
      weight: t.weight,
      dueDate: t.dueDate.toISOString(),
      period: t.period
    }))
  }));

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header mb-6">
        <h1>Periodos Académicos</h1>
        <p className="text-muted">Gestiona el material de clase, tareas y visibilidad de cada periodo académico en tus cursos.</p>
      </div>

      <PeriodosClient courses={serializedCourses} />
    </div>
  );
}
