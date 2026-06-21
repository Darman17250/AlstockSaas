import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { member, site, siteDocument, user } from '@/database/schema'
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
} from '@/validation/site-document'

/**
 * Services — documents de chantier. Couche métier pure.
 * Cloisonnement multi-tenant : toute requête filtre `organizationId = ctx.organizationId`.
 * Les fichiers vivent dans Supabase Storage (bucket privé) ; la base ne stocke que les métadonnées.
 */

/** Vérifie qu'un chantier appartient à l'organisation (et n'est pas supprimé). */
const assertSiteInOrg = async (ctx: OrgContext, siteId: string): Promise<void> => {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(
      and(eq(site.id, siteId), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Chantier introuvable')
}

/** Nettoie un nom de fichier pour l'usage dans un chemin de stockage. */
const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface SiteDocumentItem {
  id: string
  fileName: string
  mimeType: string | null
  size: number | null
  uploadedByName: string | null
  createdAt: Date
}

export const listSiteDocuments = async (
  ctx: OrgContext,
  siteId: string
): Promise<SiteDocumentItem[]> => {
  requirePermission(ctx, 'site', 'read')

  return db
    .select({
      id: siteDocument.id,
      fileName: siteDocument.fileName,
      mimeType: siteDocument.mimeType,
      size: siteDocument.size,
      uploadedByName: user.name,
      createdAt: siteDocument.createdAt,
    })
    .from(siteDocument)
    .leftJoin(member, eq(siteDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(siteDocument.siteId, siteId), eq(siteDocument.organizationId, ctx.organizationId))
    )
    .orderBy(desc(siteDocument.createdAt))
}

/** Envoie un fichier dans le stockage et enregistre ses métadonnées. */
export const uploadSiteDocument = async (
  ctx: OrgContext,
  input: { siteId: string; file: File }
) => {
  requirePermission(ctx, 'site', 'update')
  await assertSiteInOrg(ctx, input.siteId)

  const { file, siteId } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  // Le chemin inclut org + chantier → cloisonnement repris jusque dans le bucket.
  const storagePath = `${ctx.organizationId}/sites/${siteId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(siteDocument)
    .values({
      organizationId: ctx.organizationId,
      siteId,
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
export const getSiteDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'site', 'read')

  const [row] = await db
    .select({ storagePath: siteDocument.storagePath, fileName: siteDocument.fileName })
    .from(siteDocument)
    .where(
      and(eq(siteDocument.id, documentId), eq(siteDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

/** Supprime un document : objet du bucket + ligne de métadonnées. */
export const deleteSiteDocument = async (ctx: OrgContext, documentId: string): Promise<void> => {
  requirePermission(ctx, 'site', 'update')

  const [row] = await db
    .select({ id: siteDocument.id, storagePath: siteDocument.storagePath })
    .from(siteDocument)
    .where(
      and(eq(siteDocument.id, documentId), eq(siteDocument.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(siteDocument).where(eq(siteDocument.id, row.id))
}

export { ALLOWED_MIME_TYPES }
