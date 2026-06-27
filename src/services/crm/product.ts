import 'server-only'
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { product, productCategory, productSubcategory, stockLevel } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import type {
  ProductCreateInput,
  ProductListParams,
  ProductUpdateInput,
} from '@/validation/product'
import { assertCategoryInOrg, assertSubcategoryInCategory } from './product-category'
import { applyEntryTx } from './stock'
import { assertDepotInOrg } from './tool'

/**
 * Services — produits (catalogue stock). La quantité n'est jamais stockée sur le
 * produit : elle dérive des `stock_level`. Le WAC (coût moyen pondéré) est amorcé
 * à la création (stock initial) puis recalculé à chaque réception.
 *
 * Règle d'or multi-tenant : toute requête filtre `organizationId`.
 */

/** Quantité en dépôts (= stock global, hors chantiers) d'un produit. */
const globalQtyExpr = sql<string>`coalesce((
  select sum(sl.quantity) from ${stockLevel} sl
  where sl.product_id = ${product.id}
    and sl.organization_id = ${product.organizationId}
    and sl.depot_id is not null
), 0)`

/** Vérifie qu'un produit appartient à l'org (non supprimé). */
export const assertProductInOrg = async (ctx: OrgContext, productId: string): Promise<void> => {
  const [row] = await db
    .select({ id: product.id })
    .from(product)
    .where(
      and(
        eq(product.id, productId),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Produit introuvable')
}

export interface ProductOption {
  id: string
  title: string
  unit: string
}

export const listProductOptions = async (ctx: OrgContext): Promise<ProductOption[]> => {
  requirePermission(ctx, 'product', 'read')
  return db
    .select({ id: product.id, title: product.title, unit: product.unit })
    .from(product)
    .where(and(eq(product.organizationId, ctx.organizationId), isNull(product.deletedAt)))
    .orderBy(asc(product.title))
}

export interface ProductListItem {
  id: string
  title: string
  unit: string
  imagePath: string | null
  categoryName: string | null
  subcategoryName: string | null
  weightedAvgPrice: number
  globalQuantity: number
  globalValue: number
  alertThreshold: number | null
  belowThreshold: boolean
}

export interface ProductListResult {
  items: ProductListItem[]
  total: number
  page: number
  pageSize: number
}

export const listProducts = async (
  ctx: OrgContext,
  params: ProductListParams
): Promise<ProductListResult> => {
  requirePermission(ctx, 'product', 'read')

  const conditions = [eq(product.organizationId, ctx.organizationId), isNull(product.deletedAt)]
  if (params.categoryId) conditions.push(eq(product.categoryId, params.categoryId))
  if (params.subcategoryId) conditions.push(eq(product.subcategoryId, params.subcategoryId))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(ilike(product.title, pattern), ilike(product.description, pattern))
    if (search) conditions.push(search)
  }
  const where = and(...conditions)
  const offset = (params.page - 1) * params.pageSize

  const rows = await db
    .select({
      id: product.id,
      title: product.title,
      unit: product.unit,
      imagePath: product.imagePath,
      categoryName: productCategory.name,
      subcategoryName: productSubcategory.name,
      weightedAvgPrice: product.weightedAvgPrice,
      globalQuantity: globalQtyExpr,
      alertThreshold: product.alertThreshold,
    })
    .from(product)
    .leftJoin(productCategory, eq(product.categoryId, productCategory.id))
    .leftJoin(productSubcategory, eq(product.subcategoryId, productSubcategory.id))
    .where(where)
    .orderBy(desc(product.createdAt))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(product)
    .where(where)

  const items = rows.map((r) => {
    const globalQuantity = Number(r.globalQuantity)
    const weightedAvgPrice = Number(r.weightedAvgPrice)
    const alertThreshold = r.alertThreshold != null ? Number(r.alertThreshold) : null
    return {
      id: r.id,
      title: r.title,
      unit: r.unit,
      imagePath: r.imagePath,
      categoryName: r.categoryName,
      subcategoryName: r.subcategoryName,
      weightedAvgPrice,
      globalQuantity,
      globalValue: globalQuantity * weightedAvgPrice,
      alertThreshold,
      belowThreshold: alertThreshold != null && globalQuantity <= alertThreshold,
    }
  })

  return { items, total: count, page: params.page, pageSize: params.pageSize }
}

export interface ProductLabelData {
  id: string
  title: string
  unit: string
  imagePath: string | null
  categoryName: string | null
  subcategoryName: string | null
}

/**
 * Produits (données d'étiquette) pour une liste d'ids, filtrés sur l'org.
 * L'ordre d'entrée est préservé pour stabiliser la planche d'impression.
 */
export const listProductsByIds = async (
  ctx: OrgContext,
  productIds: string[]
): Promise<ProductLabelData[]> => {
  requirePermission(ctx, 'product', 'read')
  if (productIds.length === 0) return []

  const rows = await db
    .select({
      id: product.id,
      title: product.title,
      unit: product.unit,
      imagePath: product.imagePath,
      categoryName: productCategory.name,
      subcategoryName: productSubcategory.name,
    })
    .from(product)
    .leftJoin(productCategory, eq(product.categoryId, productCategory.id))
    .leftJoin(productSubcategory, eq(product.subcategoryId, productSubcategory.id))
    .where(
      and(
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt),
        inArray(product.id, productIds)
      )
    )

  const byId = new Map(rows.map((r) => [r.id, r]))
  return productIds.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => r != null)
}

