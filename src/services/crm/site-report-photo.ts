import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { siteReport, siteReportPhoto } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_IMAGE_SIZE, classifyAttachment } from '@/validation/site-message'

/**
 * Services — photos de rapport de chantier (`site_report_photo`, images uniquement).
 * Cloisonnement `organizationId` partout. Hard-delete (cascade du rapport).
 */

/** Vérifie que le rapport appartient à l'org (non supprimé) et renvoie son `siteId`. */
const assertReportInOrg = async (ctx: OrgContext, reportId: string): Promise<string> => {
  const [row] = await db
    .select({ siteId: siteReport.siteId })
    .from(siteReport)
    .where(
      and(
        eq(siteReport.id, reportId),
        eq(siteReport.organizationId, ctx.organizationId),
        isNull(siteReport.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Rapport introuvable')
  return row.siteId
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'photo'

export const uploadSiteReportPhoto = async (
  ctx: OrgContext,
  input: { reportId: string; file: File }
) => {
  requirePermission(ctx, 'report', 'update')
  const siteId = await assertReportInOrg(ctx, input.reportId)

  const { file, reportId } = input
  const mimeType = file.type || 'application/octet-stream'
  if (classifyAttachment(mimeType) !== 'image') {
    throw new ForbiddenError('Seules les images sont acceptées')
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new ForbiddenError('Image vide ou trop volumineuse')
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${ctx.organizationId}/sites/${siteId}/reports/${reportId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(siteReportPhoto)
    .values({
      organizationId: ctx.organizationId,
      reportId,
      storagePath,
      takenAt: new Date(),
    })
    .returning({ id: siteReportPhoto.id })

  return created
}

export const getSiteReportPhotoDownload = async (
  ctx: OrgContext,
  photoId: string
): Promise<{ url: string }> => {
  requirePermission(ctx, 'report', 'read')

  const [row] = await db
    .select({ storagePath: siteReportPhoto.storagePath })
    .from(siteReportPhoto)
    .where(
      and(eq(siteReportPhoto.id, photoId), eq(siteReportPhoto.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Photo introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url }
}

export const deleteSiteReportPhoto = async (ctx: OrgContext, photoId: string): Promise<void> => {
  requirePermission(ctx, 'report', 'update')

  const [row] = await db
    .select({ id: siteReportPhoto.id, storagePath: siteReportPhoto.storagePath })
    .from(siteReportPhoto)
    .where(
      and(eq(siteReportPhoto.id, photoId), eq(siteReportPhoto.organizationId, ctx.organizationId))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Photo introuvable')

  await deleteObject(row.storagePath)
  await db.delete(siteReportPhoto).where(eq(siteReportPhoto.id, row.id))
}
