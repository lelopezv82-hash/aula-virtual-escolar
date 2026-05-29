import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { notFound } from "next/navigation";
import PeriodoClient from "./PeriodoClient";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

interface PageProps {
  params: {
    id: string;
  };
}

export default async function PeriodoDocentePage({ params }: PageProps) {
  const periodId = params.id;
  if (!["1", "2", "3", "4"].includes(periodId)) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;
  const periodName = `Periodo ${periodId}`;

  // Fetch courses with resources and tasks
  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: {
      resources: {
        where: { period: periodName },
        orderBy: { createdAt: 'desc' }
      },
      tasks: {
        where: { period: periodName },
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
      period: r.period,
      active: r.active
    })),
    tasks: course.tasks.map(t => ({
      id: t.id,
      title: t.title,
      theme: t.theme,
      weight: t.weight,
      dueDate: t.dueDate.toISOString(),
      period: t.period,
      active: t.active
    }))
  }));

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header mb-6">
        <h1>{periodName}</h1>
        <p className="text-muted">Vista unificada de todos tus cursos, tareas y recursos asignados al {periodName.toLowerCase()}.</p>
      </div>

      <PeriodoClient courses={serializedCourses} periodName={periodName} />
    </div>
  );
}
