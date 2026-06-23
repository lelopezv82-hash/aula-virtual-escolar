import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { BookOpen, FileText, Clock, ClipboardList } from "lucide-react";
import Link from "next/link";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function EstudianteDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) return null;
  const payload = (await jwtVerify(token, JWT_SECRET)).payload as any;
  const studentId = payload.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  // Fetch active periods from database
  const activePeriodsFromDb = await prisma.period.findMany({
    where: { active: true }
  });
  const activePeriodNames = activePeriodsFromDb.map(p => p.name);
  const now = new Date();

  const courses = await prisma.course.findMany({
    where: studentGroupId ? {
      groups: {
        some: {
          id: studentGroupId
        }
      }
    } : { id: "none" },
    include: {
      teacher: true,
      tasks: { where: { active: true } },
      resources: { where: { active: true } }
    }
  });

  const coursesWithCount = courses.map(c => {
    const { tasks, resources, ...courseData } = c;
    
    // Count only visible tasks and resources
    const visibleTasks = tasks.filter(t => 
      t.type !== "EXAM" &&
      (!t.period || activePeriodNames.includes(t.period)) &&
      (!t.publishAt || new Date(t.publishAt) <= now)
    );
    const visibleExams = tasks.filter(t => 
      t.type === "EXAM" &&
      (!t.period || activePeriodNames.includes(t.period)) &&
      (!t.publishAt || new Date(t.publishAt) <= now)
    );
    const visibleResources = resources.filter(r => 
      (!r.period || activePeriodNames.includes(r.period)) &&
      (!r.publishAt || new Date(r.publishAt) <= now)
    );

    return {
      ...courseData,
      _count: {
        tasks: visibleTasks.length,
        exams: visibleExams.length,
        resources: visibleResources.length
      }
    };
  });

  return (
    <div className="animate-fade-in">
      <div className="dashboard-header">
        <h1>¡Bienvenido, {payload.name}!</h1>
        <p>Tus asignaturas y materiales de estudio</p>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {coursesWithCount.map(course => (
          <div key={course.id} className="card">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-lg" style={{ background: "var(--primary-light)", color: "var(--primary-color)" }}>
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{course.name}</h3>
                <p className="text-sm text-muted">
                  {course.teacher.name.toLowerCase().startsWith("prof.") ? "" : "Prof. "}
                  {course.teacher.name}
                </p>
              </div>
            </div>
            
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {course.description || "Sin descripción"}
            </p>

            <div className="flex justify-between items-center mt-auto border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex gap-3 text-xs text-muted flex-wrap">
                <span className="flex items-center gap-1"><FileText size={14}/> {course._count.resources} recursos</span>
                <span className="flex items-center gap-1"><Clock size={14}/> {course._count.tasks} tareas</span>
                {course._count.exams > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--primary-color)', fontWeight: 500 }}><ClipboardList size={14}/> {course._count.exams} exámenes</span>
                )}
              </div>
              <Link href={`/estudiante/cursos/${course.id}`} className="btn btn-primary" style={{ display: 'inline-block', width: '100%' }}>
                Ver Asignatura
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
