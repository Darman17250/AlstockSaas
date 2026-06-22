import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import { activity, member, taskDocument, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_DOCUMENT_SIZE, isAllowedMimeType } from '@/validation/deal-document'

/**
 * Services — pièces jointes des tâches (images et documents).
 * Cloisonnement multi-tenant : toute requête filtre `organizationId = ctx.organizationId`.
 * Réutilise l'allowlist MIME / la taille max des documents d'affaire.
 */

/** Vérifie qu'une tâche (`activity` type `tache`) appartient à l'organisation. */
const assertTaskInOrg = async (ctx: OrgContext, taskId: string): Promise<void> => {
  const [row] = await db
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.id, taskId),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, 'tache')
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Tâche introuvable')
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface TaskDocumentItem {
  id: string
  fileName: string
  mimeType: string | null
  size: number | null
  uploadedByName: string | null
  createdAt: Date
}

export const listTaskDocuments = async (
  ctx: OrgContext,
  taskId: string
): Promise<TaskDocumentItem[]> => {
  requirePermission(ctx, 'activity', 'read')

  return db
    .select({
      id: taskDocument.id,
      fileName: taskDocument.fileName,
      mimeType: taskDocument.mimeType,
      size: taskDocument.size,
      uploadedByName: user.name,
      createdAt: taskDocument.createdAt,
    })
    .from(taskDocument)
    .leftJoin(member, eq(taskDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(taskDocument.taskId, taskId), eq(taskDocument.organizationId, ctx.organizationId))
    )
    .orderBy(desc(taskDocument.createdAt))
}

export const uploadTaskDocument = async (
  ctx: OrgContext,
  input: { taskId: string; file: File }
) => {
  requirePermission(ctx, 'activity', 'update')
  await assertTaskInOrg(ctx, input.taskId)

  const { file, taskId } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${ctx.organizationId}/tasks/${taskId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(taskDocument)
    .values({
      organizationId: ctx.organizationId,
      taskId,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      uploadedById: ctx.memberId,
    })
    .returning()

  return created
}

export const getTaskDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'activity', 'read')

  const [row] = await db
    .select({ storagePath: taskDocument.storagePath, fileName: taskDocument.fileName })
    .from(taskDocument)
    .where(
      and(eq(taskDocument.id, documentId), eq(taskDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

export const deleteTaskDocument = async (ctx: OrgContext, documentId: string): Promise<void> => {
  requirePermission(ctx, 'activity', 'update')

  const [row] = await db
    .select({ id: taskDocument.id, storagePath: taskDocument.storagePath })
    .from(taskDocument)
    .where(
      and(eq(taskDocument.id, documentId), eq(taskDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(taskDocument).where(eq(taskDocument.id, row.id))
}
