import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { member, tool, toolDocument, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_DOCUMENT_SIZE, isAllowedMimeType } from '@/validation/deal-document'
import type { ToolDocumentMetaInput } from '@/validation/tool-document'

/**
 * Services — documents d'un matériel (facture, manuel, garantie, photo…).
 * Cloisonnement multi-tenant : toute requête filtre `organizationId`.
 * Permissions calquées sur la ressource `tool`. Hard-delete (ligne + objet bucket).
 */

const assertToolInOrg = async (ctx: OrgContext, toolId: string): Promise<void> => {
  const [row] = await db
    .select({ id: tool.id })
    .from(tool)
    .where(
      and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Matériel introuvable')
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface ToolDocumentItem {
  id: string
  category: string | null
  fileName: string
  mimeType: string | null
  size: number | null
  uploadedByName: string | null
  createdAt: Date
}

export const listToolDocuments = async (
  ctx: OrgContext,
  toolId: string
): Promise<ToolDocumentItem[]> => {
  requirePermission(ctx, 'tool', 'read')

  return db
    .select({
      id: toolDocument.id,
      category: toolDocument.category,
      fileName: toolDocument.fileName,
      mimeType: toolDocument.mimeType,
      size: toolDocument.size,
      uploadedByName: user.name,
      createdAt: toolDocument.createdAt,
    })
    .from(toolDocument)
    .leftJoin(member, eq(toolDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(toolDocument.toolId, toolId), eq(toolDocument.organizationId, ctx.organizationId))
    )
    .orderBy(desc(toolDocument.createdAt))
}

export const uploadToolDocument = async (
  ctx: OrgContext,
  input: { toolId: string; file: File; meta?: ToolDocumentMetaInput }
) => {
  requirePermission(ctx, 'tool', 'update')
  await assertToolInOrg(ctx, input.toolId)

  const { file, toolId, meta } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${ctx.organizationId}/tools/${toolId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(toolDocument)
    .values({
      organizationId: ctx.organizationId,
      toolId,
      category: meta?.category ?? null,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      uploadedById: ctx.memberId,
    })
    .returning()

  return created
}

export const getToolDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'tool', 'read')

  const [row] = await db
    .select({ storagePath: toolDocument.storagePath, fileName: toolDocument.fileName })
    .from(toolDocument)
    .where(and(eq(toolDocument.id, documentId), eq(toolDocument.organizationId, ctx.organizationId)))
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

export const deleteToolDocument = async (ctx: OrgContext, documentId: string): Promise<void> => {
  requirePermission(ctx, 'tool', 'update')

  const [row] = await db
    .select({ id: toolDocument.id, storagePath: toolDocument.storagePath })
    .from(toolDocument)
    .where(and(eq(toolDocument.id, documentId), eq(toolDocument.organizationId, ctx.organizationId)))
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(toolDocument).where(eq(toolDocument.id, row.id))
}
