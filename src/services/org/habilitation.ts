import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm'

import { db } from '@/database'
import { member, memberHabilitation, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import { MAX_DOCUMENT_SIZE, isAllowedMimeType } from '@/validation/deal-document'
import type { HabilitationInput } from '@/validation/habilitation'

/**
 * Services — habilitations/certifications BTP d'un membre (CACES, travail en hauteur…).
 * Cloisonnement multi-tenant : toute requête filtre `organizationId`.
 * Document inline (un courant par habilitation ; le renouvellement remplace le fichier).
 */

/** Seuil d'alerte d'expiration (jours), partagé UI + service. */
export const HABILITATION_EXPIRY_WARN_DAYS = 30

export type HabilitationStatus = 'valide' | 'expire_bientot' | 'expiree'

const pad = (n: number) => String(n).padStart(2, '0')
const dateKeyInDays = (offsetDays: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Statut dérivé de la date d'expiration (comparaison lexicographique YYYY-MM-DD). */
export const habilitationStatus = (expiresAt: string | null): HabilitationStatus => {
  if (!expiresAt) return 'valide'
  const today = dateKeyInDays(0)
  if (expiresAt < today) return 'expiree'
  if (expiresAt <= dateKeyInDays(HABILITATION_EXPIRY_WARN_DAYS)) return 'expire_bientot'
  return 'valide'
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'document'

const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new NotFoundError('Membre introuvable')
}

const assertFile = (file: File): { mimeType: string } => {
  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) throw new ForbiddenError('Type de fichier non autorisé')
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
    throw new ForbiddenError('Fichier vide ou trop volumineux (max 20 Mo)')
  }
  return { mimeType }
}

export interface HabilitationItem {
  id: string
  type: string
  name: string
  issuer: string | null
  reference: string | null
  issuedAt: string | null
  expiresAt: string | null
  status: HabilitationStatus
  fileName: string | null
  mimeType: string | null
  size: number | null
  hasDocument: boolean
  uploadedByName: string | null
  createdAt: Date
}

