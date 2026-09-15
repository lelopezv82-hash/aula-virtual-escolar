import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-educational-key-2026"
);

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: string; role: string; name?: string; username?: string; email?: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !["TEACHER", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const format = req.nextUrl.searchParams.get("format") ?? "json";

    // Fetch data sequentially to prevent Supabase connection pool exhaustion
    const courses = await prisma.course.findMany({ include: { groups: true } });
    const grades = await prisma.grade.findMany({ include: { groups: true } });
    const gradeGroups = await prisma.gradeGroup.findMany({
      include: {
        grade: true,
        students: { select: { id: true, name: true, username: true } },
      },
    });
    const periods = await prisma.period.findMany();
    const themes = await prisma.theme.findMany();
    const resources = await prisma.resource.findMany();
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        name: true,
        username: true,
        groupId: true,
        createdAt: true,
        group: { select: { name: true, grade: { select: { name: true } } } },
      },
    });
    const tasks = await prisma.task.findMany({
      include: {
        groups: { select: { id: true, name: true, grade: { select: { name: true } } } },
      },
    });
    const submissions = await prisma.submission.findMany({
      include: {
        student: {
          select: {
            id: true,
            name: true,
            username: true,
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
        task: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const additionalGrades = await prisma.additionalGrade.findMany({
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "excel") {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumen
      const resumen = [
        ["Copia de Seguridad - Aula Virtual Escolar"],
        ["Fecha de generación:", new Date().toLocaleString("es-CO")],
        ["Generado por:", user.name ?? user.username ?? "Usuario"],
        [],
        ["Total Cursos:", courses.length],
        ["Total Grados:", grades.length],
        ["Total Grupos:", gradeGroups.length],
        ["Total Estudiantes:", students.length],
        ["Total Actividades:", tasks.length],
        ["Total Entregas:", submissions.length],
        ["Total Notas Adicionales:", additionalGrades.length],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

      // Sheet 2: Estudiantes
      const estudiantesHeaders = ["ID", "Nombre", "Usuario", "Grado", "Grupo", "Fecha Registro"];
      const estudiantesData = students.map((s) => [
        s.id,
        s.name,
        s.username,
        s.group?.grade?.name ?? "",
        s.group?.name ?? "",
        s.createdAt ? new Date(s.createdAt).toLocaleDateString("es-CO") : "",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([estudiantesHeaders, ...estudiantesData]),
        "Estudiantes"
      );

      // Sheet 3: Grupos
      const gruposHeaders = ["ID", "Grado", "Grupo", "Estudiantes Registrados"];
      const gruposData = gradeGroups.map((g) => [
        g.id,
        g.grade?.name ?? "",
        g.name,
        g.students?.length ?? 0,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([gruposHeaders, ...gruposData]),
        "Grupos"
      );

      // Sheet 4: Actividades
      const actividadesHeaders = [
        "ID",
        "Título",
        "Tipo",
        "Grupos Asignados",
        "Fecha Límite",
        "Activa",
      ];
      const actividadesData = tasks.map((t) => [
        t.id,
        t.title,
        t.type,
        t.groups.map((g) => `${g.grade?.name || ""}-${g.name}`).join(", "),
        t.dueDate ? new Date(t.dueDate).toLocaleDateString("es-CO") : "",
        t.active ? "Sí" : "No",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([actividadesHeaders, ...actividadesData]),
        "Actividades"
      );

      // Sheet 5: Entregas y Calificaciones
      const entregasHeaders = [
        "ID Entrega",
        "Estudiante",
        "Usuario",
        "Grado-Grupo",
        "Actividad",
        "Tipo",
        "Estado",
        "Calificación",
        "Fecha Entrega",
        "Enlace Archivo",
        "Retroalimentación",
      ];
      const entregasData = submissions.map((s) => [
        s.id,
        s.student?.name ?? "",
        s.student?.username ?? "",
        s.student?.group ? `${s.student.group.grade?.name}-${s.student.group.name}` : "",
        s.task?.title ?? "",
        s.task?.type ?? "",
        s.status,
        s.grade !== null && s.grade !== undefined ? s.grade : "",
        s.submittedAt ? new Date(s.submittedAt).toLocaleString("es-CO") : "",
        s.fileUrl ?? "",
        s.feedback ?? "",
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([entregasHeaders, ...entregasData]),
        "Entregas_Notas"
      );

      // Sheet 6: Notas Adicionales
      const adicionalesHeaders = ["ID", "Estudiante", "Curso ID", "Período", "Nota"];
      const adicionalesData = additionalGrades.map((a) => [
        a.id,
        a.student?.name ?? "",
        a.courseId,
        a.period,
        a.grade,
      ]);
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([adicionalesHeaders, ...adicionalesData]),
        "Notas_Adicionales"
      );

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="backup_aula_${timestamp}.xlsx"`,
        },
      });
    }

    // Default: JSON format
    const backupData = {
      meta: {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        generatedBy: user.name ?? user.username ?? "Usuario",
      },
      courses,
      grades,
      gradeGroups,
      periods,
      themes,
      resources,
      students,
      tasks,
      submissions,
      additionalGrades,
    };

    const json = JSON.stringify(backupData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_aula_${timestamp}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating backup:", error);
    return NextResponse.json(
      { error: error?.message || "Error al generar el respaldo" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Solo los administradores pueden restaurar un respaldo" },
        { status: 401 }
      );
    }

    const backup = await req.json();

    if (!backup?.meta?.version || !backup?.submissions) {
      return NextResponse.json(
        { error: "Archivo de respaldo inválido o corrupto" },
        { status: 400 }
      );
    }

    let restored = 0;

    await prisma.$transaction(async (tx) => {
      // Restore submissions
      for (const sub of backup.submissions ?? []) {
        await tx.submission.upsert({
          where: { id: sub.id },
          update: {
            status: sub.status,
            grade: sub.grade,
            feedback: sub.feedback,
            fileUrl: sub.fileUrl,
            fileUrls: sub.fileUrls,
            submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : undefined,
          },
          create: {
            id: sub.id,
            taskId: sub.taskId,
            studentId: sub.studentId,
            status: sub.status,
            grade: sub.grade,
            feedback: sub.feedback,
            fileUrl: sub.fileUrl,
            fileUrls: sub.fileUrls,
            submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : undefined,
          },
        });
        restored++;
      }

      // Restore additional grades
      for (const ag of backup.additionalGrades ?? []) {
        await tx.additionalGrade.upsert({
          where: { id: ag.id },
          update: {
            grade: ag.grade,
            period: ag.period,
          },
          create: {
            id: ag.id,
            studentId: ag.studentId,
            courseId: ag.courseId,
            period: ag.period,
            grade: ag.grade,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Respaldo restaurado exitosamente. ${restored} entregas procesadas.`,
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    return NextResponse.json(
      { error: "Error al restaurar el respaldo" },
      { status: 500 }
    );
  }
}
