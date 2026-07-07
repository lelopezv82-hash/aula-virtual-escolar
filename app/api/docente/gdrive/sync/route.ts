import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { 
  getGoogleAccessToken, 
  resolveDriveFolderPath, 
  findFileInFolder, 
  downloadDriveFile, 
  updateDriveFile,
  uploadToGoogleDrive
} from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

// GET: Check synchronization status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const period = searchParams.get('period');

    if (!courseId || !period) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const gAccessToken = await getGoogleAccessToken(teacherId);

    if (!gAccessToken) {
      return NextResponse.json({ isConnected: false });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        groups: {
          include: { grade: true }
        }
      }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const gradeName = course.groups[0]?.grade?.name || "Sin Grado";
    const folderPath = `${gradeName}/${course.name}/${period}`;
    const filename = `Sincro_Planilla_${course.name}_${period}.xlsx`;

    const folderId = await resolveDriveFolderPath(gAccessToken, teacherId, folderPath);
    const file = await findFileInFolder(gAccessToken, folderId, filename);

    if (file) {
      return NextResponse.json({
        isConnected: true,
        fileExists: true,
        webViewLink: file.webViewLink,
        filename
      });
    }

    return NextResponse.json({
      isConnected: true,
      fileExists: false,
      filename
    });

  } catch (error: any) {
    console.error('Error checking sync status:', error);
    return NextResponse.json({ error: 'Error interno: ' + (error?.message || error) }, { status: 500 });
  }
}

