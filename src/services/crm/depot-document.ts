import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { depot, depotDocument, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_DOCUMENT_SIZE, isAllowedMimeType } from '@/validation/deal-document'
import type { DepotDocumentMetaInput } from '@/validation/depot-document'

/**
 * Services — documents d'un dépôt/véhicule (carte grise, assurance, CT…).
 * Cloisonnement multi-tenant : toute requête filtre `organizationId`.
 * Permissions calquées sur la ressource `depot`. Hard-delete (ligne + objet bucket).
 */

const assertDepotInOrg = async (ctx: OrgContext, depotId: string): Promise<void> => {
  const [row] = await db
    .select({ id: depot.id })
    .from(depot)
    .where(
      and(
        eq(depot.id, depotId),
        eq(depot.organizationId, ctx.organizationId),
        isNull(depot.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Dépôt introuvable')
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface DepotDocumentItem {
  id: string
  category: string | null
  fileName: string
  mimeType: string | null
  size: number | null
  expiresAt: string | null
  uploadedByName: string | null
  createdAt: Date
}

export const listDepotDocuments = async (
  ctx: OrgContext,
  depotId: string
): Promise<DepotDocumentItem[]> => {
  requirePermission(ctx, 'depot', 'read')

  return db
    .select({
      id: depotDocument.id,
      category: depotDocument.category,
      fileName: depotDocument.fileName,
      mimeType: depotDocument.mimeType,
      size: depotDocument.size,
      expiresAt: depotDocument.expiresAt,
      uploadedByName: user.name,
      createdAt: depotDocument.createdAt,
    })
    .from(depotDocument)
    .leftJoin(member, eq(depotDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(depotDocument.depotId, depotId), eq(depotDocument.organizationId, ctx.organizationId))
    )
    .orderBy(desc(depotDocument.createdAt))
}

export const uploadDepotDocument = async (
  ctx: OrgContext,
  input: { depotId: string; file: File; meta?: DepotDocumentMetaInput }
) => {
  requirePermission(ctx, 'depot', 'update')
  await assertDepotInOrg(ctx, input.depotId)

  const { file, depotId, meta } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${ctx.organizationId}/depots/${depotId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(depotDocument)
    .values({
      organizationId: ctx.organizationId,
      depotId,
      category: meta?.category ?? null,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      expiresAt: meta?.expiresAt ?? null,
      uploadedById: ctx.memberId,
    })
    .returning()

  return created
}

export const getDepotDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'depot', 'read')

  const [row] = await db
    .select({ storagePath: depotDocument.storagePath, fileName: depotDocument.fileName })
    .from(depotDocument)
    .where(
      and(eq(depotDocument.id, documentId), eq(depotDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

export const deleteDepotDocument = async (ctx: OrgContext, documentId: string): Promise<void> => {
  requirePermission(ctx, 'depot', 'update')

  const [row] = await db
    .select({ id: depotDocument.id, storagePath: depotDocument.storagePath })
    .from(depotDocument)
    .where(
      and(eq(depotDocument.id, documentId), eq(depotDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(depotDocument).where(eq(depotDocument.id, row.id))
}
