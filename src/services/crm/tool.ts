import 'server-only'
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { depot, member, site, tool, toolIssue, toolMaintenance, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { ToolCreateInput, ToolListParams, ToolUpdateInput } from '@/validation/tool'

/**
 * Services — matériel (parc d'outillage & machines de l'organisation). Couche
 * métier pure. Un matériel est un actif unitaire dont la localisation courante
 * est exclusive : SOIT un dépôt SOIT un chantier (jamais les deux). Cette
 * exclusivité est garantie ici, au niveau service.
 *
 * Règle d'or multi-tenant : TOUTE requête filtre `organizationId = ctx.organizationId`.
 */

/** Sous-requête : le matériel a-t-il au moins un problème non résolu ? */
const openIssueExists = sql<boolean>`exists (
  select 1 from ${toolIssue}
  where ${toolIssue.toolId} = ${tool.id}
    and ${toolIssue.status} <> 'resolu'
)`

/** Vérifie qu'un membre (responsable) appartient bien à l'organisation. */
const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Responsable invalide pour cette organisation')
}

/** Vérifie qu'un dépôt appartient à l'organisation (non supprimé). */
export const assertDepotInOrg = async (ctx: OrgContext, depotId: string): Promise<void> => {
  const [row] = await db
    .select({ id: depot.id })
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
}

