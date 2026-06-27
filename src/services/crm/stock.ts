import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { depot, product, site, stockLevel, stockMovement } from '@/database/schema'
import { type OrgContext, NotFoundError } from '@/lib/auth/org-context'

/**
 * Cœur du stock — primitives transactionnelles partagées (création produit,
 * réception d'achat, transferts). Un produit est une quantité fongible répartie
 * sur plusieurs localisations (`stock_level`, dépôt XOR chantier). Le coût moyen
 * pondéré (WAC) est stocké sur le produit et recalculé à chaque ENTRÉE ; les
 * transferts/retours ne le modifient pas.
 *
 * Règle d'or multi-tenant : toute requête filtre `organizationId`.
 */

/** Transaction Drizzle (type dérivé du client). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Levée quand un transfert/sortie dépasse la quantité disponible. */
export class InsufficientStockError extends Error {
  constructor(message = 'Stock insuffisant pour cette opération') {
    super(message)
    this.name = 'InsufficientStockError'
  }
}

/** Localisation d'un niveau de stock : exactement un des deux est non-null. */
export interface StockLocation {
  depotId: string | null
  siteId: string | null
}

const DEC3 = (n: number) => n.toFixed(3)
const DEC4 = (n: number) => n.toFixed(4)

const locWhere = (loc: StockLocation) =>
  loc.depotId ? eq(stockLevel.depotId, loc.depotId) : eq(stockLevel.siteId, loc.siteId as string)

/**
 * Ajuste (delta) la quantité d'un niveau de stock dans une transaction, avec
 * verrou ligne. Crée le niveau si absent (delta ≥ 0). Lève `InsufficientStockError`
 * si une sortie ferait passer la quantité sous zéro.
 */
export const adjustStockLevelTx = async (
  tx: Tx,
  ctx: OrgContext,
  productId: string,
  loc: StockLocation,
  delta: number
): Promise<void> => {
  const [existing] = await tx
    .select({ id: stockLevel.id, quantity: stockLevel.quantity })
    .from(stockLevel)
    .where(
      and(
        eq(stockLevel.productId, productId),
        eq(stockLevel.organizationId, ctx.organizationId),
        locWhere(loc)
      )
    )
    .for('update')
    .limit(1)

  const current = existing ? Number(existing.quantity) : 0
  const next = current + delta
  if (next < -1e-9) throw new InsufficientStockError()

  if (existing) {
    await tx
      .update(stockLevel)
      .set({ quantity: DEC3(Math.max(next, 0)) })
      .where(eq(stockLevel.id, existing.id))
  } else {
    await tx.insert(stockLevel).values({
      organizationId: ctx.organizationId,
      productId,
      depotId: loc.depotId,
      siteId: loc.siteId,
      quantity: DEC3(Math.max(next, 0)),
    })
  }
}

/** Insère une ligne au journal des mouvements (append-only). */
export const recordMovementTx = async (
  tx: Tx,
  ctx: OrgContext,
  input: {
    productId: string
    type: 'reception' | 'transfer' | 'return' | 'adjustment'
    quantity: number
    unitPrice: number | null
    from?: StockLocation
    to?: StockLocation
    purchaseId?: string | null
    note?: string | null
  }
): Promise<void> => {
  await tx.insert(stockMovement).values({
    organizationId: ctx.organizationId,
    productId: input.productId,
    type: input.type,
    fromDepotId: input.from?.depotId ?? null,
    fromSiteId: input.from?.siteId ?? null,
    toDepotId: input.to?.depotId ?? null,
    toSiteId: input.to?.siteId ?? null,
    quantity: DEC3(input.quantity),
    unitPrice: input.unitPrice != null ? DEC4(input.unitPrice) : null,
    purchaseId: input.purchaseId ?? null,
    note: input.note ?? null,
    movedById: ctx.memberId,
  })
}

/**
 * Applique une ENTRÉE de stock (réception / stock initial) dans une transaction :
 * incrémente le niveau destination, recalcule le WAC du produit, journalise le
 * mouvement. `to` est une localisation (dépôt XOR chantier).
 */
export const applyEntryTx = async (
  tx: Tx,
  ctx: OrgContext,
  input: {
    productId: string
    quantity: number
    unitPrice: number
    to: StockLocation
    purchaseId?: string | null
    note?: string | null
  }
): Promise<void> => {
  if (input.quantity <= 0) return

  // Quantité totale détenue AVANT l'entrée (toutes localisations) + WAC courant.
  const [agg] = await tx
    .select({
      total: sql<string | null>`coalesce(sum(${stockLevel.quantity}), 0)`,
      wac: product.weightedAvgPrice,
    })
    .from(product)
    .leftJoin(
      stockLevel,
      and(eq(stockLevel.productId, product.id), eq(stockLevel.organizationId, ctx.organizationId))
    )
    .where(and(eq(product.id, input.productId), eq(product.organizationId, ctx.organizationId)))
    .groupBy(product.weightedAvgPrice)

  if (!agg) throw new NotFoundError('Produit introuvable')

  const totalBefore = Number(agg.total ?? 0)
  const wacBefore = Number(agg.wac ?? 0)
  const newTotal = totalBefore + input.quantity
  const newWac =
    newTotal > 0 ? (totalBefore * wacBefore + input.quantity * input.unitPrice) / newTotal : 0

  await tx
    .update(product)
    .set({ weightedAvgPrice: DEC4(newWac) })
    .where(and(eq(product.id, input.productId), eq(product.organizationId, ctx.organizationId)))

  await adjustStockLevelTx(tx, ctx, input.productId, input.to, input.quantity)
  await recordMovementTx(tx, ctx, {
    productId: input.productId,
    type: 'reception',
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    to: input.to,
    purchaseId: input.purchaseId ?? null,
    note: input.note ?? null,
  })
}

