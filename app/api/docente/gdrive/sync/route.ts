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

    if (!defaultAccessToken) {
      return NextResponse.json({ isConnected: false });
    }

    try {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true, gDriveSyncFiles: true }
      });

      if (!course || course.teacherId !== teacherId) {
        return NextResponse.json({ isConnected: true, fileExists: false });
      }

      const syncFiles = (course.gDriveSyncFiles as Record<string, any> | null) || {};
      const fileEntry = syncFiles[period];

      if (!fileEntry) {
        return NextResponse.json({ isConnected: true, fileExists: false });
      }

      let storedFileId: string;
      let targetAccessToken = defaultAccessToken;

      if (typeof fileEntry === 'object' && fileEntry !== null) {
        storedFileId = fileEntry.fileId;
        if (fileEntry.accountId) {
          const accToken = await getGoogleAccessTokenForAccount(fileEntry.accountId);
          if (accToken) targetAccessToken = accToken;
        }
      } else {
        storedFileId = fileEntry;
      }

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

// POST: Execute bidirectional synchronization
// Flow:
//  1. Download Excel from Drive
//  2. Parse grades from Excel → upsert into DB (individual upserts, NO transaction to avoid timeout)
//  3. Re-fetch fresh grades from DB
//  4. Write DB grades back into Excel (using name-based row matching)
//  5. Upload updated Excel back to Drive
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TEACHER") return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const teacherId = payload.id as string;
    const body = await request.json();
    const { courseId, period } = body;

    if (!courseId || !period) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // ── 1. Fetch course + students ─────────────────────────────────────────
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

    const accounts = await getAccountsWithSpace(teacherId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'Google Drive no vinculado o sin cuentas activas' }, { status: 400 });
    }

    // Deduplicate students across groups
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

    // ── 2. Select Google Drive account ─────────────────────────────────────
    const existingSyncFiles = (course.gDriveSyncFiles as Record<string, any> | null) || {};
    const fileEntry = existingSyncFiles[period];

    let selectedAccount: AccountSpace;
    if (fileEntry && typeof fileEntry === 'object' && fileEntry.accountId) {
      const match = accounts.find((a: AccountSpace) => a.id === fileEntry.accountId);
      selectedAccount = match || accounts.sort((a: AccountSpace, b: AccountSpace) => b.freeSpace - a.freeSpace)[0];
    } else {
      accounts.sort((a: AccountSpace, b: AccountSpace) => b.freeSpace - a.freeSpace);
      selectedAccount = accounts[0];
    }

    if (!selectedAccount) {
      return NextResponse.json({ error: 'No hay cuentas de Drive disponibles' }, { status: 400 });
    }
    const accountToken = selectedAccount.accessToken;

    // ── 3. Resolve Drive file ID ───────────────────────────────────────────
    const gradeName = course.groups[0]?.grade?.name || "Sin Grado";
    const folderPath = `${gradeName}/${course.name}/${period}`;
    const filename = `Sincro_Planilla_${course.name}_${period}.xlsx`;

    let driveFileId: string | undefined =
      typeof fileEntry === 'object' ? fileEntry?.fileId :
      typeof fileEntry === 'string' ? fileEntry : undefined;

    if (!driveFileId) {
      try {
        const folderId = await resolveDriveFolderPath(accountToken, teacherId, folderPath);
        const found = await findFileInFolder(accountToken, folderId, filename);
        if (found) driveFileId = found.id;
      } catch {
        // folder lookup failed — will create new file later
      }
    }

    // ── 4. Fetch tasks from DB ─────────────────────────────────────────────
    const tasks = await prisma.task.findMany({
      where: { courseId, active: true, period },
      select: {
        id: true, title: true, type: true, dueDate: true, duration: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, status: true, grade: true, id: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const saberTasks = tasks.filter(t => t.type === "EXAM");
    const hacerTasks = tasks.filter(t => t.type === "TASK");
    const serTasks   = tasks.filter(t => t.type === "SER");

    // Official template column layout — dynamic detection via header row
    const SABER_START = 2;  const SABER_SLOTS = 4;
    const HACER_START = 6;  const HACER_SLOTS = 10;
    const SER_START  = 16;  const SER_SLOTS   = 3;

    // Normalize name for fuzzy comparison: lowercase, strip accents, collapse spaces
    const normalizeName = (s: string) =>
      s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();

    // ── 5. Download Drive file and parse grades into DB ────────────────────
    let loadedWorkbook: any = null;
    let targetSheetName = "";
    let isOfficialFormat = false;
    let headerRowIndex = -1;

    if (driveFileId) {
      try {
        const fileBuffer = await downloadDriveFile(accountToken, driveFileId);
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (rows.length >= 2) {
          const firstRow = rows[0];

          if (firstRow && firstRow[0] === "STUDENT_ID" && firstRow[1] === "STUDENT_NAME") {
            // ── Platform-generated simple format ───────────────────────────
            const taskIds = firstRow.slice(3);
            const toUpsert: Array<{ studentId: string; taskId: string; grade: number }> = [];

            for (let i = 2; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;
              const studentId = row[0];
              if (!studentId || typeof studentId !== "string") continue;
              if (!studentMap.has(studentId)) continue;

              taskIds.forEach((taskId: string, index: number) => {
                if (!taskId) return;
                const gradeVal = row[index + 3];
                if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
                  const num = parseFloat(String(gradeVal).replace(',', '.'));
                  if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
                    toUpsert.push({ studentId, taskId, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              });
            }

            // Individual upserts — no wrapping transaction to avoid timeout
            for (const sub of toUpsert) {
              await prisma.submission.upsert({
                where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
                update: { grade: sub.grade, status: 'GRADED', updatedAt: new Date() },
                create: { taskId: sub.taskId, studentId: sub.studentId, grade: sub.grade, status: 'GRADED', createdAt: new Date(), updatedAt: new Date() }
              });
            }
            console.log(`Simple format: ${toUpsert.length} grades Drive→DB`);

            loadedWorkbook = workbook;
            targetSheetName = sheetName;
            isOfficialFormat = false;

          } else {
            // ── Official template format ───────────────────────────────────
            // Detect header row: scan first 15 rows for "nombre completo" in col B
            for (let r = 0; r < Math.min(rows.length, 15); r++) {
              if (rows[r] && rows[r][1] && String(rows[r][1]).toLowerCase().includes("nombre completo")) {
                headerRowIndex = r;
                break;
              }
            }

            if (headerRowIndex !== -1) {
              const toUpsert: Array<{ studentId: string; taskId: string; grade: number }> = [];

              for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const studentNameInExcel = String(row[1] || '').trim();
                if (!studentNameInExcel) continue;

                // Match student by name — normalize accents + fuzzy
                const excelNorm = normalizeName(studentNameInExcel);
                const studentIndex = i - (headerRowIndex + 1);
                let student = students[studentIndex];
                const posNorm = student ? normalizeName(student.name) : '';

                if (!student || (excelNorm !== posNorm && !excelNorm.includes(posNorm) && !posNorm.includes(excelNorm))) {
                  const found = students.find(s => {
                    const sn = normalizeName(s.name);
                    return sn === excelNorm || sn.includes(excelNorm) || excelNorm.includes(sn);
                  });
                  if (!found) continue;
                  student = found;
                }

                const studentId = student.id;

                // SABER
                for (let j = 0; j < SABER_SLOTS; j++) {
                  const t = saberTasks[j];
                  if (!t) continue;
                  const gradeVal = row[SABER_START + j];
                  if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
                    const num = parseFloat(String(gradeVal).replace(',', '.'));
                    if (!isNaN(num) && num >= 1.0 && num <= 5.0)
                      toUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }

                // HACER
                for (let j = 0; j < HACER_SLOTS; j++) {
                  const t = hacerTasks[j];
                  if (!t) continue;
                  const gradeVal = row[HACER_START + j];
                  if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
                    const num = parseFloat(String(gradeVal).replace(',', '.'));
                    if (!isNaN(num) && num >= 1.0 && num <= 5.0)
                      toUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }

                // SER
                for (let j = 0; j < SER_SLOTS; j++) {
                  const t = serTasks[j];
                  if (!t) continue;
                  const gradeVal = row[SER_START + j];
                  if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== "") {
                    const num = parseFloat(String(gradeVal).replace(',', '.'));
                    if (!isNaN(num) && num >= 1.0 && num <= 5.0)
                      toUpsert.push({ studentId, taskId: t.id, grade: parseFloat(num.toFixed(1)) });
                  }
                }
              }

              // Individual upserts — no wrapping transaction to avoid timeout
              for (const sub of toUpsert) {
                await prisma.submission.upsert({
                  where: { taskId_studentId: { taskId: sub.taskId, studentId: sub.studentId } },
                  update: { grade: sub.grade, status: 'GRADED', updatedAt: new Date() },
                  create: { taskId: sub.taskId, studentId: sub.studentId, grade: sub.grade, status: 'GRADED', createdAt: new Date(), updatedAt: new Date() }
                });
              }
              console.log(`Official format: ${toUpsert.length} grades Drive→DB`);

              loadedWorkbook = workbook;
              targetSheetName = sheetName;
              isOfficialFormat = true;
            }
          }
        }
      } catch (err) {
        console.error("Error reading Drive file — will write DB state to Drive:", err);
      }
    }

    // ── 6. Re-fetch fresh grades from DB ──────────────────────────────────
    const freshTasks = await prisma.task.findMany({
      where: { courseId, active: true, period },
      select: {
        id: true, title: true, type: true,
        submissions: {
          where: { studentId: { in: studentIds } },
          select: { studentId: true, grade: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const freshSaber  = freshTasks.filter(t => t.type === "EXAM");
    const freshHacer  = freshTasks.filter(t => t.type === "TASK");
    const freshSer    = freshTasks.filter(t => t.type === "SER");
    const freshFinal  = freshTasks.filter(t => t.type === "FINAL");
    const freshAttend = freshTasks.filter(t => t.type === "ATTEND");

    // ── 7. Build output Excel buffer ──────────────────────────────────────
    let newBuffer: Buffer;

    if (isOfficialFormat && loadedWorkbook) {
      // Write DB grades back into the original official template
      const ws = loadedWorkbook.Sheets[targetSheetName];
      const wsRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

      // Build studentId → rowIndex map by name matching
      const studentRowMap = new Map<string, number>();
      for (let r = 0; r < wsRows.length; r++) {
        const row = wsRows[r];
        if (!row) continue;
        const excelName = row[1];
        if (excelName && typeof excelName === 'string') {
          const cleanName = normalizeName(excelName);
          if (cleanName.includes("nombrecompleto") || cleanName.includes("nombrecom") || cleanName.includes("nombre com")) continue;
          const matched = students.find(s => {
            const dn = normalizeName(s.name);
            return dn === cleanName || dn.includes(cleanName) || cleanName.includes(dn);
          });
          if (matched) studentRowMap.set(matched.id, r);
        }
      }

      students.forEach(student => {
        const rowIndex = studentRowMap.get(student.id);
        if (rowIndex === undefined) return;

        // SABER
        for (let j = 0; j < SABER_SLOTS; j++) {
          const t = freshSaber[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = (sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade : "";
          const ref = XLSX.utils.encode_cell({ r: rowIndex, c: SABER_START + j });
          if (val === "") { delete ws[ref]; } else { ws[ref] = { t: 'n', v: val }; }
        }

        // HACER
        for (let j = 0; j < HACER_SLOTS; j++) {
          const t = freshHacer[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = (sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade : "";
          const ref = XLSX.utils.encode_cell({ r: rowIndex, c: HACER_START + j });
          if (val === "") { delete ws[ref]; } else { ws[ref] = { t: 'n', v: val }; }
        }

        // SER
        for (let j = 0; j < SER_SLOTS; j++) {
          const t = freshSer[j];
          const sub = t ? t.submissions.find(s => s.studentId === student.id) : null;
          const val = (sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade : "";
          const ref = XLSX.utils.encode_cell({ r: rowIndex, c: SER_START + j });
          if (val === "") { delete ws[ref]; } else { ws[ref] = { t: 'n', v: val }; }
        }
      });

      newBuffer = XLSX.write(loadedWorkbook, { type: "buffer", bookType: "xlsx" });

    } else {
      // Generate platform-format spreadsheet
      const activeTasks = [...freshSaber, ...freshHacer, ...freshSer, ...freshFinal, ...freshAttend];
      let counter = 1;
      const taskNumbers: Record<string, number> = {};
      activeTasks.forEach(t => { taskNumbers[t.id] = counter++; });

      const row1 = ["STUDENT_ID", "STUDENT_NAME", "GROUP", ...activeTasks.map(t => t.id)];
      const row2 = ["ID Estudiante", "Nombre Completo", "Grupo", ...activeTasks.map(t => {
        const cat = t.type === "EXAM" ? "SABER" : t.type === "TASK" ? "HACER" : t.type === "SER" ? "SER" : t.type === "FINAL" ? "EXAMEN FINAL" : "ASISTENCIA";
        return `${cat} ${taskNumbers[t.id]} - ${t.title}`;
      })];

      const dataRows: any[][] = [row1, row2];
      students.forEach(student => {
        const row: any[] = [student.id, student.name, student.groupName];
        activeTasks.forEach(t => {
          const sub = t.submissions.find(s => s.studentId === student.id);
          row.push((sub && sub.grade !== null && sub.grade !== undefined) ? sub.grade.toFixed(1) : "");
        });
        dataRows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      ws["!rows"] = [{ hidden: true }];
      ws["!cols"] = Array.from({ length: row2.length }, () => ({ wch: 15 }));
      ws["!cols"][0] = { wch: 25 };
      ws["!cols"][1] = { wch: 30 };
      ws["!cols"][2] = { wch: 15 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
      newBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    }

    // ── 8. Upload updated Excel to Drive ──────────────────────────────────
    let finalFileId: string | undefined;
    let finalWebViewLink = '';
    const isNew = !driveFileId;

    if (driveFileId) {
      try {
        await updateDriveFile(accountToken, driveFileId, newBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,webViewLink`,
          { headers: { Authorization: `Bearer ${accountToken}` } }
        );
        const metaData = metaRes.ok ? await metaRes.json() : {};
        finalFileId = driveFileId;
        finalWebViewLink = metaData.webViewLink || '';
      } catch {
        // File was deleted — create new
        const uploadRes = await uploadToGoogleDrive(newBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', teacherId, folderPath);
        finalFileId = uploadRes?.id;
        finalWebViewLink = uploadRes?.url || '';
      }
    } else {
      const uploadRes = await uploadToGoogleDrive(newBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', teacherId, folderPath);
      finalFileId = uploadRes?.id;
      finalWebViewLink = uploadRes?.url || '';
    }

    if (!finalFileId) {
      throw new Error('El archivo fue procesado en Drive pero no se pudo obtener su ID. Intente nuevamente.');
    }

    // ── 9. Persist Drive file ID to DB ────────────────────────────────────
    const latestCourse = await prisma.course.findUnique({ where: { id: courseId }, select: { gDriveSyncFiles: true } });
    const latestSyncFiles = (latestCourse?.gDriveSyncFiles as Record<string, any> | null) || {};
    await prisma.course.update({
      where: { id: courseId },
      data: {
        gDriveSyncFiles: {
          ...latestSyncFiles,
          [period]: { fileId: finalFileId, accountId: selectedAccount.id }
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
