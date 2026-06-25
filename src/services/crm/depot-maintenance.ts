import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { depot, depotMaintenance, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type {
  DepotMaintenanceCreateInput,
  DepotMaintenanceUpdateInput,
} from '@/validation/depot-maintenance'
import { recalcDepotNextMaintenance } from './depot'

/**
 * Services — entretiens d'un dépôt/véhicule (historique). Couche métier pure.
 * Cloisonnement multi-tenant : filtre `organizationId` partout.
 * À chaque écriture : recalcule `depot.nextMaintenanceDate` et remonte le
 * kilométrage du dépôt si l'entretien renseigne un km plus récent.
 */

/** Vérifie que le dépôt appartient à l'org et renvoie son kilométrage courant. */
const assertDepotInOrg = async (
  ctx: OrgContext,
  depotId: string
): Promise<{ mileage: number | null }> => {
  const [row] = await db
    .select({ mileage: depot.mileage })
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
  return { mileage: row.mileage }
}

const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Intervenant invalide pour cette organisation')
}

/** Renvoie le `depotId` d'un entretien de l'org (pour les MAJ/suppressions). */
const getMaintenanceDepotId = async (ctx: OrgContext, id: string): Promise<string> => {
  const [row] = await db
    .select({ depotId: depotMaintenance.depotId })
    .from(depotMaintenance)
    .where(
      and(
        eq(depotMaintenance.id, id),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Entretien introuvable')
  return row.depotId
}

/** Remonte le kilométrage du dépôt si l'entretien fournit un km supérieur. */
const bumpDepotMileage = async (
  ctx: OrgContext,
  depotId: string,
  current: number | null,
  mileage: number | undefined
): Promise<void> => {
  if (mileage === undefined) return
  if (current !== null && mileage <= current) return
  await db
    .update(depot)
    .set({ mileage })
    .where(and(eq(depot.id, depotId), eq(depot.organizationId, ctx.organizationId)))
}

export interface DepotMaintenanceItem {
  id: string
  type: string
  performedAt: string
  performedById: string | null
  performedByName: string | null
  provider: string | null
  mileage: number | null
  cost: string | null
  description: string | null
  nextDueDate: string | null
  nextDueMileage: number | null
}

export interface DepotMaintenanceListResult {
  items: DepotMaintenanceItem[]
  totalCost: number
}

export const listMaintenanceForDepot = async (
  ctx: OrgContext,
  depotId: string
): Promise<DepotMaintenanceListResult> => {
  requirePermission(ctx, 'depotMaintenance', 'read')

  const items = await db
    .select({
      id: depotMaintenance.id,
      type: depotMaintenance.type,
      performedAt: depotMaintenance.performedAt,
      performedById: depotMaintenance.performedById,
      performedByName: user.name,
      provider: depotMaintenance.provider,
      mileage: depotMaintenance.mileage,
      cost: depotMaintenance.cost,
      description: depotMaintenance.description,
      nextDueDate: depotMaintenance.nextDueDate,
      nextDueMileage: depotMaintenance.nextDueMileage,
    })
    .from(depotMaintenance)
    .leftJoin(member, eq(depotMaintenance.performedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(depotMaintenance.depotId, depotId),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )
    .orderBy(desc(depotMaintenance.performedAt), desc(depotMaintenance.createdAt))

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${depotMaintenance.cost}), 0)::float` })
    .from(depotMaintenance)
    .where(
      and(
        eq(depotMaintenance.depotId, depotId),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )

  return { items, totalCost: total }
}

const toColumns = (input: DepotMaintenanceCreateInput | DepotMaintenanceUpdateInput) => ({
  type: input.type,
  performedAt: input.performedAt,
  performedById: input.performedById ?? null,
  provider: input.provider ?? null,
  mileage: input.mileage ?? null,
  cost: input.cost === undefined ? null : input.cost.toString(),
  description: input.description ?? null,
  nextDueDate: input.nextDueDate ?? null,
  nextDueMileage: input.nextDueMileage ?? null,
})

export const createDepotMaintenance = async (
  ctx: OrgContext,
  input: DepotMaintenanceCreateInput
) => {
  requirePermission(ctx, 'depotMaintenance', 'create')
  const { mileage } = await assertDepotInOrg(ctx, input.depotId)
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  const [created] = await db
    .insert(depotMaintenance)
    .values({ ...toColumns(input), depotId: input.depotId, organizationId: ctx.organizationId })
    .returning({ id: depotMaintenance.id })

  await bumpDepotMileage(ctx, input.depotId, mileage, input.mileage)
  await recalcDepotNextMaintenance(ctx, input.depotId)
  return created
}

export const updateDepotMaintenance = async (
  ctx: OrgContext,
  id: string,
  input: DepotMaintenanceUpdateInput
) => {
  requirePermission(ctx, 'depotMaintenance', 'update')
  const depotId = await getMaintenanceDepotId(ctx, id)
  const { mileage } = await assertDepotInOrg(ctx, depotId)
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  const [updated] = await db
    .update(depotMaintenance)
    .set(toColumns(input))
    .where(
      and(
        eq(depotMaintenance.id, id),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )
    .returning({ id: depotMaintenance.id })

  if (!updated) throw new NotFoundError('Entretien introuvable')

  await bumpDepotMileage(ctx, depotId, mileage, input.mileage)
  await recalcDepotNextMaintenance(ctx, depotId)
  return updated
}

export const softDeleteDepotMaintenance = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'depotMaintenance', 'delete')
  const depotId = await getMaintenanceDepotId(ctx, id)

  const [deleted] = await db
    .update(depotMaintenance)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(depotMaintenance.id, id),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )
    .returning({ id: depotMaintenance.id })

  if (!deleted) throw new NotFoundError('Entretien introuvable')

  await recalcDepotNextMaintenance(ctx, depotId)
}
