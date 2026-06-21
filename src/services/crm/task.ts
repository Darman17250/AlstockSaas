import 'server-only'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { activity, client, deal, member, site, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type {
  TaskCreateInput,
  TaskListParams,
  TaskStatusInput,
  TaskUpdateInput,
} from '@/validation/task'

/**
 * Services — tâches (entité `activity`, `type = 'tache'`). Couche métier pure.
 * Toutes les requêtes filtrent `organizationId = ctx.organizationId` ET `type='tache'`
 * (ne touche jamais aux communications). Hard-delete (activité = journal).
 */

const TASK_TYPE = 'tache'

const assertClientInOrg = async (ctx: OrgContext, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: client.id })
    .from(client)
    .where(
      and(
        eq(client.id, id),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Client introuvable')
}

const assertDealInOrg = async (ctx: OrgContext, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: deal.id })
    .from(deal)
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Affaire introuvable')
}

const assertSiteInOrg = async (ctx: OrgContext, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(
      and(eq(site.id, id), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Chantier introuvable')
}

const assertMemberInOrg = async (ctx: OrgContext, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, id), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Assigné invalide pour cette organisation')
}

/** Vérifie tous les liens fournis (client/affaire/chantier/assigné) en une passe. */
const assertLinks = async (
  ctx: OrgContext,
  input: TaskCreateInput | TaskUpdateInput
): Promise<void> => {
  if (input.clientId) await assertClientInOrg(ctx, input.clientId)
  if (input.dealId) await assertDealInOrg(ctx, input.dealId)
  if (input.siteId) await assertSiteInOrg(ctx, input.siteId)
  if (input.assigneeId) await assertMemberInOrg(ctx, input.assigneeId)
}

const toColumns = (input: TaskCreateInput | TaskUpdateInput) => ({
  type: TASK_TYPE as 'tache',
  subject: input.subject,
  description: input.description ?? null,
  dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00`) : null,
  status: input.status,
  completedAt: input.status === 'fait' ? new Date() : null,
  assigneeId: input.assigneeId ?? null,
  clientId: input.clientId ?? null,
  dealId: input.dealId ?? null,
  siteId: input.siteId ?? null,
})

export interface TaskItem {
  id: string
  subject: string
  description: string | null
  dueDate: Date | null
  status: string
  assigneeId: string | null
  assigneeName: string | null
  clientId: string | null
  clientName: string | null
  dealId: string | null
  dealTitle: string | null
  siteId: string | null
  siteName: string | null
}

const taskSelect = {
  id: activity.id,
  subject: activity.subject,
  description: activity.description,
  dueDate: activity.dueDate,
  status: activity.status,
  assigneeId: activity.assigneeId,
  assigneeName: user.name,
  clientId: activity.clientId,
  clientName: client.name,
  dealId: activity.dealId,
  dealTitle: deal.title,
  siteId: activity.siteId,
  siteName: site.name,
}

/** Base de requête tâches, jointe aux libellés des liens. */
const taskQuery = () =>
  db
    .select(taskSelect)
    .from(activity)
    .leftJoin(member, eq(activity.assigneeId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .leftJoin(client, eq(activity.clientId, client.id))
    .leftJoin(deal, eq(activity.dealId, deal.id))
    .leftJoin(site, eq(activity.siteId, site.id))

/** Tâches assignées à l'utilisateur courant (vue « Mes tâches »), hors annulées. */
export const listMyTasks = async (ctx: OrgContext): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')

  return taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.assigneeId, ctx.memberId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
}

/** Toutes les tâches de l'organisation (vue « Équipe »), filtrables. */
export const listTeamTasks = async (
  ctx: OrgContext,
  params: TaskListParams
): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')

  const conditions = [eq(activity.organizationId, ctx.organizationId), eq(activity.type, TASK_TYPE)]
  if (params.assigneeId) conditions.push(eq(activity.assigneeId, params.assigneeId))
  if (params.status) conditions.push(eq(activity.status, params.status))

  return taskQuery()
    .where(and(...conditions))
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
}

export const listTasksForDeal = async (ctx: OrgContext, dealId: string): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  return taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.dealId, dealId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
}

export const listTasksForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  return taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.clientId, clientId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
}

export const listTasksForSite = async (ctx: OrgContext, siteId: string): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  return taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.siteId, siteId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
}

export const createTask = async (ctx: OrgContext, input: TaskCreateInput) => {
  requirePermission(ctx, 'activity', 'create')
  await assertLinks(ctx, input)

  const [created] = await db
    .insert(activity)
    .values({ ...toColumns(input), organizationId: ctx.organizationId })
    .returning({ id: activity.id })
  return created
}

export const updateTask = async (ctx: OrgContext, id: string, input: TaskUpdateInput) => {
  requirePermission(ctx, 'activity', 'update')
  await assertLinks(ctx, input)

  const [updated] = await db
    .update(activity)
    .set(toColumns(input))
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE)
      )
    )
    .returning({ id: activity.id })

  if (!updated) throw new NotFoundError('Tâche introuvable')
  return updated
}

/** Bascule le statut (case à cocher) sans toucher aux autres champs. */
export const setTaskStatus = async (ctx: OrgContext, id: string, input: TaskStatusInput) => {
  requirePermission(ctx, 'activity', 'update')

  const [updated] = await db
    .update(activity)
    .set({
      status: input.status,
      completedAt: input.status === 'fait' ? new Date() : null,
    })
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE)
      )
    )
    .returning({ id: activity.id })

  if (!updated) throw new NotFoundError('Tâche introuvable')
  return updated
}

export const deleteTask = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'activity', 'delete')

  const [deleted] = await db
    .delete(activity)
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE)
      )
    )
    .returning({ id: activity.id })

  if (!deleted) throw new NotFoundError('Tâche introuvable')
}
