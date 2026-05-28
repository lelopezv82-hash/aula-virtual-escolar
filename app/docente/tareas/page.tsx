import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { Plus } from "lucide-react";
import Link from "next/link";
import TareasDocenteClient from "./TareasDocenteClient";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareasDocentePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;

  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: { 
      tasks: {
        orderBy: { dueDate: 'asc' }
      } 
    }
  });

  // Convert Date objects to string for client rendering serialization safety
  const serializedCourses = courses.map(c => ({
    ...c,
    tasks: c.tasks.map(t => ({
      ...t,
      dueDate: t.dueDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }))
  }));

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header flex justify-between items-center">
        <div>
          <h1>Gestión de Tareas</h1>
          <p>Crea tareas y revisa las entregas de tus estudiantes.</p>
        </div>
        <Link href="/docente/tareas/nueva" className="btn btn-primary">
          <Plus size={18} /> Nueva Tarea
        </Link>
      </div>

      <TareasDocenteClient courses={serializedCourses} />
    </div>
  );
}
