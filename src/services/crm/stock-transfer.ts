import 'server-only'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import { depot, member, product, site, stockMovement, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { StockTransferCreateInput } from '@/validation/stock-transfer'
import { assertProductInOrg } from './product'
import { type StockLocation, adjustStockLevelTx, recordMovementTx } from './stock'
import { assertDepotInOrg, assertSiteInOrg } from './tool'

/**
 * Services — transferts de stock entre dépôts et chantiers (journal append-only).
 * La quantité est vérifiée disponible à la source (verrou ligne), puis déplacée.
 * Les transferts ne modifient PAS le WAC du produit.
 */

export interface StockTransferResult {
  productId: string
  fromDepotId: string | null
  fromSiteId: string | null
  toDepotId: string | null
  toSiteId: string | null
}

export const createStockTransfer = async (
  ctx: OrgContext,
  productId: string,
  input: StockTransferCreateInput
): Promise<StockTransferResult> => {
  requirePermission(ctx, 'stockMovement', 'create')
  await assertProductInOrg(ctx, productId)

  // Résout source/destination selon le sens (chantier → chantier impossible).
  let from: StockLocation
  let to: StockLocation
  if (input.direction === 'depot_depot') {
    await assertDepotInOrg(ctx, input.sourceId)
    await assertDepotInOrg(ctx, input.destinationId)
    from = { depotId: input.sourceId, siteId: null }
    to = { depotId: input.destinationId, siteId: null }
  } else if (input.direction === 'depot_site') {
    await assertDepotInOrg(ctx, input.sourceId)
    await assertSiteInOrg(ctx, input.destinationId)
    from = { depotId: input.sourceId, siteId: null }
    to = { depotId: null, siteId: input.destinationId }
  } else {
    // site_depot (retour chantier)
    await assertSiteInOrg(ctx, input.sourceId)
    await assertDepotInOrg(ctx, input.destinationId)
    from = { depotId: null, siteId: input.sourceId }
    to = { depotId: input.destinationId, siteId: null }
  }

  if (input.sourceId === input.destinationId) {
    throw new ForbiddenError('La source et la destination doivent être différentes')
  }

  const movementType = input.direction === 'site_depot' ? 'return' : 'transfer'

  // WAC courant (pour valoriser le mouvement).
  const [row] = await db
    .select({ wac: product.weightedAvgPrice })
    .from(product)
    .where(and(eq(product.id, productId), eq(product.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new NotFoundError('Produit introuvable')
  const unitPrice = Number(row.wac)

  return db.transaction(async (tx) => {
    // Sortie source (vérifie la disponibilité), puis entrée destination.
    await adjustStockLevelTx(tx, ctx, productId, from, -input.quantity)
    await adjustStockLevelTx(tx, ctx, productId, to, input.quantity)
    await recordMovementTx(tx, ctx, {
      productId,
      type: movementType,
      quantity: input.quantity,
      unitPrice,
      from,
      to,
      note: input.note ?? null,
    })

    return {
      productId,
      fromDepotId: from.depotId,
      fromSiteId: from.siteId,
      toDepotId: to.depotId,
      toSiteId: to.siteId,
    }
  })
}

export interface StockMovementItem {
  id: string
  type: string
  quantity: number
  unitPrice: number | null
  fromName: string | null
  toName: string | null
  note: string | null
  movedByName: string | null
  createdAt: Date
}

/** Journal des mouvements d'un produit (le plus récent en premier). */
export const listMovementsForProduct = async (
  ctx: OrgContext,
  productId: string
): Promise<StockMovementItem[]> => {
  requirePermission(ctx, 'stockMovement', 'read')

  const rows = await db
    .select({
      id: stockMovement.id,
      type: stockMovement.type,
      quantity: stockMovement.quantity,
      unitPrice: stockMovement.unitPrice,
      fromDepotId: stockMovement.fromDepotId,
      fromSiteId: stockMovement.fromSiteId,
      toDepotId: stockMovement.toDepotId,
      toSiteId: stockMovement.toSiteId,
      note: stockMovement.note,
      movedByName: user.name,
      createdAt: stockMovement.createdAt,
    })
    .from(stockMovement)
    .leftJoin(member, eq(stockMovement.movedById, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(stockMovement.productId, productId),
        eq(stockMovement.organizationId, ctx.organizationId)
      )
    )
    .orderBy(desc(stockMovement.createdAt))

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

  const nameOf = (depotId: string | null, siteId: string | null): string | null => {
    if (depotId) return depotName.get(depotId) ?? null
    if (siteId) return siteName.get(siteId) ?? null
    return null
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    quantity: Number(r.quantity),
    unitPrice: r.unitPrice != null ? Number(r.unitPrice) : null,
    fromName: nameOf(r.fromDepotId, r.fromSiteId),
    toName: nameOf(r.toDepotId, r.toSiteId),
    note: r.note,
    movedByName: r.movedByName,
    createdAt: r.createdAt,
  }))
}
