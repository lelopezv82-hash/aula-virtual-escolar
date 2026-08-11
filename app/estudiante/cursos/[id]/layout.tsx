import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CursoSidebar from "./CursoSidebar";
import { Suspense } from "react";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function CursoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/");

  let studentId = "";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") redirect("/");
    studentId = payload.id as string;
  } catch {
    redirect("/");
  }

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true },
  });
  const studentGroupId = studentRecord?.groupId || null;

  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      hiddenSections: true,
      groups: { select: { id: true } },
    },
  });

  if (!course || !course.active || !course.groups.some((g) => g.id === studentGroupId)) {
    return (
      <div className="animate-fade-in">
        <div className="alert alert-danger">El curso no existe, no está activo o no tienes acceso a él.</div>
        <Link href="/estudiante" className="btn btn-secondary mt-4">
          <ArrowLeft size={16} /> Volver a Asignaturas
        </Link>
      </div>
    );
  }

  const hiddenSections = Array.isArray(course.hiddenSections) ? (course.hiddenSections as string[]) : [];

  // Fetch active periods for sidebar sub-items
  const periodsDb = await prisma.period.findMany({ where: { active: true } });
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const periodNames = periodsDb.map(p => p.name);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Top Banner: Asignatura, Periodo y Navegación Horizontal */}
      <Suspense fallback={<div className="card p-6 text-muted">Cargando asignatura...</div>}>
        <CursoSidebar courseId={id} courseName={course.name} periods={periodNames} hiddenSections={hiddenSections} />
      </Suspense>

      {/* Main content */}
      <div>
        {children}
      </div>
    </div>
  );
}
