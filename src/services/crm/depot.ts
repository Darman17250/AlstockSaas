import 'server-only'
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { depot, depotMaintenance, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { DepotCreateInput, DepotListParams, DepotUpdateInput } from '@/validation/depot'

/**
 * Services — dépôts & véhicules (emplacements de l'organisation). Couche métier pure.
 *
 * Règle d'or multi-tenant : TOUTE requête filtre `organizationId = ctx.organizationId`.
 * L'`organizationId` n'est JAMAIS lu depuis l'entrée utilisateur, toujours du contexte.
 */

/** Vérifie qu'un membre (responsable) appartient bien à l'organisation du contexte. */
const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Responsable invalide pour cette organisation')
}

/** Normalise les champs du formulaire vers les colonnes Drizzle. */
const toColumns = (input: DepotCreateInput | DepotUpdateInput) => {
  const isVehicle = input.type === 'vehicule'
  return {
    type: input.type,
    name: input.name,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    postalCode: input.postalCode ?? null,
    city: input.city ?? null,
    country: input.country || 'FR',
    responsibleId: input.responsibleId ?? null,
    notes: input.notes ?? null,
    // Champs véhicule : conservés uniquement si le dépôt est un véhicule.
    registrationNumber: isVehicle ? (input.registrationNumber ?? null) : null,
    brand: isVehicle ? (input.brand ?? null) : null,
    model: isVehicle ? (input.model ?? null) : null,
    year: isVehicle ? (input.year ?? null) : null,
    fuelType: isVehicle ? (input.fuelType ?? null) : null,
    vin: isVehicle ? (input.vin ?? null) : null,
    firstRegistrationDate: isVehicle ? (input.firstRegistrationDate ?? null) : null,
    mileage: isVehicle ? (input.mileage ?? null) : null,
  }
}

export interface DepotOption {
  id: string
  name: string
  type: string
}

/** Dépôts de l'organisation pour un sélecteur. */
export const listDepotOptions = async (ctx: OrgContext): Promise<DepotOption[]> => {
  requirePermission(ctx, 'depot', 'read')

  return db
    .select({ id: depot.id, name: depot.name, type: depot.type })
    .from(depot)
    .where(and(eq(depot.organizationId, ctx.organizationId), isNull(depot.deletedAt)))
    .orderBy(asc(depot.name))
}

export interface DepotListItem {
  id: string
  type: string
  name: string
  city: string | null
  registrationNumber: string | null
  responsibleName: string | null
  nextMaintenanceDate: string | null
}

export interface DepotListResult {
  items: DepotListItem[]
  total: number
  page: number
  pageSize: number
}

/** Liste paginée filtrable par type et recherche texte. */
export const listDepots = async (
  ctx: OrgContext,
  params: DepotListParams
): Promise<DepotListResult> => {
  requirePermission(ctx, 'depot', 'read')

  const conditions = [eq(depot.organizationId, ctx.organizationId), isNull(depot.deletedAt)]
  if (params.type) conditions.push(eq(depot.type, params.type))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(
      ilike(depot.name, pattern),
      ilike(depot.city, pattern),
      ilike(depot.registrationNumber, pattern),
      ilike(depot.brand, pattern),
      ilike(depot.model, pattern)
    )
    if (search) conditions.push(search)
  }
  const where = and(...conditions)

  const offset = (params.page - 1) * params.pageSize

  const items = await db
    .select({
      id: depot.id,
      type: depot.type,
      name: depot.name,
      city: depot.city,
      registrationNumber: depot.registrationNumber,
      responsibleName: user.name,
      nextMaintenanceDate: depot.nextMaintenanceDate,
    })
    .from(depot)
    .leftJoin(member, eq(depot.responsibleId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(desc(depot.createdAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(depot)
    .where(where)

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export const getDepot = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'depot', 'read')

  const [row] = await db
    .select({ depot, responsibleName: user.name })
    .from(depot)
    .leftJoin(member, eq(depot.responsibleId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(depot.id, id), eq(depot.organizationId, ctx.organizationId), isNull(depot.deletedAt))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Dépôt introuvable')

  return { ...row.depot, responsibleName: row.responsibleName }
}

export const createDepot = async (ctx: OrgContext, input: DepotCreateInput) => {
  requirePermission(ctx, 'depot', 'create')
  if (input.responsibleId) await assertMemberInOrg(ctx, input.responsibleId)

  const [created] = await db
    .insert(depot)
    .values({ ...toColumns(input), organizationId: ctx.organizationId })
    .returning()

  return created
}

export const updateDepot = async (ctx: OrgContext, id: string, input: DepotUpdateInput) => {
  requirePermission(ctx, 'depot', 'update')
  if (input.responsibleId) await assertMemberInOrg(ctx, input.responsibleId)

  const [updated] = await db
    .update(depot)
    .set(toColumns(input))
    .where(
      and(eq(depot.id, id), eq(depot.organizationId, ctx.organizationId), isNull(depot.deletedAt))
    )
    .returning()

  if (!updated) throw new NotFoundError('Dépôt introuvable')
  return updated
}

export const softDeleteDepot = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'depot', 'delete')

  const [deleted] = await db
    .update(depot)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(depot.id, id), eq(depot.organizationId, ctx.organizationId), isNull(depot.deletedAt))
    )
    .returning({ id: depot.id })

  if (!deleted) throw new NotFoundError('Dépôt introuvable')
}

/**
 * Recalcule `depot.nextMaintenanceDate` depuis le `nextDueDate` le plus proche
 * (le plus tôt) parmi les entretiens non supprimés du dépôt. `null` si aucun.
 * Appelé après chaque écriture d'entretien.
 */
export const recalcDepotNextMaintenance = async (
  ctx: OrgContext,
  depotId: string
): Promise<void> => {
  const [row] = await db
    .select({ next: sql<string | null>`min(${depotMaintenance.nextDueDate})` })
    .from(depotMaintenance)
    .where(
      and(
        eq(depotMaintenance.depotId, depotId),
        eq(depotMaintenance.organizationId, ctx.organizationId),
        isNull(depotMaintenance.deletedAt)
      )
    )

  await db
    .update(depot)
    .set({ nextMaintenanceDate: row?.next ?? null })
    .where(and(eq(depot.id, depotId), eq(depot.organizationId, ctx.organizationId)))
}
