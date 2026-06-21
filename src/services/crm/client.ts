import 'server-only'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { client, contact, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { ClientCreateInput, ClientListParams, ClientUpdateInput } from '@/validation/client'

/**
 * Services CRM — clients. Couche métier pure.
 *
 * Règle d'or multi-tenant : TOUTE requête filtre `organizationId = ctx.organizationId`.
 * L'`organizationId` n'est JAMAIS lu depuis l'entrée utilisateur, toujours du contexte.
 */

/** Vérifie qu'un membre (owner) appartient bien à l'organisation du contexte. */
const assertOwnerInOrg = async (ctx: OrgContext, ownerId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, ownerId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Propriétaire invalide pour cette organisation')
}

export interface ClientListItem {
  id: string
  type: string
  relationType: string
  name: string
  city: string | null
  email: string | null
  phone: string | null
  ownerName: string | null
}

export interface ClientListResult {
  items: ClientListItem[]
  total: number
  page: number
  pageSize: number
}

export const listClients = async (
  ctx: OrgContext,
  params: ClientListParams
): Promise<ClientListResult> => {
  requirePermission(ctx, 'client', 'read')

  const conditions = [eq(client.organizationId, ctx.organizationId), isNull(client.deletedAt)]
  if (params.type) conditions.push(eq(client.type, params.type))
  if (params.relationType) conditions.push(eq(client.relationType, params.relationType))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(
      ilike(client.name, pattern),
      ilike(client.email, pattern),
      ilike(client.city, pattern)
    )
    if (search) conditions.push(search)
  }
  const where = and(...conditions)

  const offset = (params.page - 1) * params.pageSize

  const items = await db
    .select({
      id: client.id,
      type: client.type,
      relationType: client.relationType,
      name: client.name,
      city: client.city,
      email: client.email,
      phone: client.phone,
      ownerName: user.name,
    })
    .from(client)
    .leftJoin(member, eq(client.ownerId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(desc(client.createdAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client)
    .where(where)

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export interface ClientOption {
  id: string
  name: string
  type: string
}

/** Clients de l'organisation pour un sélecteur (ex. création d'affaire). */
export const listClientOptions = async (ctx: OrgContext): Promise<ClientOption[]> => {
  requirePermission(ctx, 'client', 'read')

  return db
    .select({ id: client.id, name: client.name, type: client.type })
    .from(client)
    .where(and(eq(client.organizationId, ctx.organizationId), isNull(client.deletedAt)))
    .orderBy(client.name)
}

export const getClient = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'client', 'read')

  const [row] = await db
    .select({
      client,
      ownerName: user.name,
    })
    .from(client)
    .leftJoin(member, eq(client.ownerId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(client.id, id),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Client introuvable')

  const contacts = await db
    .select()
    .from(contact)
    .where(
      and(
        eq(contact.clientId, id),
        eq(contact.organizationId, ctx.organizationId),
        isNull(contact.deletedAt)
      )
    )
    .orderBy(desc(contact.isPrimary), desc(contact.createdAt))

  return { ...row.client, ownerName: row.ownerName, contacts }
}

export const createClient = async (ctx: OrgContext, input: ClientCreateInput) => {
  requirePermission(ctx, 'client', 'create')
  if (input.ownerId) await assertOwnerInOrg(ctx, input.ownerId)

  const [created] = await db
    .insert(client)
    .values({ ...input, organizationId: ctx.organizationId })
    .returning()

  return created
}

export const updateClient = async (ctx: OrgContext, id: string, input: ClientUpdateInput) => {
  requirePermission(ctx, 'client', 'update')
  if (input.ownerId) await assertOwnerInOrg(ctx, input.ownerId)

  const [updated] = await db
    .update(client)
    .set({
      ...input,
      // Champs croisés société/particulier nettoyés selon le type.
      civility: input.type === 'particulier' ? (input.civility ?? null) : null,
      siret: input.type === 'societe' ? (input.siret ?? null) : null,
      ownerId: input.ownerId ?? null,
    })
    .where(
      and(
        eq(client.id, id),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .returning()

  if (!updated) throw new NotFoundError('Client introuvable')
  return updated
}

export const softDeleteClient = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'client', 'delete')

  const [deleted] = await db
    .update(client)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(client.id, id),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .returning({ id: client.id })

  if (!deleted) throw new NotFoundError('Client introuvable')
}
