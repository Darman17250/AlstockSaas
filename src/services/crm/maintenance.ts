import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { equipment, equipmentMaintenance, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { MaintenanceCreateInput, MaintenanceUpdateInput } from '@/validation/maintenance'

/**
 * Services — entretiens d'un équipement (historique). Couche métier pure.
 * Cloisonnement multi-tenant : filtre `organizationId` partout.
 * À la création, met à jour `equipment.nextMaintenanceDate` (date fournie ou
 * calculée depuis la fréquence d'entretien de l'équipement).
 */

/** Vérifie l'équipement et renvoie sa fréquence d'entretien (mois). */
const assertEquipmentInOrg = async (
  ctx: OrgContext,
  equipmentId: string
): Promise<{ frequency: number | null }> => {
  const [row] = await db
    .select({ frequency: equipment.maintenanceFrequencyMonths })
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
  return { frequency: row.frequency }
}

const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Intervenant invalide pour cette organisation')
}

const pad = (n: number) => String(n).padStart(2, '0')
const addMonthsToDate = (dateStr: string, months: number): string => {
  const dt = new Date(`${dateStr}T00:00:00`)
  dt.setMonth(dt.getMonth() + months)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export interface MaintenanceItem {
  id: string
  type: string
  performedAt: string
  performedById: string | null
  performedByName: string | null
  cost: string | null
  description: string | null
  nextDueDate: string | null
}

export interface MaintenanceListResult {
  items: MaintenanceItem[]
  totalCost: number
}

export const listMaintenanceForEquipment = async (
  ctx: OrgContext,
  equipmentId: string
): Promise<MaintenanceListResult> => {
  requirePermission(ctx, 'maintenance', 'read')

  const items = await db
    .select({
      id: equipmentMaintenance.id,
      type: equipmentMaintenance.type,
      performedAt: equipmentMaintenance.performedAt,
      performedById: equipmentMaintenance.performedById,
      performedByName: user.name,
      cost: equipmentMaintenance.cost,
      description: equipmentMaintenance.description,
      nextDueDate: equipmentMaintenance.nextDueDate,
    })
    .from(equipmentMaintenance)
    .leftJoin(member, eq(equipmentMaintenance.performedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(equipmentMaintenance.equipmentId, equipmentId),
        eq(equipmentMaintenance.organizationId, ctx.organizationId),
        isNull(equipmentMaintenance.deletedAt)
      )
    )
    .orderBy(desc(equipmentMaintenance.performedAt), desc(equipmentMaintenance.createdAt))

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${equipmentMaintenance.cost}), 0)::float` })
    .from(equipmentMaintenance)
    .where(
      and(
        eq(equipmentMaintenance.equipmentId, equipmentId),
        eq(equipmentMaintenance.organizationId, ctx.organizationId),
        isNull(equipmentMaintenance.deletedAt)
      )
    )

  return { items, totalCost: total }
}

const toColumns = (input: MaintenanceCreateInput | MaintenanceUpdateInput) => ({
  type: input.type,
  performedAt: input.performedAt,
  performedById: input.performedById ?? null,
  cost: input.cost === undefined ? null : input.cost.toString(),
  description: input.description ?? null,
  nextDueDate: input.nextDueDate ?? null,
})

export const createMaintenance = async (ctx: OrgContext, input: MaintenanceCreateInput) => {
  requirePermission(ctx, 'maintenance', 'create')
  const { frequency } = await assertEquipmentInOrg(ctx, input.equipmentId)
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  // Prochaine échéance : date fournie, sinon calculée depuis la fréquence.
  const nextDate =
    input.nextDueDate ?? (frequency ? addMonthsToDate(input.performedAt, frequency) : null)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(equipmentMaintenance)
      .values({
        ...toColumns(input),
        nextDueDate: nextDate,
        equipmentId: input.equipmentId,
        organizationId: ctx.organizationId,
      })
      .returning({ id: equipmentMaintenance.id })

    if (nextDate) {
      await tx
        .update(equipment)
        .set({ nextMaintenanceDate: nextDate })
        .where(
          and(eq(equipment.id, input.equipmentId), eq(equipment.organizationId, ctx.organizationId))
        )
    }
    return created
  })
}

export const updateMaintenance = async (
  ctx: OrgContext,
  id: string,
  input: MaintenanceUpdateInput
) => {
  requirePermission(ctx, 'maintenance', 'update')
  if (input.performedById) await assertMemberInOrg(ctx, input.performedById)

  const [updated] = await db
    .update(equipmentMaintenance)
    .set(toColumns(input))
    .where(
      and(
        eq(equipmentMaintenance.id, id),
        eq(equipmentMaintenance.organizationId, ctx.organizationId),
        isNull(equipmentMaintenance.deletedAt)
      )
    )
    .returning({ id: equipmentMaintenance.id })

  if (!updated) throw new NotFoundError('Entretien introuvable')
  return updated
}

export const softDeleteMaintenance = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'maintenance', 'delete')

  const [deleted] = await db
    .update(equipmentMaintenance)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(equipmentMaintenance.id, id),
        eq(equipmentMaintenance.organizationId, ctx.organizationId),
        isNull(equipmentMaintenance.deletedAt)
      )
    )
    .returning({ id: equipmentMaintenance.id })

  if (!deleted) throw new NotFoundError('Entretien introuvable')
}
