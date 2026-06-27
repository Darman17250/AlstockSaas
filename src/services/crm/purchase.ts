import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { depot, product, purchase, purchaseLine, site, supplier } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type {
  PurchaseCreateInput,
  PurchaseUpdateInput,
  PurchaseValidateInput,
} from '@/validation/purchase'
import { assertProductInOrg } from './product'
import { applyEntryTx } from './stock'
import { assertSupplierInOrg } from './supplier'
import { assertDepotInOrg, assertSiteInOrg } from './tool'

/**
 * Services — achats (bons de réception). Un achat `brouillon` n'impacte pas le
 * stock ; sa validation réceptionne chaque ligne vers sa destination (dépôt ou
 * chantier), incrémente le stock et recalcule le WAC du produit. La validation
 * est idempotente (un achat déjà validé ne peut pas l'être à nouveau).
 *
 * Règle d'or multi-tenant : toute requête filtre `organizationId`.
 */

export interface PurchaseListItem {
  id: string
  reference: string | null
  status: string
  orderDate: string | null
  supplierName: string | null
  total: number
  lineCount: number
}

export const listPurchases = async (ctx: OrgContext): Promise<PurchaseListItem[]> => {
  requirePermission(ctx, 'purchase', 'read')

  const purchases = await db
    .select({
      id: purchase.id,
      reference: purchase.reference,
      status: purchase.status,
      orderDate: purchase.orderDate,
      supplierName: supplier.name,
    })
    .from(purchase)
    .leftJoin(supplier, eq(purchase.supplierId, supplier.id))
    .where(and(eq(purchase.organizationId, ctx.organizationId), isNull(purchase.deletedAt)))
    .orderBy(desc(purchase.createdAt))

  const lines = await db
    .select({
      purchaseId: purchaseLine.purchaseId,
      quantity: purchaseLine.quantity,
      unitPrice: purchaseLine.unitPrice,
    })
    .from(purchaseLine)
    .where(eq(purchaseLine.organizationId, ctx.organizationId))

  const totals = new Map<string, { total: number; count: number }>()
  for (const l of lines) {
    const cur = totals.get(l.purchaseId) ?? { total: 0, count: 0 }
    cur.total += Number(l.quantity) * Number(l.unitPrice)
    cur.count += 1
    totals.set(l.purchaseId, cur)
  }

  return purchases.map((p) => ({
    ...p,
    total: totals.get(p.id)?.total ?? 0,
    lineCount: totals.get(p.id)?.count ?? 0,
  }))
}

export interface PurchaseLineDetail {
  id: string
  productId: string
  productTitle: string
  unit: string
  quantity: number
  unitPrice: number
  destinationName: string | null
}

export const getPurchase = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'purchase', 'read')

  const [header] = await db
    .select({
      purchase,
      supplierName: supplier.name,
    })
    .from(purchase)
    .leftJoin(supplier, eq(purchase.supplierId, supplier.id))
    .where(
      and(
        eq(purchase.id, id),
        eq(purchase.organizationId, ctx.organizationId),
        isNull(purchase.deletedAt)
      )
    )
    .limit(1)

  if (!header) throw new NotFoundError('Achat introuvable')

  const lines = await db
    .select({
      id: purchaseLine.id,
      productId: purchaseLine.productId,
      productTitle: product.title,
      unit: product.unit,
      quantity: purchaseLine.quantity,
      unitPrice: purchaseLine.unitPrice,
      destinationDepotName: depot.name,
      destinationSiteName: site.name,
    })
    .from(purchaseLine)
    .leftJoin(product, eq(purchaseLine.productId, product.id))
    .leftJoin(depot, eq(purchaseLine.destinationDepotId, depot.id))
    .leftJoin(site, eq(purchaseLine.destinationSiteId, site.id))
    .where(
      and(eq(purchaseLine.purchaseId, id), eq(purchaseLine.organizationId, ctx.organizationId))
    )

  const lineDetails: PurchaseLineDetail[] = lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    productTitle: l.productTitle ?? '—',
    unit: l.unit ?? 'u',
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    destinationName: l.destinationDepotName ?? l.destinationSiteName ?? null,
  }))

  return {
    ...header.purchase,
    supplierName: header.supplierName,
    lines: lineDetails,
    total: lineDetails.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
  }
}

const assertLinesProductsInOrg = async (ctx: OrgContext, input: PurchaseCreateInput) => {
  for (const line of input.lines) await assertProductInOrg(ctx, line.productId)
}

export const createPurchase = async (ctx: OrgContext, input: PurchaseCreateInput) => {
  requirePermission(ctx, 'purchase', 'create')
  if (input.supplierId) await assertSupplierInOrg(ctx, input.supplierId)
  await assertLinesProductsInOrg(ctx, input)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(purchase)
      .values({
        organizationId: ctx.organizationId,
        supplierId: input.supplierId ?? null,
        reference: input.reference ?? null,
        orderDate: input.orderDate ?? null,
        notes: input.notes ?? null,
        status: 'brouillon',
      })
      .returning()

    await tx.insert(purchaseLine).values(
      input.lines.map((l) => ({
        organizationId: ctx.organizationId,
        purchaseId: created.id,
        productId: l.productId,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
      }))
    )

    return created
  })
}

