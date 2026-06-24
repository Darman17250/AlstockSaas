import 'server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { client, clientLocation, equipment } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { EquipmentCreateInput, EquipmentUpdateInput } from '@/validation/equipment'

/**
 * Services — équipements installés. Couche métier pure.
 * `clientId` est dérivé de la localisation (jamais de l'entrée client).
 * Cloisonnement multi-tenant : filtre `organizationId` partout.
 */

/** Vérifie que la localisation appartient à l'org et renvoie son `clientId`. */
const assertLocationInOrg = async (ctx: OrgContext, locationId: string): Promise<string> => {
  const [row] = await db
    .select({ clientId: clientLocation.clientId })
    .from(clientLocation)
    .where(
      and(
        eq(clientLocation.id, locationId),
        eq(clientLocation.organizationId, ctx.organizationId),
        isNull(clientLocation.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Localisation introuvable')
  return row.clientId
}

export interface EquipmentOption {
  id: string
  name: string
  clientName: string
}

/** Équipements de l'org pour un sélecteur (ex. rattacher une tâche). */
export const listEquipmentOptions = async (ctx: OrgContext): Promise<EquipmentOption[]> => {
  requirePermission(ctx, 'equipment', 'read')

  return db
    .select({ id: equipment.id, name: equipment.name, clientName: client.name })
    .from(equipment)
    .innerJoin(client, eq(equipment.clientId, client.id))
    .where(and(eq(equipment.organizationId, ctx.organizationId), isNull(equipment.deletedAt)))
    .orderBy(asc(equipment.name))
}

export interface EquipmentItem {
  id: string
  name: string
  category: string | null
  status: string
  locationId: string
  locationName: string
  nextMaintenanceDate: string | null
}

/** Équipements d'un client (toutes localisations) — groupés par localisation en UI. */
export const listEquipmentsForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<EquipmentItem[]> => {
  requirePermission(ctx, 'equipment', 'read')

  return db
    .select({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      status: equipment.status,
      locationId: equipment.locationId,
      locationName: clientLocation.name,
      nextMaintenanceDate: equipment.nextMaintenanceDate,
    })
    .from(equipment)
    .innerJoin(clientLocation, eq(equipment.locationId, clientLocation.id))
    .where(
      and(
        eq(equipment.clientId, clientId),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .orderBy(asc(equipment.name))
}

export const getEquipment = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'equipment', 'read')

  const [row] = await db
    .select({
      equipment,
      locationName: clientLocation.name,
      locationType: clientLocation.type,
      clientName: client.name,
    })
    .from(equipment)
    .innerJoin(clientLocation, eq(equipment.locationId, clientLocation.id))
    .innerJoin(client, eq(equipment.clientId, client.id))
    .where(
      and(
        eq(equipment.id, id),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Équipement introuvable')

  return {
    ...row.equipment,
    locationName: row.locationName,
    locationType: row.locationType,
    clientName: row.clientName,
  }
}

const toColumns = (input: EquipmentCreateInput | EquipmentUpdateInput) => ({
  locationId: input.locationId,
  name: input.name,
  category: input.category ?? null,
  brand: input.brand ?? null,
  model: input.model ?? null,
  serialNumber: input.serialNumber ?? null,
  installDate: input.installDate ?? null,
  status: input.status,
  maintenanceFrequencyMonths: input.maintenanceFrequencyMonths ?? null,
  nextMaintenanceDate: input.nextMaintenanceDate ?? null,
  notes: input.notes ?? null,
})

export const createEquipment = async (ctx: OrgContext, input: EquipmentCreateInput) => {
  requirePermission(ctx, 'equipment', 'create')
  const clientId = await assertLocationInOrg(ctx, input.locationId)

  const [created] = await db
    .insert(equipment)
    .values({ ...toColumns(input), clientId, organizationId: ctx.organizationId })
    .returning({ id: equipment.id })
  return created
}

export const updateEquipment = async (ctx: OrgContext, id: string, input: EquipmentUpdateInput) => {
  requirePermission(ctx, 'equipment', 'update')
  // Revérifie la localisation (et reprend son client → supporte le déplacement).
  const clientId = await assertLocationInOrg(ctx, input.locationId)

  const [updated] = await db
    .update(equipment)
    .set({ ...toColumns(input), clientId })
    .where(
      and(
        eq(equipment.id, id),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .returning({ id: equipment.id })

  if (!updated) throw new NotFoundError('Équipement introuvable')
  return updated
}

export const softDeleteEquipment = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'equipment', 'delete')

  const [deleted] = await db
    .update(equipment)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(equipment.id, id),
        eq(equipment.organizationId, ctx.organizationId),
        isNull(equipment.deletedAt)
      )
    )
    .returning({ id: equipment.id })

  if (!deleted) throw new NotFoundError('Équipement introuvable')
}
