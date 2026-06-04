import { NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from '@/lib/prisma';
import { getGoogleAccessToken, uploadToGoogleDrive } from '@/lib/gdrive';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-educational-key-2026');

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
    const body = await request.json();
    const { csvContent, courseName, taskTitle, groupName, type, filename, groupId } = body;

    if (!csvContent || !type || !filename) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const gAccessToken = await getGoogleAccessToken(teacherId);
    if (!gAccessToken) {
      return NextResponse.json({ success: false, message: 'Google Drive no vinculado por el docente. Saltando respaldo.' });
    }

    const buffer = Buffer.from("\uFEFF" + csvContent, 'utf-8');

    if (type === "grades") {
      if (!courseName) return NextResponse.json({ error: 'Falta courseName' }, { status: 400 });
      
      // Try to find the task or course to fetch the grade and period
      let gradeName = "Sin Grado";
      let periodName = "General";
      
      if (taskTitle) {
        const task = await prisma.task.findFirst({
          where: {
            title: taskTitle,
            course: {
              name: courseName,
              teacherId
            }
          },
          include: {
            course: {
              include: {
                groups: {
                  include: {
                    grade: true
                  }
                }
              }
            }
          }
        });
        if (task) {
          gradeName = task.course.groups[0]?.grade?.name || "Sin Grado";
          periodName = task.period || "Sin Periodo";
        }
      } else {
        const course = await prisma.course.findFirst({
          where: {
            name: courseName,
            teacherId
          },
          include: {
            groups: {
              include: {
                grade: true
              }
            }
          }
        });
        if (course) {
          gradeName = course.groups[0]?.grade?.name || "Sin Grado";
        }
      }

      const taskFolder = taskTitle ? `/${taskTitle}` : "";
      const folderPath = `${gradeName}/${courseName}/${periodName}/Tareas${taskFolder}/Calificaciones`;
      try {
        const uploadResult = await uploadToGoogleDrive(buffer, filename, 'text/csv', teacherId, folderPath);
        const webViewLink = uploadResult.url;
        return NextResponse.json({ success: true, webViewLink });
      } catch (driveError: any) {
        console.error("Error in Google Drive report upload:", driveError);
        return NextResponse.json({ error: 'Error al subir el reporte a Google Drive: ' + driveError.message }, { status: 500 });
      }
    } else if (type === "students") {
      if (!groupId || !groupName) {
        return NextResponse.json({ error: 'Faltan groupId o groupName' }, { status: 400 });
      }
      // Get all courses of this teacher connected to this group
      const courses = await prisma.course.findMany({
        where: {
          teacherId,
          groups: {
            some: {
              id: groupId
            }
          }
        },
        include: {
          groups: {
            include: {
              grade: true
            }
          }
        }
      });

      if (courses.length === 0) {
        // If no courses are created yet, put it in a root "/Estudiantes"
        const folderPath = `Estudiantes`;
        try {
          const uploadResult = await uploadToGoogleDrive(buffer, filename, 'text/csv', teacherId, folderPath);
          const webViewLink = uploadResult.url;
          return NextResponse.json({ success: true, webViewLink, message: 'Respaldado en carpeta Estudiantes raíz.' });
        } catch (driveError: any) {
          return NextResponse.json({ error: driveError.message }, { status: 500 });
        }
      }

      const uploadPromises = courses.map(async (course) => {
        const gradeName = course.groups.find(g => g.id === groupId)?.grade?.name || "Sin Grado";
        const folderPath = `${gradeName}/${course.name}/Estudiantes`;
        const res = await uploadToGoogleDrive(buffer, filename, 'text/csv', teacherId, folderPath);
        return res.url;
      });

      const webViewLinks = await Promise.all(uploadPromises);
      return NextResponse.json({ success: true, webViewLinks });
    } else {
      return NextResponse.json({ error: 'Tipo de reporte inválido' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in reports backup API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
