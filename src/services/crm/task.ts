import 'server-only'
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm'

import { db } from '@/database'
import {
  activity,
  client,
  deal,
  equipment,
  member,
  site,
  taskAssignee,
  user,
} from '@/database/schema'
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

const assertEquipmentInOrg = async (ctx: OrgContext, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.id, id),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Équipement introuvable')
}

/** Vérifie tous les liens fournis (client/affaire/chantier/équipement/assigné). */
const assertLinks = async (
  ctx: OrgContext,
  input: TaskCreateInput | TaskUpdateInput
): Promise<void> => {
  if (input.clientId) await assertClientInOrg(ctx, input.clientId)
  if (input.dealId) await assertDealInOrg(ctx, input.dealId)
  if (input.siteId) await assertSiteInOrg(ctx, input.siteId)
  if (input.equipmentId) await assertEquipmentInOrg(ctx, input.equipmentId)
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
  equipmentId: input.equipmentId ?? null,
})

export interface TaskCoAssignee {
  id: string
  name: string
}

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
  coAssignees: TaskCoAssignee[]
}

type TaskRow = Omit<TaskItem, 'coAssignees'>

/** Restreint une liste d'ids de membres à ceux réellement présents dans l'org. */
const filterMembersInOrg = async (ctx: OrgContext, ids: string[]): Promise<string[]> => {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return []
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(and(inArray(member.id, uniq), eq(member.organizationId, ctx.organizationId)))
  return rows.map((r) => r.id)
}

/** Co-assignés valides (dans l'org, dédupliqués, hors responsable). */
const validCoAssignees = async (
  ctx: OrgContext,
  input: TaskCreateInput | TaskUpdateInput
): Promise<string[]> => {
  const ids = (input.coAssigneeIds ?? []).filter((id) => id && id !== input.assigneeId)
  return filterMembersInOrg(ctx, ids)
}

/** Attache les co-assignés (table `task_assignee`) à une liste de tâches. */
const attachCoAssignees = async (ctx: OrgContext, rows: TaskRow[]): Promise<TaskItem[]> => {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const coRows = await db
    .select({
      taskId: taskAssignee.taskId,
      memberId: taskAssignee.memberId,
      name: user.name,
      email: user.email,
    })
    .from(taskAssignee)
    .innerJoin(member, eq(taskAssignee.memberId, member.id))
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(inArray(taskAssignee.taskId, ids), eq(taskAssignee.organizationId, ctx.organizationId))
    )

  const byTask = new Map<string, TaskCoAssignee[]>()
  for (const c of coRows) {
    const list = byTask.get(c.taskId) ?? []
    list.push({ id: c.memberId, name: c.name || c.email })
    byTask.set(c.taskId, list)
  }
  return rows.map((r) => ({ ...r, coAssignees: byTask.get(r.id) ?? [] }))
}

/** Sous-requête : ids de tâches où le membre est co-assigné. */
const coAssignedTaskIds = (ctx: OrgContext, memberId: string) =>
  db
    .select({ id: taskAssignee.taskId })
    .from(taskAssignee)
    .where(
      and(eq(taskAssignee.memberId, memberId), eq(taskAssignee.organizationId, ctx.organizationId))
    )

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

  const rows = await taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        or(
          eq(activity.assigneeId, ctx.memberId),
          inArray(activity.id, coAssignedTaskIds(ctx, ctx.memberId))
        )
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
  return attachCoAssignees(ctx, rows)
}

/** Toutes les tâches de l'organisation (vue « Équipe »), filtrables. */
export const listTeamTasks = async (
  ctx: OrgContext,
  params: TaskListParams
): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')

  const conditions = [eq(activity.organizationId, ctx.organizationId), eq(activity.type, TASK_TYPE)]
  if (params.assigneeId) {
    const assigneeFilter = or(
      eq(activity.assigneeId, params.assigneeId),
      inArray(activity.id, coAssignedTaskIds(ctx, params.assigneeId))
    )
    if (assigneeFilter) conditions.push(assigneeFilter)
  }
  if (params.status) conditions.push(eq(activity.status, params.status))

  const rows = await taskQuery()
    .where(and(...conditions))
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
  return attachCoAssignees(ctx, rows)
}

export const listTasksForDeal = async (ctx: OrgContext, dealId: string): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  const rows = await taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.dealId, dealId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
  return attachCoAssignees(ctx, rows)
}

export const listTasksForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  const rows = await taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.clientId, clientId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
  return attachCoAssignees(ctx, rows)
}

export const listTasksForSite = async (ctx: OrgContext, siteId: string): Promise<TaskItem[]> => {
  requirePermission(ctx, 'activity', 'read')
  const rows = await taskQuery()
    .where(
      and(
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE),
        eq(activity.siteId, siteId)
      )
    )
    .orderBy(asc(activity.dueDate), desc(activity.createdAt))
  return attachCoAssignees(ctx, rows)
}

/** Tâche détaillée (page dédiée) : champs + co-assignés. */
export const getTask = async (ctx: OrgContext, id: string): Promise<TaskItem> => {
  requirePermission(ctx, 'activity', 'read')
  const [row] = await taskQuery()
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        eq(activity.type, TASK_TYPE)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Tâche introuvable')
  const [withCo] = await attachCoAssignees(ctx, [row])
  return withCo
}

export const createTask = async (ctx: OrgContext, input: TaskCreateInput) => {
  requirePermission(ctx, 'activity', 'create')
  await assertLinks(ctx, input)
  const coAssignees = await validCoAssignees(ctx, input)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(activity)
      .values({ ...toColumns(input), organizationId: ctx.organizationId })
      .returning({ id: activity.id })

    if (coAssignees.length > 0) {
      await tx.insert(taskAssignee).values(
        coAssignees.map((memberId) => ({
          organizationId: ctx.organizationId,
          taskId: created.id,
          memberId,
        }))
      )
    }
    return created
  })
}

export const updateTask = async (ctx: OrgContext, id: string, input: TaskUpdateInput) => {
  requirePermission(ctx, 'activity', 'update')
  await assertLinks(ctx, input)
  const coAssignees = await validCoAssignees(ctx, input)

  return db.transaction(async (tx) => {
    const [updated] = await tx
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

    // Remplace l'ensemble des co-assignés.
    await tx
      .delete(taskAssignee)
      .where(and(eq(taskAssignee.taskId, id), eq(taskAssignee.organizationId, ctx.organizationId)))
    if (coAssignees.length > 0) {
      await tx.insert(taskAssignee).values(
        coAssignees.map((memberId) => ({
          organizationId: ctx.organizationId,
          taskId: id,
          memberId,
        }))
      )
    }
    return updated
  })
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
