import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return null;
    return payload;
  } catch {
    return null;
  }
}

// GET all periods
export async function GET() {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const periods = await prisma.period.findMany();
    periods.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return NextResponse.json({ periods });
  } catch {
    return NextResponse.json({ error: 'Error al obtener periodos' }, { status: 500 });
  }
}

// POST create period
export async function POST(request: Request) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { name } = await request.json();
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    let trimmedName = name.trim();
    if (trimmedName.toLowerCase().startsWith("periodo ")) {
      trimmedName = "Periodo " + trimmedName.substring(8);
    }

    // Check if duplicate
    const existing = await prisma.period.findUnique({
      where: { name: trimmedName }
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un periodo con este nombre' }, { status: 400 });
    }

    const period = await prisma.period.create({
      data: { name: trimmedName }
    });

    return NextResponse.json({ success: true, period });
  } catch {
    return NextResponse.json({ error: 'Error al crear el periodo' }, { status: 500 });
  }
}

// PATCH update period (rename or toggle active status)
export async function PATCH(request: Request) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { id, name, active } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID de periodo no proporcionado' }, { status: 400 });
    }

    const oldPeriod = await prisma.period.findUnique({
      where: { id }
    });
    if (!oldPeriod) {
      return NextResponse.json({ error: 'Periodo no encontrado' }, { status: 404 });
    }

    const updateData: any = {};
    if (active !== undefined) {
      updateData.active = active;
      // Automatically toggle active status of all matching tasks and resources
      await prisma.task.updateMany({
        where: { period: oldPeriod.name },
        data: { active: active }
      });
      await prisma.resource.updateMany({
        where: { period: oldPeriod.name },
        data: { active: active }
      });
    }

    if (name !== undefined) {
      let trimmedName = name.trim();
      if (trimmedName.toLowerCase().startsWith("periodo ")) {
        trimmedName = "Periodo " + trimmedName.substring(8);
      }
      if (trimmedName === "") {
        return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
      }

      // Check duplicate if name is changing
      if (trimmedName !== oldPeriod.name) {
        const existing = await prisma.period.findUnique({
          where: { name: trimmedName }
        });
        if (existing) {
          return NextResponse.json({ error: 'Ya existe un periodo con este nombre' }, { status: 400 });
        }
        updateData.name = trimmedName;
      }
    }

    const updatedPeriod = await prisma.period.update({
      where: { id },
      data: updateData
    });

    // If name changed, rename references in Task and Resource models
    if (name !== undefined && updateData.name && updateData.name !== oldPeriod.name) {
      await prisma.task.updateMany({
        where: { period: oldPeriod.name },
        data: { period: updateData.name }
      });
      await prisma.resource.updateMany({
        where: { period: oldPeriod.name },
        data: { period: updateData.name }
      });
    }

    return NextResponse.json({ success: true, period: updatedPeriod });
  } catch (error) {
    console.error("Error patching period:", error);
    return NextResponse.json({ error: 'Error al actualizar el periodo' }, { status: 500 });
  }
}

// DELETE period
export async function DELETE(request: Request) {
  const user = await checkAuth();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID de periodo no proporcionado' }, { status: 400 });
    }

    const period = await prisma.period.findUnique({
      where: { id }
    });
    if (!period) {
      return NextResponse.json({ error: 'Periodo no encontrado' }, { status: 404 });
    }

    await prisma.period.delete({
      where: { id }
    });

    // Set tasks and resources of this period to null
    await prisma.task.updateMany({
      where: { period: period.name },
      data: { period: null }
    });
    await prisma.resource.updateMany({
      where: { period: period.name },
      data: { period: null }
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar el periodo' }, { status: 500 });
  }
}
