import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// Helper to generate a base username from full name
function generateBaseUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (base.length >= 3) {
    return `${base[2]}.${base[0]}`;
  }
  if (base.length === 2) {
    return `${base[1]}.${base[0]}`;
  }
  return base[0] || "estudiante";
}

// POST - Bulk import students with performance optimization
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER" && payload.role !== "ADMIN") {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { students } = await request.json();
    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No se enviaron estudiantes válidos' }, { status: 400 });
    }

    // Filter valid non-empty rows
    const validRows = students.filter((row: Record<string, unknown>) => {
      const name = String(row.name || row.Nombre || '').trim();
      return name.length > 0;
    });

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'No hay filas con nombres válidos para importar' }, { status: 400 });
    }

    // Cache grades & groups to minimize DB queries
    const existingGrades = await prisma.grade.findMany({
      include: { groups: true }
    });
    const gradeMap = new Map<string, { id: string; groups: Map<string, string> }>();

    for (const g of existingGrades) {
      const groupMap = new Map<string, string>();
      for (const grp of g.groups) {
        groupMap.set(grp.name.trim().toLowerCase(), grp.id);
      }
      gradeMap.set(g.name.trim().toLowerCase(), { id: g.id, groups: groupMap });
    }

    // Retrieve existing usernames to prevent collisions locally
    const existingUsers = await prisma.user.findMany({
      select: { username: true }
    });
    const usedUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

    const studentsToCreate: Array<{
      name: string;
      username: string;
      password: string;
      passwordPlain: string;
      role: "STUDENT";
      grade: string | null;
      groupName: string | null;
      groupId: string | null;
    }> = [];

    const createdStudentsResponse: Array<{
      name: string;
      username: string;
      plainPassword: string;
      grade: string | null;
      groupName: string | null;
    }> = [];

    // Process all students in memory first
    for (const row of validRows) {
      const name = String(row.name || row.Nombre || '').trim();
      const grade = String(row.grade || row.Grado || row.gradeName || '').trim() || null;
      const groupName = String(row.groupName || row.Grupo || row.group || '').trim() || null;

      let resolvedGroupId: string | null = null;

      if (grade) {
        const gradeKey = grade.toLowerCase();
        let gradeEntry = gradeMap.get(gradeKey);

        if (!gradeEntry) {
          const newGradeRecord = await prisma.grade.create({ data: { name: grade } });
          gradeEntry = { id: newGradeRecord.id, groups: new Map() };
          gradeMap.set(gradeKey, gradeEntry);
        }

        if (groupName) {
          const groupKey = groupName.toLowerCase();
          let groupObjId = gradeEntry.groups.get(groupKey);

          if (!groupObjId) {
            const newGroupRecord = await prisma.gradeGroup.create({
              data: { name: groupName, gradeId: gradeEntry.id }
            });
            groupObjId = newGroupRecord.id;
            gradeEntry.groups.set(groupKey, groupObjId);
          }
          resolvedGroupId = groupObjId;
        }
      }

      // Generate unique username
      const baseUsername = generateBaseUsername(name);
      let username = baseUsername;
      let counter = 1;
      while (usedUsernames.has(username.toLowerCase())) {
        username = `${baseUsername}${counter++}`;
      }
      usedUsernames.add(username.toLowerCase());

      // Temporary password
      const plainPassword = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(plainPassword, 8); // Optimized salt rounds for bulk import

      studentsToCreate.push({
        name,
        username,
        password: hashedPassword,
        passwordPlain: plainPassword,
        role: "STUDENT",
        grade,
        groupName,
        groupId: resolvedGroupId
      });

      createdStudentsResponse.push({
        name,
        username,
        plainPassword,
        grade,
        groupName
      });
    }

    // Execute bulk creation inside a high-speed Prisma transaction
    await prisma.$transaction(
      studentsToCreate.map(studentData => prisma.user.create({ data: studentData }))
    );

    return NextResponse.json({
      success: true,
      createdCount: createdStudentsResponse.length,
      createdStudents: createdStudentsResponse
    });
  } catch (error) {
    console.error("Error bulk importing students:", error);
    return NextResponse.json({ error: 'Error interno del servidor al importar estudiantes' }, { status: 500 });
  }
}

