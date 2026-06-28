import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm'

import { db } from '@/database'
import {
  activity,
  member,
  site,
  siteMessage,
  siteMessageAttachment,
  siteMessageMention,
  user,
} from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { createSignedDownloadUrl, uploadObject } from '@/lib/supabase-storage'
import {
  MAX_ATTACHMENTS,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  MAX_MESSAGE_LENGTH,
  classifyAttachment,
} from '@/validation/site-message'

/**
 * Services — discussion de chantier (chat). Couche métier pure.
 * Cloisonnement multi-tenant : toute requête filtre `organizationId = ctx.organizationId`.
 * Lecture/écriture = `site:read` (le terrain doit pouvoir participer) ;
 * suppression d'un message = son auteur ou `site:update`.
 */

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

/** Restreint une liste d'ids de membres à ceux réellement présents dans l'org. */
const filterMembersInOrg = async (ctx: OrgContext, ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return []
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(inArray(member.id, ids), eq(member.organizationId, ctx.organizationId)))
  return rows.map((r) => r.id)
}

/** Restreint une liste d'ids de tâches à celles de l'org (type `tache`). */
const filterTasksInOrg = async (ctx: OrgContext, ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return []
  const rows = await db
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        inArray(activity.id, ids),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, 'tache')
      )
    )
  return rows.map((r) => r.id)
}

const sanitizeFileName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'fichier'

export interface MessageMentionView {
  type: 'member' | 'task'
  id: string
  label: string
}

export interface MessageAttachmentView {
  id: string
  kind: 'image' | 'audio'
  fileName: string
  mimeType: string | null
  durationMs: number | null
}

export interface SiteMessageItem {
  id: string
  body: string | null
  createdAt: Date
  authorId: string | null
  authorName: string | null
  isOwn: boolean
  mentions: MessageMentionView[]
  attachments: MessageAttachmentView[]
}

interface ListOptions {
  since?: Date
  limit?: number
}

export const listSiteMessages = async (
  ctx: OrgContext,
  siteId: string,
  opts: ListOptions = {}
): Promise<SiteMessageItem[]> => {
  requirePermission(ctx, 'site', 'read')

  const base = [
    eq(siteMessage.siteId, siteId),
    eq(siteMessage.organizationId, ctx.organizationId),
    isNull(siteMessage.deletedAt),
  ]
  if (opts.since) base.push(gt(siteMessage.createdAt, opts.since))

  const select = {
    id: siteMessage.id,
    body: siteMessage.body,
    createdAt: siteMessage.createdAt,
    authorId: siteMessage.authorId,
    authorName: user.name,
    authorEmail: user.email,
  }

  const rows = opts.since
    ? await db
        .select(select)
        .from(siteMessage)
        .leftJoin(member, eq(siteMessage.authorId, member.id))
        .leftJoin(user, eq(member.userId, user.id))
        .where(and(...base))
        .orderBy(asc(siteMessage.createdAt))
    : (
        await db
          .select(select)
          .from(siteMessage)
          .leftJoin(member, eq(siteMessage.authorId, member.id))
          .leftJoin(user, eq(member.userId, user.id))
          .where(and(...base))
          .orderBy(desc(siteMessage.createdAt))
          .limit(opts.limit ?? 200)
      ).reverse()

  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const mentionRows = await db
    .select({
      messageId: siteMessageMention.messageId,
      memberId: siteMessageMention.memberId,
      memberName: user.name,
      memberEmail: user.email,
      taskId: siteMessageMention.taskId,
      taskSubject: activity.subject,
    })
    .from(siteMessageMention)
    .leftJoin(member, eq(siteMessageMention.memberId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .leftJoin(activity, eq(siteMessageMention.taskId, activity.id))
    .where(
      and(
        inArray(siteMessageMention.messageId, ids),
        eq(siteMessageMention.organizationId, ctx.organizationId)
      )
    )

  const attachmentRows = await db
    .select({
      id: siteMessageAttachment.id,
      messageId: siteMessageAttachment.messageId,
      kind: siteMessageAttachment.kind,
      fileName: siteMessageAttachment.fileName,
      mimeType: siteMessageAttachment.mimeType,
      durationMs: siteMessageAttachment.durationMs,
    })
    .from(siteMessageAttachment)
    .where(
      and(
        inArray(siteMessageAttachment.messageId, ids),
        eq(siteMessageAttachment.organizationId, ctx.organizationId)
      )
    )

  const mentionsByMessage = new Map<string, MessageMentionView[]>()
  for (const m of mentionRows) {
    const list = mentionsByMessage.get(m.messageId) ?? []
    if (m.memberId) {
      list.push({ type: 'member', id: m.memberId, label: m.memberName || m.memberEmail || '?' })
    } else if (m.taskId) {
      list.push({ type: 'task', id: m.taskId, label: m.taskSubject ?? 'Tâche' })
    }
    mentionsByMessage.set(m.messageId, list)
  }

  const attachmentsByMessage = new Map<string, MessageAttachmentView[]>()
  for (const a of attachmentRows) {
    const list = attachmentsByMessage.get(a.messageId) ?? []
    list.push({
      id: a.id,
      kind: a.kind,
      fileName: a.fileName,
      mimeType: a.mimeType,
      durationMs: a.durationMs,
    })
    attachmentsByMessage.set(a.messageId, list)
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    authorId: r.authorId,
    authorName: r.authorName || r.authorEmail,
    isOwn: r.authorId === ctx.memberId,
    mentions: mentionsByMessage.get(r.id) ?? [],
    attachments: attachmentsByMessage.get(r.id) ?? [],
  }))
}

