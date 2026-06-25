import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ArrowLeft, BookOpen, Download, ClipboardList, Clock, CheckCircle, AlertCircle, FileText, Link as LinkIcon, HelpCircle } from "lucide-react";
import Link from "next/link";
import { formatToColombiaString, getTaskDeadlineStatus } from "@/lib/dateUtils";


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

const TYPE_ICONS: Record<string, string> = {
  PDF: "📄", WORD: "📝", PPT: "📊", IMAGE: "🖼️", VIDEO: "🎬", LINK: "🔗"
};

export default async function EstudianteCursoDetallePage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ id: string }>, 
  searchParams: Promise<{ periodo?: string }> 
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const selectedPeriodParam = resolvedSearchParams.periodo;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  let user: any = null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "STUDENT") return null;
    user = payload;
  } catch {
    return null;
  }

  const studentId = user.id as string;

  const studentRecord = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true }
  });
  const studentGroupId = studentRecord?.groupId || null;

  const course = await prisma.course.findUnique({
    where: { id: resolvedParams.id },
    include: {
      teacher: true,
      groups: true,
      resources: {
        orderBy: { createdAt: "desc" },
        include: { groups: true }
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          groups: true,
          submissions: {
            where: { studentId }
          }
        }
      }
    }
  });

  if (!course || !course.groups.some(g => g.id === studentGroupId)) {
    return (
      <div className="animate-fade-in">
        <div className="alert alert-danger">El curso no existe o no tienes acceso a él.</div>
        <Link href="/estudiante" className="btn btn-secondary mt-4">
          <ArrowLeft size={16} /> Volver a Mis Cursos
        </Link>
      </div>
    );
  }

  // Get active periods from database
  const periodsDb = await prisma.period.findMany({
    where: { active: true }
  });
  periodsDb.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const activePeriods = periodsDb.map(p => p.name);

  const currentPeriod = activePeriods.includes(selectedPeriodParam || "")
    ? (selectedPeriodParam as string)
    : (activePeriods[0] || "");

  // Filter tasks & resources by selected period, active status, and group assignment
  const now = new Date();
  const filteredRegularTasks = course.tasks.filter(t => 
    t.period === currentPeriod && 
    t.type !== "EXAM" &&
    t.active !== false && 
    (!t.publishAt || new Date(t.publishAt) <= now) &&
    (t.groups.length === 0 || t.groups.some(g => g.id === studentGroupId))
  );
  const filteredExams = course.tasks.filter(t => 
    t.period === currentPeriod && 
    t.type === "EXAM" &&
    t.active !== false && 
    (!t.publishAt || new Date(t.publishAt) <= now) &&
    (t.groups.length === 0 || t.groups.some(g => g.id === studentGroupId))
  );
  const filteredResources = course.resources.filter(r => 
    r.period === currentPeriod && 
    r.active !== false && 
    (!r.publishAt || new Date(r.publishAt) <= now) &&
    (r.groups.length === 0 || r.groups.some(g => g.id === studentGroupId))
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/estudiante" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <p className="text-muted text-sm">Prof. {course.teacher.name} • {course.teacher.username}</p>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="text-xl font-bold mb-2">Descripción de la Asignatura</h2>
        <p style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
          {course.description || "Este curso no tiene una descripción detallada asignada por el docente."}
        </p>
      </div>
    </div>
  );
}
