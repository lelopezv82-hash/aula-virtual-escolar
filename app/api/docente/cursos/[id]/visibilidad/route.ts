import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-educational-key-2026"
);

async function getTeacherId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER" && payload.role !== "ADMIN") return null;
    return payload.id as string;
  } catch {
    return null;
  }
}

// GET - Get section visibility configuration for a course
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      teacherId: true,
      hiddenSections: true,
      period1Active: true,
      period2Active: true,
      period3Active: true,
      period4Active: true,
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  }

  const hiddenSections = Array.isArray(course.hiddenSections)
    ? course.hiddenSections
    : [];

  return NextResponse.json({
    courseId: course.id,
    courseName: course.name,
    hiddenSections,
    period1Active: course.period1Active,
    period2Active: course.period2Active,
    period3Active: course.period3Active,
    period4Active: course.period4Active,
  });
}

// PATCH - Update section visibility for a course
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId();
  if (!teacherId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { hiddenSections, period1Active, period2Active, period3Active, period4Active } = body;

  const updateData: any = {};
  if (Array.isArray(hiddenSections)) {
    updateData.hiddenSections = hiddenSections;
  }
  if (typeof period1Active === "boolean") updateData.period1Active = period1Active;
  if (typeof period2Active === "boolean") updateData.period2Active = period2Active;
  if (typeof period3Active === "boolean") updateData.period3Active = period3Active;
  if (typeof period4Active === "boolean") updateData.period4Active = period4Active;

  const updatedCourse = await prisma.course.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      hiddenSections: true,
      period1Active: true,
      period2Active: true,
      period3Active: true,
      period4Active: true,
    },
  });

  return NextResponse.json({
    message: "Visibilidad actualizada exitosamente",
    course: updatedCourse,
  });
}