// POST: Execute synchronization (bidirectional sync and merge)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const gAccessToken = await getGoogleAccessToken(teacherId);

    if (!gAccessToken) {
      return NextResponse.json({ error: 'Google Drive no vinculado' }, { status: 400 });
    }

    const body = await request.json();
    const { courseId, period } = body;

    if (!courseId || !period) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // 1. Fetch course details
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        groups: {
          include: {
            students: {
              where: { role: 'STUDENT' },
              orderBy: { name: 'asc' },
              select: { id: true, name: true }
            },
            grade: { select: { name: true } }
          }
        }
      }
    });

    if (!course || course.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Deduplicate students
    const studentMap = new Map<string, { id: string; name: string; groupName: string }>();
    for (const group of course.groups) {
      for (const student of group.students) {
        if (!studentMap.has(student.id)) {
          const gradeLabel = group.grade?.name ? `${group.grade.name} - ${group.name}` : group.name;
          studentMap.set(student.id, { id: student.id, name: student.name, groupName: gradeLabel });
        }
      }
    }
    const students = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const studentIds = students.map(s => s.id);

    // Fetch tasks for the period
    const tasks = await prisma.task.findMany({
      where: {
        courseId,
        active: true,
        period,
      },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        duration: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, status: true, grade: true, id: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // 2. Drive Folder & File Resolution
    const gradeName = course.groups[0]?.grade?.name || "Sin Grado";
    const folderPath = `${gradeName}/${course.name}/${period}`;
    const filename = `Sincro_Planilla_${course.name}_${period}.xlsx`;

    const folderId = await resolveDriveFolderPath(gAccessToken, teacherId, folderPath);
    const file = await findFileInFolder(gAccessToken, folderId, filename);

    // 3. Process existing file (if any) to read grades
    if (file) {
      try {
        const fileBuffer = await downloadDriveFile(gAccessToken, file.id);
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (rows.length >= 2) {
          const metadataRow = rows[0];
          if (metadataRow && metadataRow[0] === "STUDENT_ID" && metadataRow[1] === "STUDENT_NAME") {
            const taskIds = metadataRow.slice(3);
            const submissionsToUpsert: Array<{ studentId: string; taskId: string; grade: number }> = [];
            const submissionsToDelete: Array<{ studentId: string; taskId: string }> = [];

            for (let i = 2; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const studentId = row[0];
              if (!studentId || typeof studentId !== "string" || studentId === "STUDENT_ID") continue;

              // Verify student belongs to this course
              if (!studentMap.has(studentId)) continue;

              taskIds.forEach((taskId, index) => {
                if (!taskId) return;
                const colIndex = index + 3;
                const gradeVal = row[colIndex];

                if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
                  submissionsToDelete.push({ studentId, taskId });
                } else {
                  const num = parseFloat(gradeVal);
                  if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    submissionsToUpsert.push({ studentId, taskId, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              });
            }

            // Database Sync Transaction
            await prisma.$transaction(async (tx) => {
              for (const sub of submissionsToDelete) {
                await tx.submission.deleteMany({
                  where: { studentId: sub.studentId, taskId: sub.taskId }
                });
              }
              for (const sub of submissionsToUpsert) {
                await tx.submission.upsert({
                  where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
                  update: {
                    grade: sub.grade,
                    status: 'GRADED',
                    updatedAt: new Date()
                  },
                  create: {
                    taskId: sub.taskId,
                    studentId: sub.studentId,
                    grade: sub.grade,
                    status: 'GRADED',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.error("Error reading current spreadsheet from Drive, overwriting with clean DB state:", err);
      }
    }

    // 4. Regenerate Excel buffer from updated DB
    const freshTasks = await prisma.task.findMany({
      where: {
        courseId,
        active: true,
        period,
      },
      select: {
        id: true,
        title: true,
        type: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, grade: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const row1 = ["STUDENT_ID", "STUDENT_NAME", "GROUP"];
    const row2 = ["ID Estudiante", "Nombre Completo", "Grupo"];

    const saberTasks = freshTasks.filter(t => t.type === "EXAM");
    const hacerTasks = freshTasks.filter(t => t.type === "TASK");
    const serTasks = freshTasks.filter(t => t.type === "SER");
    const finalTasks = freshTasks.filter(t => t.type === "FINAL");
    const attendTasks = freshTasks.filter(t => t.type === "ATTEND");

    let counter = 1;
    const taskNumbers: Record<string, number> = {};
    saberTasks.forEach(t => taskNumbers[t.id] = counter++);
    hacerTasks.forEach(t => taskNumbers[t.id] = counter++);
    serTasks.forEach(t => taskNumbers[t.id] = counter++);
    finalTasks.forEach(t => taskNumbers[t.id] = counter++);
    attendTasks.forEach(t => taskNumbers[t.id] = counter++);

    const activeTasks = [
      ...saberTasks,
      ...hacerTasks,
      ...serTasks,
      ...finalTasks,
      ...attendTasks
    ];

    activeTasks.forEach(t => {
      row1.push(t.id);
      const category = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
      row2.push(`${category} ${taskNumbers[t.id]} - ${t.title}`);
    });

    const dataRows = [row1, row2];

    students.forEach(student => {
      const row = [student.id, student.name, student.groupName];
      activeTasks.forEach(t => {
        const sub = t.submissions.find(s => s.studentId === student.id);
        row.push(sub && sub.grade !== null && sub.grade !== undefined ? sub.grade.toFixed(1) : "");
      });
      dataRows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws["!rows"] = [{ hidden: true }];
    ws["!cols"] = Array.from({ length: row2.length }, () => ({ wch: 15 }));
    ws["!cols"][0] = { wch: 25 }; // student ID
    ws["!cols"][1] = { wch: 30 }; // student name
    ws["!cols"][2] = { wch: 15 }; // group

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    const newBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // 5. Save back to Drive
    if (file) {
      // Update in place
      await updateDriveFile(gAccessToken, file.id, newBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return NextResponse.json({ 
        success: true, 
        message: 'Planilla sincronizada correctamente.', 
        webViewLink: file.webViewLink 
      });
    } else {
      // Create new file
      const uploadRes = await uploadToGoogleDrive(
        newBuffer, 
        filename, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        teacherId, 
        folderPath
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Planilla creada y sincronizada correctamente.', 
        webViewLink: uploadRes.url 
      });
    }

  } catch (error: any) {
    console.error('Error synchronizing grades:', error);
    return NextResponse.json({ error: 'Error interno: ' + (error?.message || error) }, { status: 500 });
  }
}
