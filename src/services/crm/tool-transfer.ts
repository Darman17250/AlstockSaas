import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { depot, member, site, tool, toolTransfer, user } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { ToolTransferCreateInput } from '@/validation/tool-transfer'
import { assertDepotInOrg, assertSiteInOrg } from './tool'

/**
 * Services — transferts d'un matériel entre dépôts et chantiers (journal
 * append-only). Le transfert est la seule façon de changer la localisation
 * courante d'un matériel. Statut mis à jour automatiquement (voir plus bas).
 */

/** Statuts qu'un transfert ne doit jamais écraser (problème en cours). */
const PROTECTED_STATUSES = ['en_panne', 'en_reparation', 'hors_service', 'perdu']

export interface ToolTransferItem {
  id: string
  fromDepotName: string | null
  fromSiteName: string | null
  toDepotName: string | null
  toSiteName: string | null
  transferredAt: Date
  transferredByName: string | null
  note: string | null
}

export const listTransfersForTool = async (
  ctx: OrgContext,
  toolId: string
): Promise<ToolTransferItem[]> => {
  requirePermission(ctx, 'toolTransfer', 'read')

  // from*/to* peuvent référencer dépôt ou chantier ; plutôt que d'aliaser
  // quatre fois les tables depot/site dans une jointure, on résout les noms
  // via deux petites lookups par organisation.
  const rows = await db
    .select({
      id: toolTransfer.id,
      fromDepotId: toolTransfer.fromDepotId,
      fromSiteId: toolTransfer.fromSiteId,
      toDepotId: toolTransfer.toDepotId,
      toSiteId: toolTransfer.toSiteId,
      transferredAt: toolTransfer.transferredAt,
      transferredByName: user.name,
      note: toolTransfer.note,
    })
    .from(toolTransfer)
    .leftJoin(member, eq(toolTransfer.transferredById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(toolTransfer.toolId, toolId),
        eq(toolTransfer.organizationId, ctx.organizationId)
      )
    )
    .orderBy(desc(toolTransfer.transferredAt))

  // Résolution des noms de localisation (dépôts + chantiers de l'org).
  const depots = await db
    .select({ id: depot.id, name: depot.name })
    .from(depot)
    .where(eq(depot.organizationId, ctx.organizationId))
  const sites = await db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(eq(site.organizationId, ctx.organizationId))
  const depotName = new Map(depots.map((d) => [d.id, d.name]))
  const siteName = new Map(sites.map((s) => [s.id, s.name]))

  return rows.map((r) => ({
    id: r.id,
    fromDepotName: r.fromDepotId ? (depotName.get(r.fromDepotId) ?? null) : null,
    fromSiteName: r.fromSiteId ? (siteName.get(r.fromSiteId) ?? null) : null,
    toDepotName: r.toDepotId ? (depotName.get(r.toDepotId) ?? null) : null,
    toSiteName: r.toSiteId ? (siteName.get(r.toSiteId) ?? null) : null,
    transferredAt: r.transferredAt,
    transferredByName: r.transferredByName,
    note: r.note,
  }))
}

export interface TransferResult {
  toolId: string
  // Localisations de départ, pour revalider les fiches dépôt/chantier impactées.
  fromDepotId: string | null
  fromSiteId: string | null
  toDepotId: string | null
  toSiteId: string | null
}

/**
 * Transfère un matériel vers un dépôt OU un chantier (transaction).
 * - valide la destination dans l'org,
 * - `from*` = localisation actuelle du matériel,
 * - met à jour `tool.current*` (exclusif),
 * - STATUT AUTO : → chantier ⇒ `en_service` ; → dépôt ⇒ `disponible`,
 *   SAUF si le statut est protégé (panne/réparation/hors service/perdu).
 */
export const createTransfer = async (
  ctx: OrgContext,
  toolId: string,
  input: ToolTransferCreateInput
): Promise<TransferResult> => {
  requirePermission(ctx, 'toolTransfer', 'create')

  if (input.destinationKind === 'depot') await assertDepotInOrg(ctx, input.destinationId)
  else await assertSiteInOrg(ctx, input.destinationId)

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        currentDepotId: tool.currentDepotId,
        currentSiteId: tool.currentSiteId,
        status: tool.status,
      })
      .from(tool)
      .where(
        and(
          eq(tool.id, toolId),
          eq(tool.organizationId, ctx.organizationId),
          isNull(tool.deletedAt)
        )
      )
      .limit(1)

    if (!current) throw new NotFoundError('Matériel introuvable')

    const toDepotId = input.destinationKind === 'depot' ? input.destinationId : null
    const toSiteId = input.destinationKind === 'site' ? input.destinationId : null

    // Statut auto, sans écraser un statut protégé.
    const protectedStatus = PROTECTED_STATUSES.includes(current.status)
    const nextStatus = protectedStatus
      ? current.status
      : input.destinationKind === 'site'
        ? 'en_service'
        : 'disponible'

    await tx.insert(toolTransfer).values({
      organizationId: ctx.organizationId,
      toolId,
      fromDepotId: current.currentDepotId,
      fromSiteId: current.currentSiteId,
      toDepotId,
      toSiteId,
      transferredById: ctx.memberId,
      note: input.note ?? null,
    })

    await tx
      .update(tool)
      .set({ currentDepotId: toDepotId, currentSiteId: toSiteId, status: nextStatus })
      .where(and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId)))

    return {
      toolId,
      fromDepotId: current.currentDepotId,
      fromSiteId: current.currentSiteId,
      toDepotId,
      toSiteId,
    }
  })
}