/** Met à jour un achat brouillon (remplace les lignes). Refusé si déjà validé. */
export const updatePurchase = async (ctx: OrgContext, id: string, input: PurchaseUpdateInput) => {
  requirePermission(ctx, 'purchase', 'update')
  if (input.supplierId) await assertSupplierInOrg(ctx, input.supplierId)
  await assertLinesProductsInOrg(ctx, input)

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: purchase.status })
      .from(purchase)
      .where(
        and(
          eq(purchase.id, id),
          eq(purchase.organizationId, ctx.organizationId),
          isNull(purchase.deletedAt)
        )
      )
      .limit(1)
    if (!existing) throw new NotFoundError('Achat introuvable')
    if (existing.status !== 'brouillon') {
      throw new ForbiddenError('Seul un achat en cours peut être modifié')
    }

    await tx
      .update(purchase)
      .set({
        supplierId: input.supplierId ?? null,
        reference: input.reference ?? null,
        orderDate: input.orderDate ?? null,
        notes: input.notes ?? null,
      })
      .where(and(eq(purchase.id, id), eq(purchase.organizationId, ctx.organizationId)))

    await tx
      .delete(purchaseLine)
      .where(
        and(eq(purchaseLine.purchaseId, id), eq(purchaseLine.organizationId, ctx.organizationId))
      )

    await tx.insert(purchaseLine).values(
      input.lines.map((l) => ({
        organizationId: ctx.organizationId,
        purchaseId: id,
        productId: l.productId,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
      }))
    )
  })
}

export const softDeletePurchase = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'purchase', 'delete')
  const [existing] = await db
    .select({ status: purchase.status })
    .from(purchase)
    .where(
      and(
        eq(purchase.id, id),
        eq(purchase.organizationId, ctx.organizationId),
        isNull(purchase.deletedAt)
      )
    )
    .limit(1)
  if (!existing) throw new NotFoundError('Achat introuvable')
  if (existing.status === 'validee') {
    throw new ForbiddenError('Un achat validé (réceptionné) ne peut pas être supprimé')
  }

  await db
    .update(purchase)
    .set({ deletedAt: new Date() })
    .where(and(eq(purchase.id, id), eq(purchase.organizationId, ctx.organizationId)))
}

export interface ValidatePurchaseResult {
  affectedDepotIds: string[]
  affectedSiteIds: string[]
}

/**
 * Valide (réceptionne) un achat brouillon : pour chaque ligne, applique l'entrée
 * de stock à sa destination, recalcule le WAC, journalise. Idempotent : refuse
 * un achat déjà validé/annulé.
 */
export const validatePurchase = async (
  ctx: OrgContext,
  id: string,
  input: PurchaseValidateInput
): Promise<ValidatePurchaseResult> => {
  requirePermission(ctx, 'purchase', 'update')

  // Pré-valider l'appartenance des destinations à l'organisation (hors transaction).
  for (const dest of input.destinations) {
    if (dest.destinationKind === 'depot') await assertDepotInOrg(ctx, dest.destinationId)
    else await assertSiteInOrg(ctx, dest.destinationId)
  }
  const destByLine = new Map(input.destinations.map((d) => [d.lineId, d]))

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: purchase.status, reference: purchase.reference })
      .from(purchase)
      .where(
        and(
          eq(purchase.id, id),
          eq(purchase.organizationId, ctx.organizationId),
          isNull(purchase.deletedAt)
        )
      )
      .limit(1)
    if (!existing) throw new NotFoundError('Achat introuvable')
    if (existing.status !== 'brouillon') {
      throw new ForbiddenError('Cet achat est déjà validé ou annulé')
    }

    const lines = await tx
      .select({
        id: purchaseLine.id,
        productId: purchaseLine.productId,
        quantity: purchaseLine.quantity,
        unitPrice: purchaseLine.unitPrice,
      })
      .from(purchaseLine)
      .where(
        and(eq(purchaseLine.purchaseId, id), eq(purchaseLine.organizationId, ctx.organizationId))
      )

    if (lines.length === 0) throw new ForbiddenError('Achat sans ligne à réceptionner')

    const affectedDepotIds = new Set<string>()
    const affectedSiteIds = new Set<string>()
    const note = existing.reference ? `Réception achat ${existing.reference}` : 'Réception achat'

    for (const line of lines) {
      const dest = destByLine.get(line.id)
      if (!dest) throw new ForbiddenError('Destination manquante pour une ligne')

      const to =
        dest.destinationKind === 'depot'
          ? { depotId: dest.destinationId, siteId: null }
          : { depotId: null, siteId: dest.destinationId }

      // Enregistre la destination choisie sur la ligne.
      await tx
        .update(purchaseLine)
        .set({
          destinationDepotId: to.depotId,
          destinationSiteId: to.siteId,
        })
        .where(eq(purchaseLine.id, line.id))

      await applyEntryTx(tx, ctx, {
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        to,
        purchaseId: id,
        note,
      })

      if (to.depotId) affectedDepotIds.add(to.depotId)
      if (to.siteId) affectedSiteIds.add(to.siteId)
    }

    await tx
      .update(purchase)
      .set({ status: 'validee', validatedAt: new Date() })
      .where(and(eq(purchase.id, id), eq(purchase.organizationId, ctx.organizationId)))

    return {
      affectedDepotIds: [...affectedDepotIds],
      affectedSiteIds: [...affectedSiteIds],
    }
  })
}
