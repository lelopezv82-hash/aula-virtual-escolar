import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-educational-key-2026");

async function getTeacherId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  if (payload.role !== "TEACHER") return null;
  return payload.id as string;
}

// GET /api/docente/temas?courseId=xxx
export async function GET(request: Request) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) return NextResponse.json({ error: "courseId requerido" }, { status: 400 });
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    const themes = await prisma.theme.findMany({
      where: { courseId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ themes });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — create a theme
export async function POST(request: Request) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await request.json();
    const { courseId, title } = body;
    if (!courseId || !title?.trim()) {
      return NextResponse.json({ error: "courseId y title son obligatorios" }, { status: 400 });
    }
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (!course) return NextResponse.json({ error: "Curso no encontrado" }, { status: 403 });
    const theme = await prisma.theme.create({ data: { title: title.trim(), courseId } });
    return NextResponse.json({ success: true, theme });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — delete a theme
export async function DELETE(request: Request) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const theme = await prisma.theme.findFirst({
      where: { id },
      include: { course: { select: { teacherId: true } } },
    });
    if (!theme || theme.course.teacherId !== teacherId) {
      return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
    }
    await prisma.theme.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH - update resources linked to a theme
export async function PATCH(request: Request) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const body = await request.json();
    const { id, resourceIds } = body;
    if (!id || !Array.isArray(resourceIds)) {
      return NextResponse.json({ error: "id (tema) y resourceIds son obligatorios" }, { status: 400 });
    }
    const theme = await prisma.theme.findFirst({
      where: { id },
      include: { course: { select: { teacherId: true } } },
    });
    if (!theme || theme.course.teacherId !== teacherId) {
      return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
    }
    await prisma.theme.update({
      where: { id },
      data: {
        resources: {
          set: resourceIds.map((resId: string) => ({ id: resId }))
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al vincular materiales al tema:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
