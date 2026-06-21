import 'server-only'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { client, deal, member, site, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { SiteCreateInput, SiteListParams, SiteUpdateInput } from '@/validation/site'

/**
 * Services CRM — chantiers (entité `site`). Couche métier pure.
 *
 * Règle d'or multi-tenant : TOUTE requête filtre `organizationId = ctx.organizationId`.
 * L'`organizationId` n'est JAMAIS lu depuis l'entrée utilisateur, toujours du contexte.
 */

/** Vérifie qu'un client appartient à l'organisation (et n'est pas supprimé). */
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

/** Vérifie qu'un membre (conducteur) appartient bien à l'organisation du contexte. */
const assertConducteurInOrg = async (ctx: OrgContext, conducteurId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, conducteurId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Conducteur invalide pour cette organisation')
}

/** Normalise les champs du formulaire vers les colonnes Drizzle. */
const toColumns = (input: SiteCreateInput | SiteUpdateInput) => ({
  name: input.name,
  clientId: input.clientId,
  reference: input.reference ?? null,
  status: input.status,
  addressLine1: input.addressLine1 ?? null,
  postalCode: input.postalCode ?? null,
  city: input.city ?? null,
  country: input.country || 'FR',
  startDate: input.startDate ?? null,
  endDate: input.endDate ?? null,
  actualStartDate: input.actualStartDate ?? null,
  actualEndDate: input.actualEndDate ?? null,
  conducteurId: input.conducteurId ?? null,
  description: input.description ?? null,
})

export interface SiteOption {
  id: string
  name: string
}

/** Chantiers de l'organisation pour un sélecteur (ex. rattacher une tâche). */
export const listSiteOptions = async (ctx: OrgContext): Promise<SiteOption[]> => {
  requirePermission(ctx, 'site', 'read')

  return db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(and(eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt)))
    .orderBy(desc(site.createdAt))
}

export interface SiteListItem {
  id: string
  name: string
  reference: string | null
  status: string
  city: string | null
  clientName: string
  conducteurName: string | null
}

export interface SiteListResult {
  items: SiteListItem[]
  total: number
  page: number
  pageSize: number
}

/** Liste paginée filtrable par statut, client et recherche texte. */
export const listSites = async (
  ctx: OrgContext,
  params: SiteListParams
): Promise<SiteListResult> => {
  requirePermission(ctx, 'site', 'read')

  const conditions = [eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt)]
  if (params.status) conditions.push(eq(site.status, params.status))
  if (params.clientId) conditions.push(eq(site.clientId, params.clientId))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(
      ilike(site.name, pattern),
      ilike(site.reference, pattern),
      ilike(site.city, pattern)
    )
    if (search) conditions.push(search)
  }
  const where = and(...conditions)

  const offset = (params.page - 1) * params.pageSize

  const items = await db
    .select({
      id: site.id,
      name: site.name,
      reference: site.reference,
      status: site.status,
      city: site.city,
      clientName: client.name,
      conducteurName: user.name,
    })
    .from(site)
    .innerJoin(client, eq(site.clientId, client.id))
    .leftJoin(member, eq(site.conducteurId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(desc(site.createdAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(site).where(where)

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export const getSite = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'site', 'read')

  const [row] = await db
    .select({
      site,
      clientName: client.name,
      conducteurName: user.name,
      dealTitle: deal.title,
    })
    .from(site)
    .innerJoin(client, eq(site.clientId, client.id))
    .leftJoin(member, eq(site.conducteurId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .leftJoin(deal, eq(site.dealId, deal.id))
    .where(
      and(eq(site.id, id), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Chantier introuvable')

  return {
    ...row.site,
    clientName: row.clientName,
    conducteurName: row.conducteurName,
    dealTitle: row.dealTitle,
  }
}

export const createSite = async (ctx: OrgContext, input: SiteCreateInput) => {
  requirePermission(ctx, 'site', 'create')
  await assertClientInOrg(ctx, input.clientId)
  if (input.conducteurId) await assertConducteurInOrg(ctx, input.conducteurId)

  const [created] = await db
    .insert(site)
    .values({ ...toColumns(input), organizationId: ctx.organizationId })
    .returning()

  return created
}

export const updateSite = async (ctx: OrgContext, id: string, input: SiteUpdateInput) => {
  requirePermission(ctx, 'site', 'update')
  await assertClientInOrg(ctx, input.clientId)
  if (input.conducteurId) await assertConducteurInOrg(ctx, input.conducteurId)

  const [updated] = await db
    .update(site)
    .set(toColumns(input))
    .where(
      and(eq(site.id, id), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .returning()

  if (!updated) throw new NotFoundError('Chantier introuvable')
  return updated
}

export const softDeleteSite = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'site', 'delete')

  const [deleted] = await db
    .update(site)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(site.id, id), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .returning({ id: site.id })

  if (!deleted) throw new NotFoundError('Chantier introuvable')
}
