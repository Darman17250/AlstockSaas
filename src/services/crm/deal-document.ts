import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { deal, dealDocument, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import {
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  isAllowedMimeType,
} from '@/validation/deal-document'

/**
 * Services — documents d'affaire. Couche métier pure.
 * Cloisonnement multi-tenant : toute requête filtre `organizationId = ctx.organizationId`.
 * Les fichiers vivent dans Supabase Storage (bucket privé) ; la base ne stocke que les métadonnées.
 */

/** Vérifie qu'une affaire appartient à l'organisation (et n'est pas supprimée). */
const assertDealInOrg = async (ctx: OrgContext, dealId: string): Promise<void> => {
  const [row] = await db
    .select({ id: deal.id })
    .from(deal)
    .where(
      and(eq(deal.id, dealId), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Affaire introuvable')
}

/** Nettoie un nom de fichier pour l'usage dans un chemin de stockage. */
const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface DealDocumentItem {
  id: string
  fileName: string
  mimeType: string | null
  size: number | null
  uploadedByName: string | null
  createdAt: Date
}

export const listDealDocuments = async (
  ctx: OrgContext,
  dealId: string
): Promise<DealDocumentItem[]> => {
  requirePermission(ctx, 'deal', 'read')

  return db
    .select({
      id: dealDocument.id,
      fileName: dealDocument.fileName,
      mimeType: dealDocument.mimeType,
      size: dealDocument.size,
      uploadedByName: user.name,
      createdAt: dealDocument.createdAt,
    })
    .from(dealDocument)
    .leftJoin(member, eq(dealDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(dealDocument.dealId, dealId), eq(dealDocument.organizationId, ctx.organizationId))
    )
    .orderBy(desc(dealDocument.createdAt))
}

/** Envoie un fichier dans le stockage et enregistre ses métadonnées. */
export const uploadDealDocument = async (
  ctx: OrgContext,
  input: { dealId: string; file: File }
) => {
  requirePermission(ctx, 'deal', 'update')
  await assertDealInOrg(ctx, input.dealId)

  const { file, dealId } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  // Le chemin inclut org + affaire → cloisonnement repris jusque dans le bucket.
  const storagePath = `${ctx.organizationId}/${dealId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(dealDocument)
    .values({
      organizationId: ctx.organizationId,
      dealId,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      uploadedById: ctx.memberId,
    })
    .returning()

  return created
}

/** Renvoie une URL signée temporaire pour lire/télécharger un document. */
export const getDealDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'deal', 'read')

  const [row] = await db
    .select({ storagePath: dealDocument.storagePath, fileName: dealDocument.fileName })
    .from(dealDocument)
    .where(
      and(eq(dealDocument.id, documentId), eq(dealDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

/** Supprime un document : objet du bucket + ligne de métadonnées. */
export const deleteDealDocument = async (ctx: OrgContext, documentId: string): Promise<void> => {
  requirePermission(ctx, 'deal', 'update')

  const [row] = await db
    .select({ id: dealDocument.id, storagePath: dealDocument.storagePath })
    .from(dealDocument)
    .where(
      and(eq(dealDocument.id, documentId), eq(dealDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(dealDocument).where(eq(dealDocument.id, row.id))
}

export { ALLOWED_MIME_TYPES }