export const listMemberHabilitations = async (
  ctx: OrgContext,
  memberId: string
): Promise<HabilitationItem[]> => {
  requirePermission(ctx, 'habilitation', 'read')

  const rows = await db
    .select({
      id: memberHabilitation.id,
      type: memberHabilitation.type,
      name: memberHabilitation.name,
      issuer: memberHabilitation.issuer,
      reference: memberHabilitation.reference,
      issuedAt: memberHabilitation.issuedAt,
      expiresAt: memberHabilitation.expiresAt,
      storagePath: memberHabilitation.storagePath,
      fileName: memberHabilitation.fileName,
      mimeType: memberHabilitation.mimeType,
      size: memberHabilitation.size,
      uploadedByName: user.name,
      createdAt: memberHabilitation.createdAt,
    })
    .from(memberHabilitation)
    .leftJoin(member, eq(memberHabilitation.uploadedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(memberHabilitation.memberId, memberId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
    .orderBy(asc(memberHabilitation.expiresAt), desc(memberHabilitation.createdAt))

  return rows.map(({ storagePath, ...r }) => ({
    ...r,
    status: habilitationStatus(r.expiresAt),
    hasDocument: Boolean(storagePath),
  }))
}

export const createHabilitation = async (
  ctx: OrgContext,
  input: { memberId: string; meta: HabilitationInput; file?: File }
) => {
  requirePermission(ctx, 'habilitation', 'create')
  await assertMemberInOrg(ctx, input.memberId)

  const { memberId, meta, file } = input
  let storagePath: string | null = null
  let mimeType: string | null = null

  if (file) {
    const checked = assertFile(file)
    mimeType = checked.mimeType
    storagePath = `${ctx.organizationId}/members/${memberId}/habilitations/${randomUUID()}-${sanitizeFileName(file.name)}`
    await uploadObject(storagePath, file, mimeType)
  }

  const [created] = await db
    .insert(memberHabilitation)
    .values({
      organizationId: ctx.organizationId,
      memberId,
      type: meta.type,
      name: meta.name,
      issuer: meta.issuer ?? null,
      reference: meta.reference ?? null,
      issuedAt: meta.issuedAt ?? null,
      expiresAt: meta.expiresAt ?? null,
      storagePath,
      fileName: file ? file.name.slice(0, 255) : null,
      mimeType,
      size: file ? file.size : null,
      uploadedById: file ? ctx.memberId : null,
    })
    .returning()

  return created
}

export const updateHabilitation = async (
  ctx: OrgContext,
  input: { habId: string; meta: HabilitationInput; file?: File }
) => {
  requirePermission(ctx, 'habilitation', 'update')

  const { habId, meta, file } = input
  const [existing] = await db
    .select({ id: memberHabilitation.id, storagePath: memberHabilitation.storagePath })
    .from(memberHabilitation)
    .where(
      and(
        eq(memberHabilitation.id, habId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
    .limit(1)
  if (!existing) throw new NotFoundError('Habilitation introuvable')

  const fields: Record<string, unknown> = {
    type: meta.type,
    name: meta.name,
    issuer: meta.issuer ?? null,
    reference: meta.reference ?? null,
    issuedAt: meta.issuedAt ?? null,
    expiresAt: meta.expiresAt ?? null,
  }

  // Renouvellement : remplace le fichier courant (upload puis suppression de l'ancien).
  if (file) {
    const { mimeType } = assertFile(file)
    const storagePath = `${ctx.organizationId}/members/${input.habId}/habilitations/${randomUUID()}-${sanitizeFileName(file.name)}`
    await uploadObject(storagePath, file, mimeType)
    fields.storagePath = storagePath
    fields.fileName = file.name.slice(0, 255)
    fields.mimeType = mimeType
    fields.size = file.size
    fields.uploadedById = ctx.memberId
  }

  await db
    .update(memberHabilitation)
    .set(fields)
    .where(
      and(
        eq(memberHabilitation.id, habId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )

  if (file && existing.storagePath) await deleteObject(existing.storagePath)
}

export const getHabilitationDocumentDownload = async (
  ctx: OrgContext,
  habId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'habilitation', 'read')

  const [row] = await db
    .select({ storagePath: memberHabilitation.storagePath, fileName: memberHabilitation.fileName })
    .from(memberHabilitation)
    .where(
      and(
        eq(memberHabilitation.id, habId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
    .limit(1)
  if (!row?.storagePath) throw new NotFoundError('Document introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName ?? 'document' }
}

export const deleteHabilitationDocument = async (ctx: OrgContext, habId: string): Promise<void> => {
  requirePermission(ctx, 'habilitation', 'update')

  const [row] = await db
    .select({ id: memberHabilitation.id, storagePath: memberHabilitation.storagePath })
    .from(memberHabilitation)
    .where(
      and(
        eq(memberHabilitation.id, habId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Habilitation introuvable')

  if (row.storagePath) await deleteObject(row.storagePath)
  await db
    .update(memberHabilitation)
    .set({ storagePath: null, fileName: null, mimeType: null, size: null, uploadedById: null })
    .where(
      and(
        eq(memberHabilitation.id, row.id),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
}

export const deleteHabilitation = async (ctx: OrgContext, habId: string): Promise<void> => {
  requirePermission(ctx, 'habilitation', 'delete')

  const [row] = await db
    .select({ id: memberHabilitation.id, storagePath: memberHabilitation.storagePath })
    .from(memberHabilitation)
    .where(
      and(
        eq(memberHabilitation.id, habId),
        eq(memberHabilitation.organizationId, ctx.organizationId)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Habilitation introuvable')

  if (row.storagePath) await deleteObject(row.storagePath)
  await db.delete(memberHabilitation).where(eq(memberHabilitation.id, row.id))
}

export interface ExpiringHabilitationItem {
  id: string
  memberId: string
  memberName: string | null
  type: string
  name: string
  expiresAt: string
  status: HabilitationStatus
}

/**
 * Habilitations expirées ou expirant sous `withinDays`, de l'org, triées par date.
 * Réutilisable par un futur canal d'alerte email.
 */
export const listExpiringHabilitations = async (
  ctx: OrgContext,
  withinDays = HABILITATION_EXPIRY_WARN_DAYS
): Promise<ExpiringHabilitationItem[]> => {
  requirePermission(ctx, 'habilitation', 'read')

  const threshold = dateKeyInDays(withinDays)
  const rows = await db
    .select({
      id: memberHabilitation.id,
      memberId: memberHabilitation.memberId,
      memberName: user.name,
      type: memberHabilitation.type,
      name: memberHabilitation.name,
      expiresAt: memberHabilitation.expiresAt,
    })
    .from(memberHabilitation)
    .leftJoin(member, eq(memberHabilitation.memberId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(memberHabilitation.organizationId, ctx.organizationId),
        isNotNull(memberHabilitation.expiresAt),
        lte(memberHabilitation.expiresAt, threshold)
      )
    )
    .orderBy(asc(memberHabilitation.expiresAt))

  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    memberName: r.memberName,
    type: r.type,
    name: r.name,
    expiresAt: r.expiresAt as string,
    status: habilitationStatus(r.expiresAt),
  }))
}