// ── Lectures (valeur / répartition) ──────────────────────────────────────────

export interface ProductStockSummary {
  /** Quantité en dépôts (= stock global, hors chantiers). */
  globalQuantity: number
  /** Quantité totale détenue (dépôts + chantiers). */
  totalQuantity: number
  /** Quantité déployée sur des chantiers actifs (non terminés / non annulés). */
  activeSiteQuantity: number
}

/** Stock global (dépôts), total détenu et quantité sur chantiers actifs. */
export const getProductStockSummary = async (
  ctx: OrgContext,
  productId: string
): Promise<ProductStockSummary> => {
  const [row] = await db
    .select({
      total: sql<string | null>`coalesce(sum(${stockLevel.quantity}), 0)`,
      global: sql<
        string | null
      >`coalesce(sum(case when ${stockLevel.depotId} is not null then ${stockLevel.quantity} else 0 end), 0)`,
      activeSite: sql<string | null>`coalesce(sum(case when ${stockLevel.siteId} is not null
        and ${site.status} not in ('termine', 'annule')
        and ${site.deletedAt} is null
        then ${stockLevel.quantity} else 0 end), 0)`,
    })
    .from(stockLevel)
    .leftJoin(site, eq(stockLevel.siteId, site.id))
    .where(
      and(eq(stockLevel.productId, productId), eq(stockLevel.organizationId, ctx.organizationId))
    )

  return {
    globalQuantity: Number(row?.global ?? 0),
    totalQuantity: Number(row?.total ?? 0),
    activeSiteQuantity: Number(row?.activeSite ?? 0),
  }
}

export interface LocationStockItem {
  productId: string
  title: string
  unit: string
  imagePath: string | null
  quantity: number
  unitPrice: number
  value: number
}

/** Produits présents (qté > 0) sur une localisation (dépôt ou chantier) + valeur. */
export const listStockForLocation = async (
  ctx: OrgContext,
  loc: StockLocation
): Promise<LocationStockItem[]> => {
  const rows = await db
    .select({
      productId: product.id,
      title: product.title,
      unit: product.unit,
      imagePath: product.imagePath,
      quantity: stockLevel.quantity,
      unitPrice: product.weightedAvgPrice,
    })
    .from(stockLevel)
    .innerJoin(product, eq(stockLevel.productId, product.id))
    .where(
      and(
        eq(stockLevel.organizationId, ctx.organizationId),
        locWhere(loc),
        isNull(product.deletedAt),
        sql`${stockLevel.quantity} > 0`
      )
    )
    .orderBy(product.title)

  return rows.map((r) => {
    const quantity = Number(r.quantity)
    const unitPrice = Number(r.unitPrice)
    return {
      productId: r.productId,
      title: r.title,
      unit: r.unit,
      imagePath: r.imagePath,
      quantity,
      unitPrice,
      value: quantity * unitPrice,
    }
  })
}

export interface ProductDistributionItem {
  locationType: 'depot' | 'site'
  locationId: string
  locationName: string
  quantity: number
  value: number
}

/** Répartition d'un produit par localisation (dépôts + chantiers), qté > 0. */
export const listProductDistribution = async (
  ctx: OrgContext,
  productId: string,
  unitPrice: number
): Promise<ProductDistributionItem[]> => {
  const rows = await db
    .select({
      depotId: stockLevel.depotId,
      siteId: stockLevel.siteId,
      depotName: depot.name,
      siteName: site.name,
      quantity: stockLevel.quantity,
    })
    .from(stockLevel)
    .leftJoin(depot, eq(stockLevel.depotId, depot.id))
    .leftJoin(site, eq(stockLevel.siteId, site.id))
    .where(
      and(
        eq(stockLevel.productId, productId),
        eq(stockLevel.organizationId, ctx.organizationId),
        sql`${stockLevel.quantity} > 0`
      )
    )

  return rows
    .map((r) => {
      const quantity = Number(r.quantity)
      const isDepot = r.depotId != null
      return {
        locationType: (isDepot ? 'depot' : 'site') as 'depot' | 'site',
        locationId: (isDepot ? r.depotId : r.siteId) as string,
        locationName: (isDepot ? r.depotName : r.siteName) ?? '—',
        quantity,
        value: quantity * unitPrice,
      }
    })
    .sort((a, b) => a.locationName.localeCompare(b.locationName))
}

/** Valeur totale du stock présent sur une localisation. */
export const getLocationStockValue = async (
  ctx: OrgContext,
  loc: StockLocation
): Promise<number> => {
  const [row] = await db
    .select({
      value: sql<
        string | null
      >`coalesce(sum(${stockLevel.quantity} * ${product.weightedAvgPrice}), 0)`,
    })
    .from(stockLevel)
    .innerJoin(product, eq(stockLevel.productId, product.id))
    .where(
      and(
        eq(stockLevel.organizationId, ctx.organizationId),
        locWhere(loc),
        isNull(product.deletedAt)
      )
    )

  return Number(row?.value ?? 0)
}
