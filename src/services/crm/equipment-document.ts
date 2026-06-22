import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { equipment, equipmentDocument, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_DOCUMENT_SIZE, isAllowedMimeType } from '@/validation/deal-document'

/**
 * Services — documents/images d'un équipement. Couche métier pure.
 * Cloisonnement multi-tenant : toute requête filtre `organizationId`.
 * Réutilise les constantes/contraintes de `validation/deal-document` (génériques).
 */

const assertEquipmentInOrg = async (ctx: OrgContext, equipmentId: string): Promise<void> => {
  const [row] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.id, equipmentId),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Équipement introuvable')
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

export interface EquipmentDocumentItem {
  id: string
  fileName: string
  mimeType: string | null
  size: number | null
  uploadedByName: string | null
  createdAt: Date
}

export const listEquipmentDocuments = async (
  ctx: OrgContext,
  equipmentId: string
): Promise<EquipmentDocumentItem[]> => {
  requirePermission(ctx, 'equipment', 'read')

  return db
    .select({
      id: equipmentDocument.id,
      fileName: equipmentDocument.fileName,
      mimeType: equipmentDocument.mimeType,
      size: equipmentDocument.size,
      uploadedByName: user.name,
      createdAt: equipmentDocument.createdAt,
    })
    .from(equipmentDocument)
    .leftJoin(member, eq(equipmentDocument.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(equipmentDocument.equipmentId, equipmentId),
        eq(equipmentDocument.organizationId, ctx.organizationId)
      )
    )
    .orderBy(desc(equipmentDocument.createdAt))
}

export const uploadEquipmentDocument = async (
  ctx: OrgContext,
  input: { equipmentId: string; file: File }
) => {
  requirePermission(ctx, 'equipment', 'update')
  await assertEquipmentInOrg(ctx, input.equipmentId)

  const { file, equipmentId } = input
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    throw new ForbiddenError('Type de fichier non autorisé')
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${ctx.organizationId}/equipment/${equipmentId}/${randomUUID()}-${safeName}`

  await uploadObject(storagePath, file, mimeType)

  const [created] = await db
    .insert(equipmentDocument)
    .values({
      organizationId: ctx.organizationId,
      equipmentId,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      uploadedById: ctx.memberId,
    })
    .returning()

  return created
}

export const getEquipmentDocumentDownload = async (
  ctx: OrgContext,
  documentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'equipment', 'read')

  const [row] = await db
    .select({ storagePath: equipmentDocument.storagePath, fileName: equipmentDocument.fileName })
    .from(equipmentDocument)
    .where(
      and(
        eq(equipmentDocument.id, documentId),
        eq(equipmentDocument.organizationId, ctx.organizationId)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}

export const deleteEquipmentDocument = async (
  ctx: OrgContext,
  documentId: string
): Promise<void> => {
  requirePermission(ctx, 'equipment', 'update')

  const [row] = await db
    .select({ id: equipmentDocument.id, storagePath: equipmentDocument.storagePath })
    .from(equipmentDocument)
    .where(
      and(
        eq(equipmentDocument.id, documentId),
        eq(equipmentDocument.organizationId, ctx.organizationId)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Document introuvable')

  await deleteObject(row.storagePath)
  await db.delete(equipmentDocument).where(eq(equipmentDocument.id, row.id))
}
