import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { member, tool, toolMaintenance, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type {
  ToolMaintenanceCreateInput,
  ToolMaintenanceUpdateInput,
} from '@/validation/tool-maintenance'
import { recalcToolNextMaintenance } from './tool'

/**
 * Services — entretiens d'un matériel (historique). Couche métier pure.
 * Cloisonnement multi-tenant : filtre `organizationId` partout.
 * À chaque écriture : recalcule `tool.nextMaintenanceDate` et remonte le
 * compteur horaire du matériel si l'entretien renseigne un compteur plus récent.
 */

/** Vérifie que le matériel appartient à l'org et renvoie son compteur courant. */
const assertToolInOrg = async (
  ctx: OrgContext,
  toolId: string
): Promise<{ engineHours: number | null }> => {
  const [row] = await db
    .select({ engineHours: tool.engineHours })
    .from(tool)
    .where(
      and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Matériel introuvable')
  return { engineHours: row.engineHours }
}

const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Intervenant invalide pour cette organisation')
}

/** Renvoie le `toolId` d'un entretien de l'org (pour les MAJ/suppressions). */
const getMaintenanceToolId = async (ctx: OrgContext, id: string): Promise<string> => {
  const [row] = await db
    .select({ toolId: toolMaintenance.toolId })
    .from(toolMaintenance)
    .where(
      and(
        eq(toolMaintenance.id, id),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Entretien introuvable')
  return row.toolId
}

/** Remonte le compteur horaire du matériel si l'entretien fournit un compteur supérieur. */
const bumpEngineHours = async (
  ctx: OrgContext,
  toolId: string,
  current: number | null,
  hours: number | undefined
): Promise<void> => {
  if (hours === undefined) return
  if (current !== null && hours <= current) return
  await db
    .update(tool)
    .set({ engineHours: hours })
    .where(and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId)))
}

export interface ToolMaintenanceItem {
  id: string
  type: string
  performedAt: string
  performedById: string | null
  performedByName: string | null
  provider: string | null
  hours: number | null
  cost: string | null
  description: string | null
  nextDueDate: string | null
  nextDueHours: number | null
}

export interface ToolMaintenanceListResult {
  items: ToolMaintenanceItem[]
  totalCost: number
}

export const listMaintenanceForTool = async (
  ctx: OrgContext,
  toolId: string
): Promise<ToolMaintenanceListResult> => {
  requirePermission(ctx, 'toolMaintenance', 'read')

  const items = await db
    .select({
      id: toolMaintenance.id,
      type: toolMaintenance.type,
      performedAt: toolMaintenance.performedAt,
      performedById: toolMaintenance.performedById,
      performedByName: user.name,
      provider: toolMaintenance.provider,
      hours: toolMaintenance.hours,
      cost: toolMaintenance.cost,
      description: toolMaintenance.description,
      nextDueDate: toolMaintenance.nextDueDate,
      nextDueHours: toolMaintenance.nextDueHours,
    })
    .from(toolMaintenance)
    .leftJoin(member, eq(toolMaintenance.performedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(toolMaintenance.toolId, toolId),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )
    .orderBy(desc(toolMaintenance.performedAt), desc(toolMaintenance.createdAt))

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${toolMaintenance.cost}), 0)::float` })
    .from(toolMaintenance)
    .where(
      and(
        eq(toolMaintenance.toolId, toolId),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )

  return { items, totalCost: total }
}

const toColumns = (input: ToolMaintenanceCreateInput | ToolMaintenanceUpdateInput) => ({
  type: input.type,
  performedAt: input.performedAt,
  performedById: input.performedById ?? null,
  provider: input.provider ?? null,
  hours: input.hours ?? null,
  cost: input.cost === undefined ? null : input.cost.toString(),
  description: input.description ?? null,
  nextDueDate: input.nextDueDate ?? null,
  nextDueHours: input.nextDueHours ?? null,
})

export const createToolMaintenance = async (ctx: OrgContext, input: ToolMaintenanceCreateInput) => {
  requirePermission(ctx, 'toolMaintenance', 'create')
  const { engineHours } = await assertToolInOrg(ctx, input.toolId)
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  const [created] = await db
    .insert(toolMaintenance)
    .values({ ...toColumns(input), toolId: input.toolId, organizationId: ctx.organizationId })
    .returning({ id: toolMaintenance.id })

  await bumpEngineHours(ctx, input.toolId, engineHours, input.hours)
  await recalcToolNextMaintenance(ctx, input.toolId)
  return created
}

export const updateToolMaintenance = async (
  ctx: OrgContext,
  id: string,
  input: ToolMaintenanceUpdateInput
) => {
  requirePermission(ctx, 'toolMaintenance', 'update')
  const toolId = await getMaintenanceToolId(ctx, id)
  const { engineHours } = await assertToolInOrg(ctx, toolId)
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  const [updated] = await db
    .update(toolMaintenance)
    .set(toColumns(input))
    .where(
      and(
        eq(toolMaintenance.id, id),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )
    .returning({ id: toolMaintenance.id })

  if (!updated) throw new NotFoundError('Entretien introuvable')

  await bumpEngineHours(ctx, toolId, engineHours, input.hours)
  await recalcToolNextMaintenance(ctx, toolId)
  return updated
}

export const softDeleteToolMaintenance = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'toolMaintenance', 'delete')
  const toolId = await getMaintenanceToolId(ctx, id)

  const [deleted] = await db
    .update(toolMaintenance)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(toolMaintenance.id, id),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )
    .returning({ id: toolMaintenance.id })

  if (!deleted) throw new NotFoundError('Entretien introuvable')

  await recalcToolNextMaintenance(ctx, toolId)
}