/** Vérifie qu'un chantier appartient à l'organisation (non supprimé). */
export const assertSiteInOrg = async (ctx: OrgContext, siteId: string): Promise<void> => {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(
      and(eq(site.id, siteId), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Chantier introuvable')
}

/** Normalise les champs du formulaire vers les colonnes Drizzle (hors localisation). */
const toColumns = (input: ToolCreateInput | ToolUpdateInput) => {
  const isMachine = input.kind === 'machine'
  return {
    kind: input.kind,
    name: input.name,
    category: input.category ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    serialNumber: input.serialNumber ?? null,
    reference: input.reference ?? null,
    responsibleId: input.responsibleId ?? null,
    purchaseDate: input.purchaseDate ?? null,
    purchaseCost: input.purchaseCost != null ? String(input.purchaseCost) : null,
    maintenanceFrequencyMonths: input.maintenanceFrequencyMonths ?? null,
    // Champs machine : conservés uniquement si c'est une machine.
    fuelLevel: isMachine ? (input.fuelLevel ?? null) : null,
    engineHours: isMachine ? (input.engineHours ?? null) : null,
    notes: input.notes ?? null,
  }
}

export interface ToolOption {
  id: string
  name: string
  kind: string
}

/** Matériels de l'organisation pour un sélecteur. */
export const listToolOptions = async (ctx: OrgContext): Promise<ToolOption[]> => {
  requirePermission(ctx, 'tool', 'read')

  return db
    .select({ id: tool.id, name: tool.name, kind: tool.kind })
    .from(tool)
    .where(and(eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt)))
    .orderBy(asc(tool.name))
}

export interface ToolListItem {
  id: string
  kind: string
  name: string
  category: string | null
  status: string
  fuelLevel: string | null
  currentDepotName: string | null
  currentSiteName: string | null
  responsibleName: string | null
  nextMaintenanceDate: string | null
  hasOpenIssue: boolean
}

export interface ToolListResult {
  items: ToolListItem[]
  total: number
  page: number
  pageSize: number
}

/** Liste paginée filtrable par nature, statut, catégorie, localisation, recherche. */
export const listTools = async (
  ctx: OrgContext,
  params: ToolListParams
): Promise<ToolListResult> => {
  requirePermission(ctx, 'tool', 'read')

  const conditions = [eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt)]
  if (params.kind) conditions.push(eq(tool.kind, params.kind))
  if (params.status) conditions.push(eq(tool.status, params.status))
  if (params.category) conditions.push(eq(tool.category, params.category))
  if (params.depotId) conditions.push(eq(tool.currentDepotId, params.depotId))
  if (params.siteId) conditions.push(eq(tool.currentSiteId, params.siteId))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(
      ilike(tool.name, pattern),
      ilike(tool.category, pattern),
      ilike(tool.brand, pattern),
      ilike(tool.model, pattern),
      ilike(tool.serialNumber, pattern),
      ilike(tool.reference, pattern)
    )
    if (search) conditions.push(search)
  }
  const where = and(...conditions)

  const offset = (params.page - 1) * params.pageSize

  const items = await db
    .select({
      id: tool.id,
      kind: tool.kind,
      name: tool.name,
      category: tool.category,
      status: tool.status,
      fuelLevel: tool.fuelLevel,
      currentDepotName: depot.name,
      currentSiteName: site.name,
      responsibleName: user.name,
      nextMaintenanceDate: tool.nextMaintenanceDate,
      hasOpenIssue: openIssueExists,
    })
    .from(tool)
    .leftJoin(depot, eq(tool.currentDepotId, depot.id))
    .leftJoin(site, eq(tool.currentSiteId, site.id))
    .leftJoin(member, eq(tool.responsibleId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(desc(tool.createdAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tool)
    .where(where)

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export const getTool = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'tool', 'read')

  const [row] = await db
    .select({
      tool,
      responsibleName: user.name,
      currentDepotName: depot.name,
      currentSiteName: site.name,
      hasOpenIssue: openIssueExists,
    })
    .from(tool)
    .leftJoin(depot, eq(tool.currentDepotId, depot.id))
    .leftJoin(site, eq(tool.currentSiteId, site.id))
    .leftJoin(member, eq(tool.responsibleId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(tool.id, id), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .limit(1)

  if (!row) throw new NotFoundError('Matériel introuvable')

  return {
    ...row.tool,
    responsibleName: row.responsibleName,
    currentDepotName: row.currentDepotName,
    currentSiteName: row.currentSiteName,
    hasOpenIssue: row.hasOpenIssue,
  }
}

export const createTool = async (ctx: OrgContext, input: ToolCreateInput) => {
  requirePermission(ctx, 'tool', 'create')
  if (input.responsibleId) await assertMemberInOrg(ctx, input.responsibleId)
  // Localisation initiale : un dépôt requis.
  await assertDepotInOrg(ctx, input.depotId)

  const [created] = await db
    .insert(tool)
    .values({
      ...toColumns(input),
      organizationId: ctx.organizationId,
      currentDepotId: input.depotId,
      currentSiteId: null,
      status: 'disponible',
    })
    .returning()

  return created
}

export const updateTool = async (ctx: OrgContext, id: string, input: ToolUpdateInput) => {
  requirePermission(ctx, 'tool', 'update')
  if (input.responsibleId) await assertMemberInOrg(ctx, input.responsibleId)

  // La localisation n'est jamais modifiée ici (elle change via un transfert),
  // donc l'exclusivité currentDepotId/currentSiteId est préservée.
  const [updated] = await db
    .update(tool)
    .set(toColumns(input))
    .where(
      and(eq(tool.id, id), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .returning()

  if (!updated) throw new NotFoundError('Matériel introuvable')
  return updated
}

export const softDeleteTool = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'tool', 'delete')

  const [deleted] = await db
    .update(tool)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(tool.id, id), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .returning({ id: tool.id })

  if (!deleted) throw new NotFoundError('Matériel introuvable')
}

export interface ToolPresenceItem {
  id: string
  kind: string
  name: string
  category: string | null
  status: string
}

const presenceSelect = {
  id: tool.id,
  kind: tool.kind,
  name: tool.name,
  category: tool.category,
  status: tool.status,
}

/** Matériels actuellement présents dans un dépôt. */
export const listToolsForDepot = async (
  ctx: OrgContext,
  depotId: string
): Promise<ToolPresenceItem[]> => {
  requirePermission(ctx, 'tool', 'read')
  return db
    .select(presenceSelect)
    .from(tool)
    .where(
      and(
        eq(tool.organizationId, ctx.organizationId),
        eq(tool.currentDepotId, depotId),
        isNull(tool.deletedAt)
      )
    )
    .orderBy(asc(tool.name))
}

/** Matériels actuellement présents sur un chantier. */
export const listToolsForSite = async (
  ctx: OrgContext,
  siteId: string
): Promise<ToolPresenceItem[]> => {
  requirePermission(ctx, 'tool', 'read')
  return db
    .select(presenceSelect)
    .from(tool)
    .where(
      and(
        eq(tool.organizationId, ctx.organizationId),
        eq(tool.currentSiteId, siteId),
        isNull(tool.deletedAt)
      )
    )
    .orderBy(asc(tool.name))
}

/**
 * Recalcule `tool.nextMaintenanceDate` depuis le `nextDueDate` le plus proche
 * parmi les entretiens non supprimés. `null` si aucun. Appelé après chaque
 * écriture d'entretien.
 */
export const recalcToolNextMaintenance = async (ctx: OrgContext, toolId: string): Promise<void> => {
  const [row] = await db
    .select({ next: sql<string | null>`min(${toolMaintenance.nextDueDate})` })
    .from(toolMaintenance)
    .where(
      and(
        eq(toolMaintenance.toolId, toolId),
        eq(toolMaintenance.organizationId, ctx.organizationId),
        isNull(toolMaintenance.deletedAt)
      )
    )

  await db
    .update(tool)
    .set({ nextMaintenanceDate: row?.next ?? null })
    .where(and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId)))
}

/** Met à jour le niveau de carburant d'une machine. */
export const setFuelLevel = async (
  ctx: OrgContext,
  toolId: string,
  fuelLevel: (typeof tool.fuelLevel.enumValues)[number]
): Promise<void> => {
  requirePermission(ctx, 'tool', 'update')
  const [updated] = await db
    .update(tool)
    .set({ fuelLevel })
    .where(
      and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .returning({ id: tool.id })
  if (!updated) throw new NotFoundError('Matériel introuvable')
}

/** Met à jour le compteur horaire d'une machine. */
export const updateEngineHours = async (
  ctx: OrgContext,
  toolId: string,
  engineHours: number
): Promise<void> => {
  requirePermission(ctx, 'tool', 'update')
  const [updated] = await db
    .update(tool)
    .set({ engineHours })
    .where(
      and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .returning({ id: tool.id })
  if (!updated) throw new NotFoundError('Matériel introuvable')
}
