import 'server-only'
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { client, contact, deal, member, site, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type {
  DealCreateInput,
  DealListParams,
  DealLostInput,
  DealStageInput,
  DealUpdateInput,
  DealWonInput,
} from '@/validation/deal'

/**
 * Services CRM — affaires (pipeline). Couche métier pure.
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

/** Vérifie qu'un contact appartient à l'organisation et au client visé. */
const assertContactInOrg = async (
  ctx: OrgContext,
  contactId: string,
  clientId: string
): Promise<void> => {
  const [row] = await db
    .select({ id: contact.id })
    .from(contact)
    .where(
      and(
        eq(contact.id, contactId),
        eq(contact.clientId, clientId),
        eq(contact.organizationId, ctx.organizationId),
        isNull(contact.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new ForbiddenError('Interlocuteur invalide pour ce client')
}

/** Vérifie qu'un membre (owner) appartient bien à l'organisation du contexte. */
const assertOwnerInOrg = async (ctx: OrgContext, ownerId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, ownerId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Propriétaire invalide pour cette organisation')
}

/** Normalise les champs croisés du formulaire vers les colonnes Drizzle. */
const toColumns = (input: DealCreateInput | DealUpdateInput) => ({
  title: input.title,
  clientId: input.clientId,
  primaryContactId: input.primaryContactId ?? null,
  stage: input.stage,
  estimatedAmount: input.estimatedAmount === undefined ? null : input.estimatedAmount.toString(),
  currency: input.currency || 'EUR',
  probability: input.probability ?? null,
  expectedCloseDate: input.expectedCloseDate ?? null,
  source: input.source ?? null,
  ownerId: input.ownerId ?? null,
  notes: input.notes ?? null,
})

export interface DealBoardItem {
  id: string
  title: string
  stage: string
  status: string
  estimatedAmount: string | null
  currency: string
  probability: number | null
  clientName: string
  ownerName: string | null
}

/** Affaires en cours (pour le kanban), regroupées par stage côté UI. */
export const listDealsBoard = async (ctx: OrgContext): Promise<DealBoardItem[]> => {
  requirePermission(ctx, 'deal', 'read')

  return db
    .select({
      id: deal.id,
      title: deal.title,
      stage: deal.stage,
      status: deal.status,
      estimatedAmount: deal.estimatedAmount,
      currency: deal.currency,
      probability: deal.probability,
      clientName: client.name,
      ownerName: user.name,
    })
    .from(deal)
    .innerJoin(client, eq(deal.clientId, client.id))
    .leftJoin(member, eq(deal.ownerId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(deal.organizationId, ctx.organizationId),
        eq(deal.status, 'en_cours'),
        isNull(deal.deletedAt)
      )
    )
    .orderBy(desc(deal.createdAt))
}

export interface DealListItem {
  id: string
  title: string
  status: string
  estimatedAmount: string | null
  currency: string
  clientName: string
  ownerName: string | null
  wonAt: Date | null
  lostAt: Date | null
}

export interface DealListResult {
  items: DealListItem[]
  total: number
  page: number
  pageSize: number
}

/** Liste paginée filtrable par statut (onglets Gagnées / Perdues). */
export const listDeals = async (
  ctx: OrgContext,
  params: DealListParams
): Promise<DealListResult> => {
  requirePermission(ctx, 'deal', 'read')

  const conditions = [eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt)]
  if (params.status) conditions.push(eq(deal.status, params.status))
  if (params.search) conditions.push(ilike(deal.title, `%${params.search}%`))
  const where = and(...conditions)

  const offset = (params.page - 1) * params.pageSize

  const items = await db
    .select({
      id: deal.id,
      title: deal.title,
      status: deal.status,
      estimatedAmount: deal.estimatedAmount,
      currency: deal.currency,
      clientName: client.name,
      ownerName: user.name,
      wonAt: deal.wonAt,
      lostAt: deal.lostAt,
    })
    .from(deal)
    .innerJoin(client, eq(deal.clientId, client.id))
    .leftJoin(member, eq(deal.ownerId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(desc(deal.updatedAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(deal).where(where)

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export const getDeal = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'deal', 'read')

  const [row] = await db
    .select({
      deal,
      clientName: client.name,
      ownerName: user.name,
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
    })
    .from(deal)
    .innerJoin(client, eq(deal.clientId, client.id))
    .leftJoin(member, eq(deal.ownerId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .leftJoin(contact, eq(deal.primaryContactId, contact.id))
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Affaire introuvable')

  const contactName = row.contactFirstName
    ? [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ')
    : null

  return {
    ...row.deal,
    clientName: row.clientName,
    ownerName: row.ownerName,
    contactName,
  }
}

export interface DealOption {
  id: string
  title: string
}

/** Affaires de l'organisation pour un sélecteur (ex. rattacher une tâche). */
export const listDealOptions = async (ctx: OrgContext): Promise<DealOption[]> => {
  requirePermission(ctx, 'deal', 'read')

  return db
    .select({ id: deal.id, title: deal.title })
    .from(deal)
    .where(and(eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt)))
    .orderBy(desc(deal.createdAt))
}

export interface DealClientItem {
  id: string
  title: string
  status: string
  stage: string
  estimatedAmount: string | null
  currency: string
}

/** Affaires d'un client — pour la section « Affaires » de sa fiche 360. */
export const listDealsForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<DealClientItem[]> => {
  requirePermission(ctx, 'deal', 'read')

  return db
    .select({
      id: deal.id,
      title: deal.title,
      status: deal.status,
      stage: deal.stage,
      estimatedAmount: deal.estimatedAmount,
      currency: deal.currency,
    })
    .from(deal)
    .where(
      and(
        eq(deal.clientId, clientId),
        eq(deal.organizationId, ctx.organizationId),
        isNull(deal.deletedAt)
      )
    )
    .orderBy(desc(deal.createdAt))
}

export const createDeal = async (ctx: OrgContext, input: DealCreateInput) => {
  requirePermission(ctx, 'deal', 'create')
  await assertClientInOrg(ctx, input.clientId)
  if (input.primaryContactId) await assertContactInOrg(ctx, input.primaryContactId, input.clientId)
  if (input.ownerId) await assertOwnerInOrg(ctx, input.ownerId)

  const [created] = await db
    .insert(deal)
    .values({ ...toColumns(input), organizationId: ctx.organizationId })
    .returning()

  return created
}

export const updateDeal = async (ctx: OrgContext, id: string, input: DealUpdateInput) => {
  requirePermission(ctx, 'deal', 'update')
  await assertClientInOrg(ctx, input.clientId)
  if (input.primaryContactId) await assertContactInOrg(ctx, input.primaryContactId, input.clientId)
  if (input.ownerId) await assertOwnerInOrg(ctx, input.ownerId)

  const [updated] = await db
    .update(deal)
    .set(toColumns(input))
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .returning()

  if (!updated) throw new NotFoundError('Affaire introuvable')
  return updated
}

/** Déplace une affaire dans le pipeline (uniquement si elle est en cours). */
export const moveDealStage = async (ctx: OrgContext, id: string, input: DealStageInput) => {
  requirePermission(ctx, 'deal', 'update')

  const [updated] = await db
    .update(deal)
    .set({ stage: input.stage })
    .where(
      and(
        eq(deal.id, id),
        eq(deal.organizationId, ctx.organizationId),
        eq(deal.status, 'en_cours'),
        isNull(deal.deletedAt)
      )
    )
    .returning({ id: deal.id })

  if (!updated) throw new NotFoundError('Affaire introuvable ou déjà clôturée')
  return updated
}

/**
 * Marque une affaire « gagnée ». Optionnellement, crée le chantier lié
 * (slice minimal de la conversion F5) — soumis à la permission `site:create`.
 */
export const markDealWon = async (ctx: OrgContext, id: string, input: DealWonInput) => {
  requirePermission(ctx, 'deal', 'update')
  if (input.createSite) requirePermission(ctx, 'site', 'create')

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(deal)
      .where(
        and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
      )
      .limit(1)
    if (!current) throw new NotFoundError('Affaire introuvable')

    let siteId = current.siteId
    // Conversion en chantier : pré-remplissage depuis l'affaire + le client.
    if (input.createSite && !siteId) {
      const [cli] = await tx
        .select({
          addressLine1: client.addressLine1,
          postalCode: client.postalCode,
          city: client.city,
          country: client.country,
        })
        .from(client)
        .where(and(eq(client.id, current.clientId), eq(client.organizationId, ctx.organizationId)))
        .limit(1)

      const [createdSite] = await tx
        .insert(site)
        .values({
          organizationId: ctx.organizationId,
          name: current.title,
          clientId: current.clientId,
          dealId: current.id,
          status: 'prepa',
          addressLine1: cli?.addressLine1 ?? null,
          postalCode: cli?.postalCode ?? null,
          city: cli?.city ?? null,
          country: cli?.country ?? 'FR',
        })
        .returning({ id: site.id })
      siteId = createdSite.id
    }

    const [updated] = await tx
      .update(deal)
      .set({
        status: 'gagnee',
        wonAt: new Date(),
        lostAt: null,
        lostReason: null,
        siteId,
      })
      .where(and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId)))
      .returning({ id: deal.id, siteId: deal.siteId })

    return updated
  })
}

/** Marque une affaire « perdue » avec un motif optionnel. */
export const markDealLost = async (ctx: OrgContext, id: string, input: DealLostInput) => {
  requirePermission(ctx, 'deal', 'update')

  const [updated] = await db
    .update(deal)
    .set({
      status: 'perdue',
      lostAt: new Date(),
      lostReason: input.lostReason ?? null,
      wonAt: null,
    })
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .returning({ id: deal.id })

  if (!updated) throw new NotFoundError('Affaire introuvable')
  return updated
}

/** Rouvre une affaire clôturée : retour au pipeline. */
export const reopenDeal = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'deal', 'update')

  const [updated] = await db
    .update(deal)
    .set({ status: 'en_cours', wonAt: null, lostAt: null, lostReason: null })
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .returning({ id: deal.id })

  if (!updated) throw new NotFoundError('Affaire introuvable')
  return updated
}

export const softDeleteDeal = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'deal', 'delete')

  const [deleted] = await db
    .update(deal)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(deal.id, id), eq(deal.organizationId, ctx.organizationId), isNull(deal.deletedAt))
    )
    .returning({ id: deal.id })

  if (!deleted) throw new NotFoundError('Affaire introuvable')
}
