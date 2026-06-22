import 'server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { client, clientLocation, equipment } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { LocationCreateInput, LocationUpdateInput } from '@/validation/location'

/**
 * Services — localisations client (maison, appartement, local…).
 * Cloisonnement multi-tenant : filtre `organizationId` partout.
 */

const assertClientInOrg = async (ctx: OrgContext, clientId: string): Promise<void> => {
  const [row] = await db
    .select({ id: client.id })
    .from(client)
    .where(
      and(
        eq(client.id, clientId),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Client introuvable')
}

export interface LocationItem {
  id: string
  type: string
  name: string
  addressLine1: string | null
  postalCode: string | null
  city: string | null
  notes: string | null
}

export const listLocationsForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<LocationItem[]> => {
  requirePermission(ctx, 'location', 'read')

  return db
    .select({
      id: clientLocation.id,
      type: clientLocation.type,
      name: clientLocation.name,
      addressLine1: clientLocation.addressLine1,
      postalCode: clientLocation.postalCode,
      city: clientLocation.city,
      notes: clientLocation.notes,
    })
    .from(clientLocation)
    .where(
      and(
        eq(clientLocation.clientId, clientId),
        eq(clientLocation.organizationId, ctx.organizationId),
        isNull(clientLocation.deletedAt)
      )
    )
    .orderBy(asc(clientLocation.name))
}

const toColumns = (input: LocationCreateInput | LocationUpdateInput) => ({
  type: input.type,
  name: input.name,
  addressLine1: input.addressLine1 ?? null,
  addressLine2: input.addressLine2 ?? null,
  postalCode: input.postalCode ?? null,
  city: input.city ?? null,
  country: input.country || 'FR',
  notes: input.notes ?? null,
})

export const createLocation = async (ctx: OrgContext, input: LocationCreateInput) => {
  requirePermission(ctx, 'location', 'create')
  await assertClientInOrg(ctx, input.clientId)

  const [created] = await db
    .insert(clientLocation)
    .values({ ...toColumns(input), clientId: input.clientId, organizationId: ctx.organizationId })
    .returning({ id: clientLocation.id })
  return created
}

export const updateLocation = async (ctx: OrgContext, id: string, input: LocationUpdateInput) => {
  requirePermission(ctx, 'location', 'update')

  const [updated] = await db
    .update(clientLocation)
    .set(toColumns(input))
    .where(
      and(
        eq(clientLocation.id, id),
        eq(clientLocation.organizationId, ctx.organizationId),
        isNull(clientLocation.deletedAt)
      )
    )
    .returning({ id: clientLocation.id })

  if (!updated) throw new NotFoundError('Localisation introuvable')
  return updated
}

/** Soft-delete la localisation ET ses équipements (cohérence d'affichage). */
export const softDeleteLocation = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'location', 'delete')

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(clientLocation)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(clientLocation.id, id),
          eq(clientLocation.organizationId, ctx.organizationId),
          isNull(clientLocation.deletedAt)
        )
      )
      .returning({ id: clientLocation.id })

    if (!deleted) throw new NotFoundError('Localisation introuvable')

    await tx
      .update(equipment)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(equipment.locationId, id),
          eq(equipment.organizationId, ctx.organizationId),
          isNull(equipment.deletedAt)
        )
      )
  })
}
