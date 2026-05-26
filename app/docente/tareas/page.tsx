import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function TareasDocentePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const teacherId = payload.id as string;

  const courses = await prisma.course.findMany({
    where: { teacherId },
    include: { tasks: true }
  });

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

      <div className="flex flex-col gap-6">
        {courses.map(course => (
          <div key={course.id} className="card w-full">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="text-blue-600" />
              {course.name}
            </h2>
            
            {course.tasks.length === 0 ? (
              <p className="text-muted">No hay tareas asignadas en este curso.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th className="py-2 px-4 font-medium">Título</th>
                      <th className="py-2 px-4 font-medium">Fecha Límite</th>
                      <th className="py-2 px-4 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.tasks.map(task => (
                      <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td className="py-3 px-4">{task.title}</td>
                        <td className="py-3 px-4 text-muted">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/docente/tareas/${task.id}`} className="btn btn-secondary text-sm">
                            Ver Entregas
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
