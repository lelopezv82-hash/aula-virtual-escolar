import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const periods = await prisma.period.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, active: true },
    });
    return NextResponse.json({ periods });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
