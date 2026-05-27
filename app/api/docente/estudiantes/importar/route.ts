import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Acción permitida únicamente para administradores del sistema.' },
    { status: 403 }
  );
}
