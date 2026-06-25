import prisma from '@/lib/prisma';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

export default async function CursoDescripcionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const { payload } = await jwtVerify(token, JWT_SECRET);
  const studentId = payload.id as string;

  const course = await prisma.course.findUnique({
    where: { id },
    select: { name: true, description: true, teacher: { select: { name: true, username: true } } },
  });

  if (!course) return null;

  return (
    <div>
      <div className="card">
        <h2 className="text-lg font-bold mb-3">Descripción de la Asignatura</h2>
        <p style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
          {course.description || "Esta asignatura no tiene una descripción asignada por el docente todavía."}
        </p>
      </div>

      <div className="card mt-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Docente</h3>
        <p className="font-semibold">{course.teacher.name}</p>
        <p className="text-sm text-muted">{course.teacher.username}</p>
      </div>
    </div>
  );
}
