import prisma from './prisma';
import { supabase } from './supabase';
import { uploadToGoogleDrive } from './gdrive';

export interface EnqueueOptions {
  recordType: 'RESOURCE' | 'SUBMISSION';
  recordId: string;
  supabaseUrl: string;
  supabasePath: string;
  teacherId: string;
  filename: string;
  mimeType: string;
  folderPath: string;
}

/**
 * Registra un archivo en la cola de reintentos de Drive.
 * Se llama cuando la subida a Drive falla y el archivo ya fue guardado en Supabase.
 */
export async function enqueueFailedDriveUpload(opts: EnqueueOptions): Promise<void> {
  try {
    // Si ya existe un ítem para este record, actualízalo en vez de crear otro
    const existing = await prisma.driveUploadQueue.findFirst({
      where: { recordType: opts.recordType, recordId: opts.recordId },
    });

    if (existing) {
      await prisma.driveUploadQueue.update({
        where: { id: existing.id },
        data: {
          supabaseUrl: opts.supabaseUrl,
          supabasePath: opts.supabasePath,
          filename: opts.filename,
          mimeType: opts.mimeType,
          folderPath: opts.folderPath,
          attempts: 0,
          lastAttemptAt: null,
        },
      });
    } else {
      await prisma.driveUploadQueue.create({ data: opts });
    }
  } catch (err) {
    console.error('[DriveQueue] Error al encolar reintento:', err);
  }
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/**
 * Procesa la cola de reintentos de Drive para un docente.
 * Si teacherId es undefined, procesa todos los pendientes.
 *
 * Por cada ítem:
 *  1. Descarga el archivo desde Supabase.
 *  2. Intenta subirlo a Drive.
 *  3. Si éxito → actualiza la URL en DB, borra de Supabase y elimina de la cola.
 *  4. Si falla → incrementa contador y sigue.
 */
export async function processDriveQueue(teacherId?: string): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  const items = await prisma.driveUploadQueue.findMany({
    where: teacherId ? { teacherId } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  for (const item of items) {
    result.processed++;

    try {
      // 1. Descargar el archivo desde Supabase
      const fileResponse = await fetch(item.supabaseUrl);
      if (!fileResponse.ok) {
        throw new Error(`No se pudo descargar desde Supabase: ${fileResponse.statusText}`);
      }
      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Subir a Google Drive
      const uploadResult = await uploadToGoogleDrive(
        buffer,
        item.filename,
        item.mimeType,
        item.teacherId,
        item.folderPath
      );

      // 3a. Actualizar la URL en la base de datos
      if (item.recordType === 'RESOURCE') {
        await prisma.resource.update({
          where: { id: item.recordId },
          data: { url: uploadResult.url, gdriveEmail: uploadResult.email },
        });
      } else if (item.recordType === 'SUBMISSION') {
        await prisma.submission.update({
          where: { id: item.recordId },
          data: { fileUrl: uploadResult.url, gdriveEmail: uploadResult.email },
        });
      }

      // 3b. Eliminar el archivo de Supabase Storage
      const bucket = 'aula-virtual';
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([item.supabasePath]);

      if (deleteError) {
        // No es crítico: el archivo ya está en Drive. Solo advertimos.
        console.warn(`[DriveQueue] No se pudo borrar de Supabase (${item.supabasePath}):`, deleteError.message);
      }

      // 3c. Eliminar de la cola
      await prisma.driveUploadQueue.delete({ where: { id: item.id } });

      result.succeeded++;
    } catch (err: any) {
      result.failed++;
      const msg = err?.message || String(err);
      result.errors.push(`[${item.recordType}:${item.recordId}] ${msg}`);

      // Actualizar contador de intentos
      await prisma.driveUploadQueue.update({
        where: { id: item.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
    }
  }

  return result;
}

/**
 * Devuelve cuántos ítems hay en cola para un docente.
 */
export async function getDriveQueueCount(teacherId: string): Promise<number> {
  return prisma.driveUploadQueue.count({ where: { teacherId } });
}