export interface CreateSiteMessageInput {
  siteId: string
  body?: string
  memberIds?: string[]
  taskIds?: string[]
  attachments?: { file: File; durationMs?: number }[]
}

export const createSiteMessage = async (
  ctx: OrgContext,
  input: CreateSiteMessageInput
): Promise<{ id: string }> => {
  requirePermission(ctx, 'site', 'read')
  await assertSiteInOrg(ctx, input.siteId)

  const body = input.body?.trim() ? input.body.trim().slice(0, MAX_MESSAGE_LENGTH) : null
  const files = input.attachments ?? []

  if (!body && files.length === 0) {
    throw new ForbiddenError('Message vide')
  }
  if (files.length > MAX_ATTACHMENTS) {
    throw new ForbiddenError(`Trop de pièces jointes (max ${MAX_ATTACHMENTS})`)
  }

  // On ne conserve que des mentions valides pour l'org (défense en profondeur).
  const memberIds = await filterMembersInOrg(ctx, input.memberIds ?? [])
  const taskIds = await filterTasksInOrg(ctx, input.taskIds ?? [])

  // Upload des pièces jointes au stockage (hors transaction DB).
  const uploaded: {
    kind: 'image' | 'audio'
    storagePath: string
    fileName: string
    mimeType: string
    size: number
    durationMs: number | null
  }[] = []

  for (const { file, durationMs } of files) {
    const mimeType = file.type || 'application/octet-stream'
    const kind = classifyAttachment(mimeType)
    if (!kind) throw new ForbiddenError('Type de pièce jointe non autorisé')
    const maxSize = kind === 'image' ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE
    if (file.size <= 0 || file.size > maxSize) {
      throw new ForbiddenError('Pièce jointe vide ou trop volumineuse')
    }
    const safeName = sanitizeFileName(file.name)
    const storagePath = `${ctx.organizationId}/sites/${input.siteId}/chat/${randomUUID()}-${safeName}`
    await uploadObject(storagePath, file, mimeType)
    uploaded.push({
      kind,
      storagePath,
      fileName: file.name.slice(0, 255),
      mimeType,
      size: file.size,
      durationMs: kind === 'audio' && durationMs ? Math.round(durationMs) : null,
    })
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(siteMessage)
      .values({
        organizationId: ctx.organizationId,
        siteId: input.siteId,
        authorId: ctx.memberId,
        body,
      })
      .returning({ id: siteMessage.id })

    if (memberIds.length > 0 || taskIds.length > 0) {
      await tx.insert(siteMessageMention).values([
        ...memberIds.map((memberId) => ({
          organizationId: ctx.organizationId,
          messageId: created.id,
          memberId,
        })),
        ...taskIds.map((taskId) => ({
          organizationId: ctx.organizationId,
          messageId: created.id,
          taskId,
        })),
      ])
    }

    if (uploaded.length > 0) {
      await tx.insert(siteMessageAttachment).values(
        uploaded.map((u) => ({
          organizationId: ctx.organizationId,
          messageId: created.id,
          kind: u.kind,
          storagePath: u.storagePath,
          fileName: u.fileName,
          mimeType: u.mimeType,
          size: u.size,
          durationMs: u.durationMs,
        }))
      )
    }

    return { id: created.id }
  })
}

/** Supprime (soft) un message : son auteur, ou un gestionnaire `site:update`. */
export const deleteSiteMessage = async (ctx: OrgContext, messageId: string): Promise<void> => {
  requirePermission(ctx, 'site', 'read')

  const [row] = await db
    .select({ id: siteMessage.id, authorId: siteMessage.authorId })
    .from(siteMessage)
    .where(
      and(
        eq(siteMessage.id, messageId),
        eq(siteMessage.organizationId, ctx.organizationId),
        isNull(siteMessage.deletedAt)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Message introuvable')

  const isOwn = row.authorId === ctx.memberId
  if (!isOwn && !can(ctx, 'site', 'update')) {
    throw new ForbiddenError('Suppression non autorisée')
  }

  await db
    .update(siteMessage)
    .set({ deletedAt: new Date() })
    .where(and(eq(siteMessage.id, messageId), eq(siteMessage.organizationId, ctx.organizationId)))
}

/** URL signée temporaire pour afficher/lire une pièce jointe (bucket privé). */
export const getSiteMessageAttachmentDownload = async (
  ctx: OrgContext,
  attachmentId: string
): Promise<{ url: string; fileName: string }> => {
  requirePermission(ctx, 'site', 'read')

  const [row] = await db
    .select({
      storagePath: siteMessageAttachment.storagePath,
      fileName: siteMessageAttachment.fileName,
    })
    .from(siteMessageAttachment)
    .where(
      and(
        eq(siteMessageAttachment.id, attachmentId),
        eq(siteMessageAttachment.organizationId, ctx.organizationId)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Pièce jointe introuvable')

  const url = await createSignedDownloadUrl(row.storagePath)
  return { url, fileName: row.fileName }
}
