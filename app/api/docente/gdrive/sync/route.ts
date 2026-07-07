import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { 
  getGoogleAccessToken, 
  getGoogleAccessTokenForAccount,
  resolveDriveFolderPath, 
  findFileInFolder, 
  downloadDriveFile, 
  updateDriveFile,
  uploadToGoogleDrive,
  getAccountsWithSpace,
  AccountSpace
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
    const defaultAccessToken = await getGoogleAccessToken(teacherId);

    // If no valid token → Drive is not linked
    if (!defaultAccessToken) {
      return NextResponse.json({ isConnected: false });
    }

    // Drive IS connected — check if we have a stored file details for this course+period
    try {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true, gDriveSyncFiles: true }
      });

      if (!course || course.teacherId !== teacherId) {
        return NextResponse.json({ isConnected: true, fileExists: false });
      }

      // Look up stored Drive file details
      const syncFiles = (course.gDriveSyncFiles as Record<string, any> | null) || {};
      const fileEntry = syncFiles[period];

      if (!fileEntry) {
        // No stored entry → file has never been created for this period
        return NextResponse.json({ isConnected: true, fileExists: false });
      }

      let storedFileId: string;
      let targetAccessToken = defaultAccessToken;

      if (typeof fileEntry === 'object' && fileEntry !== null) {
        storedFileId = fileEntry.fileId;
        if (fileEntry.accountId) {
          const accToken = await getGoogleAccessTokenForAccount(fileEntry.accountId);
          if (accToken) {
            targetAccessToken = accToken;
          }
        }
      } else {
        // Old string format fallback
        storedFileId = fileEntry;
      }

      // Verify the file still exists in Drive by fetching its metadata
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${storedFileId}?fields=id,name,webViewLink`,
        { headers: { Authorization: `Bearer ${targetAccessToken}` } }
      );

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        return NextResponse.json({
          isConnected: true,
          fileExists: true,
          webViewLink: fileData.webViewLink,
          filename: fileData.name
        });
      } else {
        // If it returns 404, we are sure the file does not exist.
        // Otherwise (e.g. 401, 500, 403), it might be a temporary permission error, so do NOT delete the DB record.
        if (fileRes.status === 404) {
          const updatedSyncFiles = { ...syncFiles };
          delete updatedSyncFiles[period];
          await prisma.course.update({
            where: { id: courseId },
            data: { gDriveSyncFiles: updatedSyncFiles }
          });
        }
        return NextResponse.json({ isConnected: true, fileExists: false });
      }
    } catch (driveErr) {
      console.error('Error checking Drive file status:', driveErr);
      return NextResponse.json({ isConnected: true, fileExists: false });
    }

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
    const accounts = await getAccountsWithSpace(teacherId);

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Google Drive no vinculado o sin cuentas activas' }, { status: 400 });
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

    // Get the account associated with the file or select the one with most space
    const existingSyncFiles = (course.gDriveSyncFiles as Record<string, any> | null) || {};
    const fileEntry = existingSyncFiles[period];

    let selectedAccount = accounts[0];
    if (fileEntry && typeof fileEntry === 'object' && fileEntry.accountId) {
      const match = accounts.find((a: AccountSpace) => a.id === fileEntry.accountId);
      if (match) {
        selectedAccount = match;
      } else {
        // Fallback to sorting by free space if the associated account is no longer linked
        accounts.sort((a: AccountSpace, b: AccountSpace) => b.freeSpace - a.freeSpace);
        selectedAccount = accounts[0];
      }
    } else {
      accounts.sort((a: AccountSpace, b: AccountSpace) => b.freeSpace - a.freeSpace);
      selectedAccount = accounts[0];
    }

    const accountToken = selectedAccount.accessToken;

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

    const folderId = await resolveDriveFolderPath(accountToken, teacherId, folderPath);
    const file = await findFileInFolder(accountToken, folderId, filename);

    let isOfficialFormat = false;
    let loadedWorkbook: any = null;
    let targetSheetName = "";

    // 3. Process existing file (if any) to read grades
    if (file) {
      try {
        const fileBuffer = await downloadDriveFile(accountToken, file.id);
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
          } else if (
            rows.length >= 9 &&
            rows[6] &&
            String(rows[6][1]).toLowerCase().includes("nombre completo")
          ) {
            // Planilla Oficial Format (e.g. Row 6 is headers, Row 7 is subnumbers, Row 8 onwards are students)
            const saberTasksFilter = tasks.filter(t => t.type === "EXAM");
            const hacerTasksFilter = tasks.filter(t => t.type === "TASK");
            const serTasksFilter   = tasks.filter(t => t.type === "SER");

            const SABER_START = 2;  const SABER_SLOTS = 4;
            const HACER_START = 6;  const HACER_SLOTS = 10;
            const SER_START  = 16;  const SER_SLOTS   = 3;

            const submissionsToUpsert: Array<{ studentId: string; taskId: string; grade: number }> = [];
            const submissionsToDelete: Array<{ studentId: string; taskId: string }> = [];

            // Students start at index 8 of the rows array
            for (let i = 8; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              // Find student by name
              const studentNameInExcel = row[1];
              if (!studentNameInExcel || typeof studentNameInExcel !== "string") continue;

              // Match student in students array
              // Since the official spreadsheet was exported using the exact same alphabetized student list,
              // we can map index `i - 8` to `students[i - 8]`. To be safe, we also verify the name contains or matches.
              const studentIndex = i - 8;
              let student = students[studentIndex];

              // Double check name match (case insensitive, ignoring spacing changes)
              const cleanExcelName = studentNameInExcel.toLowerCase().replace(/\s+/g, '');
              let cleanDbName = student ? student.name.toLowerCase().replace(/\s+/g, '') : '';
              
              if (!student || (!cleanExcelName.includes(cleanDbName) && !cleanDbName.includes(cleanExcelName))) {
                // Fall back to finding by name in the entire list if index mismatch occurred
                const foundStudent = students.find(s => {
                  const sName = s.name.toLowerCase().replace(/\s+/g, '');
                  return sName === cleanExcelName || sName.includes(cleanExcelName) || cleanExcelName.includes(sName);
                });
                if (!foundStudent) continue;
                student = foundStudent;
              }

              const studentId = student.id;

              // 1. Process SABER tasks
              for (let j = 0; j < SABER_SLOTS; j++) {
                const t = saberTasksFilter[j];
                if (!t) continue;
                const colIndex = SABER_START + j;
                const gradeVal = row[colIndex];
                if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
                  submissionsToDelete.push({ studentId, taskId: t.id });
                } else {
                  const num = parseFloat(gradeVal);
                  if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              }

              // 2. Process HACER tasks
              for (let j = 0; j < HACER_SLOTS; j++) {
                const t = hacerTasksFilter[j];
                if (!t) continue;
                const colIndex = HACER_START + j;
                const gradeVal = row[colIndex];
                if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
                  submissionsToDelete.push({ studentId, taskId: t.id });
                } else {
                  const num = parseFloat(gradeVal);
                  if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              }

              // 3. Process SER tasks
              for (let j = 0; j < SER_SLOTS; j++) {
                const t = serTasksFilter[j];
                if (!t) continue;
                const colIndex = SER_START + j;
                const gradeVal = row[colIndex];
                if (gradeVal === undefined || gradeVal === null || String(gradeVal).trim() === "") {
                  submissionsToDelete.push({ studentId, taskId: t.id });
                } else {
                  const num = parseFloat(gradeVal);
                  if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    submissionsToUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              }
            }

            // Database Sync Transaction for Official Template
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
            isOfficialFormat = true;
            loadedWorkbook = workbook;
            targetSheetName = sheetName;
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

    let newBuffer: Buffer;

    if (isOfficialFormat && loadedWorkbook) {
      const ws = loadedWorkbook.Sheets[targetSheetName];
      const saberTasksFilter = freshTasks.filter(t => t.type === "EXAM");
      const hacerTasksFilter = freshTasks.filter(t => t.type === "TASK");
      const serTasksFilter   = freshTasks.filter(t => t.type === "SER");

      const SABER_START = 2;  const SABER_SLOTS = 4;
      const HACER_START = 6;  const HACER_SLOTS = 10;
      const SER_START  = 16;  const SER_SLOTS   = 3;

      students.forEach((student, i) => {
        const rowIndex = 8 + i;
        
        // SABER slots
        for (let j = 0; j < SABER_SLOTS; j++) {
          const t = saberTasksFilter[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = sub && sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: SABER_START + j });
          if (val === "") {
            delete ws[cellRef];
          } else {
            ws[cellRef] = { t: 'n', v: val };
          }
        }

        // HACER slots
        for (let j = 0; j < HACER_SLOTS; j++) {
          const t = hacerTasksFilter[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = sub && sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: HACER_START + j });
          if (val === "") {
            delete ws[cellRef];
          } else {
            ws[cellRef] = { t: 'n', v: val };
          }
        }

        // SER slots
        for (let j = 0; j < SER_SLOTS; j++) {
          const t = serTasksFilter[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = sub && sub.grade !== null && sub.grade !== undefined ? sub.grade : "";
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: SER_START + j });
          if (val === "") {
            delete ws[cellRef];
          } else {
            ws[cellRef] = { t: 'n', v: val };
          }
        }
      });
      newBuffer = XLSX.write(loadedWorkbook, { type: "buffer", bookType: "xlsx" });
    } else {
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
      newBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }

    // 5. Save back to Drive
    const courseForSync = await prisma.course.findUnique({
      where: { id: courseId },
      select: { gDriveSyncFiles: true }
    });
    const freshSyncFiles = (courseForSync?.gDriveSyncFiles as Record<string, any> | null) || {};
    const freshFileEntry = freshSyncFiles[period];

    let storedFileId: string | undefined;
    if (freshFileEntry && typeof freshFileEntry === 'object') {
      storedFileId = freshFileEntry.fileId;
    } else if (typeof freshFileEntry === 'string') {
      storedFileId = freshFileEntry;
    }

    let finalFileId: string | undefined;
    let finalWebViewLink: string = '';

    if (storedFileId) {
      // Try to update the existing file by its stored ID
      try {
        await updateDriveFile(accountToken, storedFileId, newBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${storedFileId}?fields=id,webViewLink`,
          { headers: { Authorization: `Bearer ${accountToken}` } }
        );
        const metaData = metaRes.ok ? await metaRes.json() : {};
        finalFileId = storedFileId;
        finalWebViewLink = metaData.webViewLink || '';
      } catch {
        // File might have been deleted — fall through to create
        const uploadRes = await uploadToGoogleDrive(
          newBuffer,
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          teacherId,
          folderPath
        );
        finalFileId = uploadRes?.id;
        finalWebViewLink = uploadRes?.url || '';
      }
    } else if (file) {
      // Found via folder search (old sync files before this fix)
      await updateDriveFile(accountToken, file.id, newBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      finalFileId = file.id;
      finalWebViewLink = file.webViewLink || '';
    } else {
      // Create new file
      const uploadRes = await uploadToGoogleDrive(
        newBuffer,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        teacherId,
        folderPath
      );
      finalFileId = uploadRes?.id;
      finalWebViewLink = uploadRes?.url || '';
    }

    // Validate that we got a real file ID before touching the DB
    if (!finalFileId) {
      throw new Error('El archivo fue procesado en Drive pero no se pudo obtener su ID. Intente nuevamente.');
    }

    const isNew = !storedFileId;

    // Save the file details to DB so GET can find it instantly next time
    await prisma.course.update({
      where: { id: courseId },
      data: {
        gDriveSyncFiles: {
          ...freshSyncFiles,
          [period]: {
            fileId: finalFileId,
            accountId: selectedAccount.id
          }
        }
      }
    });

    const drivePath = `Aula Virtual Escolar / ${gradeName} / ${course.name} / ${period}`;

    return NextResponse.json({
      success: true,
      message: isNew ? 'Planilla creada y sincronizada correctamente.' : 'Planilla sincronizada correctamente.',
      webViewLink: finalWebViewLink,
      fileId: finalFileId,
      drivePath
    });


  } catch (error: any) {
    console.error('Error synchronizing grades:', error);
    return NextResponse.json({ error: 'Error interno: ' + (error?.message || error) }, { status: 500 });
  }
}