export const getProduct = async (ctx: OrgContext, id: string) => {
  requirePermission(ctx, 'product', 'read')

  const [row] = await db
    .select({
      product,
      categoryName: productCategory.name,
      subcategoryName: productSubcategory.name,
    })
    .from(product)
    .leftJoin(productCategory, eq(product.categoryId, productCategory.id))
    .leftJoin(productSubcategory, eq(product.subcategoryId, productSubcategory.id))
    .where(
      and(
        eq(product.id, id),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
    .limit(1)

  if (!row) throw new NotFoundError('Produit introuvable')
  return { ...row.product, categoryName: row.categoryName, subcategoryName: row.subcategoryName }
}

export const createProduct = async (ctx: OrgContext, input: ProductCreateInput) => {
  requirePermission(ctx, 'product', 'create')
  await assertCategoryInOrg(ctx, input.categoryId)
  await assertSubcategoryInCategory(ctx, input.subcategoryId, input.categoryId)
  // Valider chaque dépôt destination du stock initial.
  for (const line of input.initialStock) await assertDepotInOrg(ctx, line.depotId)

  const initialPrice = input.initialPurchasePrice ?? 0

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(product)
      .values({
        organizationId: ctx.organizationId,
        title: input.title,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        unit: input.unit,
        description: input.description ?? null,
        weightedAvgPrice: '0',
        initialPurchasePrice:
          input.initialPurchasePrice != null ? String(input.initialPurchasePrice) : null,
        alertThreshold: input.alertThreshold != null ? String(input.alertThreshold) : null,
      })
      .returning()

    // Stock initial : une entrée par dépôt, au prix d'achat unitaire commun.
    for (const line of input.initialStock) {
      await applyEntryTx(tx, ctx, {
        productId: created.id,
        quantity: line.quantity,
        unitPrice: initialPrice,
        to: { depotId: line.depotId, siteId: null },
        note: 'Stock initial',
      })
    }

    return created
  })
}

export const updateProduct = async (ctx: OrgContext, id: string, input: ProductUpdateInput) => {
  requirePermission(ctx, 'product', 'update')
  await assertCategoryInOrg(ctx, input.categoryId)
  await assertSubcategoryInCategory(ctx, input.subcategoryId, input.categoryId)

  const [updated] = await db
    .update(product)
    .set({
      title: input.title,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      unit: input.unit,
      description: input.description ?? null,
      alertThreshold: input.alertThreshold != null ? String(input.alertThreshold) : null,
    })
    .where(
      and(
        eq(product.id, id),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
    .returning()

  if (!updated) throw new NotFoundError('Produit introuvable')
  return updated
}

/** Soft-delete d'un produit (refusé s'il reste du stock détenu). */
export const softDeleteProduct = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'product', 'delete')
  await assertProductInOrg(ctx, id)

  const [row] = await db
    .select({ total: sql<string | null>`coalesce(sum(${stockLevel.quantity}), 0)` })
    .from(stockLevel)
    .where(and(eq(stockLevel.productId, id), eq(stockLevel.organizationId, ctx.organizationId)))
  if (Number(row?.total ?? 0) > 0) {
    throw new ForbiddenError(
      'Produit avec du stock restant : transférer/épuiser le stock avant suppression'
    )
  }

  await db
    .update(product)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(product.id, id),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
}

const imageStoragePath = (ctx: OrgContext, productId: string, fileName: string) =>
  `${ctx.organizationId}/products/${productId}/${Date.now()}-${fileName}`

/** Envoie/remplace l'image d'un produit (une seule image par produit). */
export const uploadProductImage = async (
  ctx: OrgContext,
  input: { productId: string; file: File }
): Promise<{ imagePath: string }> => {
  requirePermission(ctx, 'product', 'update')
  await assertProductInOrg(ctx, input.productId)

  const [current] = await db
    .select({ imagePath: product.imagePath })
    .from(product)
    .where(and(eq(product.id, input.productId), eq(product.organizationId, ctx.organizationId)))
    .limit(1)

  const safeName = input.file.name.replace(/[^\w.-]+/g, '_')
  const path = imageStoragePath(ctx, input.productId, safeName)
  await uploadObject(path, input.file, input.file.type || 'application/octet-stream')

  await db
    .update(product)
    .set({ imagePath: path })
    .where(and(eq(product.id, input.productId), eq(product.organizationId, ctx.organizationId)))

  // Best-effort : supprimer l'ancienne image.
  if (current?.imagePath) await deleteObject(current.imagePath).catch(() => {})

  return { imagePath: path }
}

/** URL signée temporaire pour afficher l'image d'un produit. */
export const getProductImageUrl = async (
  ctx: OrgContext,
  productId: string
): Promise<string | null> => {
  requirePermission(ctx, 'product', 'read')
  const [row] = await db
    .select({ imagePath: product.imagePath })
    .from(product)
    .where(
      and(
        eq(product.id, productId),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
    .limit(1)
  if (!row?.imagePath) return null
  return createSignedDownloadUrl(row.imagePath)
}
