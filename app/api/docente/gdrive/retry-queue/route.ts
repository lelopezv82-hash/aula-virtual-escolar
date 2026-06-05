import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDriveQueueCount, processDriveQueue } from '@/lib/driveQueue';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET /api/docente/gdrive/retry-queue - Retorna el total de archivos pendientes en cola para este docente
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacherId = payload.id as string;
    const count = await getDriveQueueCount(teacherId);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error al obtener conteo de la cola de reintentos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/docente/gdrive/retry-queue - Procesa la cola de reintentos de este docente
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacherId = payload.id as string;
    const result = await processDriveQueue(teacherId);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error al procesar la cola de reintentos de Drive:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
