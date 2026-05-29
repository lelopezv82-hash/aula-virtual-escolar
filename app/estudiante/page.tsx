import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { BookOpen, FileText, Download, Clock } from "lucide-react";
import Link from "next/link";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function EstudianteDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) return null;
  const payload = (await jwtVerify(token, JWT_SECRET)).payload as any;
  const studentId = payload.id as string;

  // Fetch all courses (for this MVP, students see all courses or courses they are enrolled in)
  // We'll just fetch all courses for simplicity in this MVP
  const courses = await prisma.course.findMany({
    include: {
      teacher: true,
      tasks: { where: { active: true } },
      resources: { where: { active: true } }
    }
  });

  const coursesWithCount = courses.map(c => {
    const { tasks, resources, ...courseData } = c;
    return {
      ...courseData,
      _count: {
        tasks: tasks.length,
        resources: resources.length
      }
    };
  });

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>¡Bienvenido, {payload.name}!</h1>
        <p>Tus cursos y materiales de estudio</p>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {coursesWithCount.map(course => (
          <div key={course.id} className="card">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-lg" style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary-color)" }}>
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{course.name}</h3>
                <p className="text-sm text-muted">Prof. {course.teacher.name}</p>
              </div>
            </div>
            
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {course.description || "Sin descripción"}
            </p>

            <div className="flex justify-between items-center mt-auto border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex gap-4 text-sm text-muted">
                <span className="flex items-center gap-1"><FileText size={16}/> {course._count.resources} recursos</span>
                <span className="flex items-center gap-1"><Clock size={16}/> {course._count.tasks} tareas</span>
              </div>
              <Link href={`/estudiante/cursos/${course.id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
                Ver Curso
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
