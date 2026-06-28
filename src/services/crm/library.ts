import 'server-only'
import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import {
  libraryCategory,
  libraryProduct,
  librarySubcategory,
  product,
  productCategory,
  productSubcategory,
} from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import { createSignedDownloadUrl } from '@/lib/supabase-storage'
import type {
  AddLibraryProductInput,
  BulkAddLibraryInput,
  LibraryListParams,
} from '@/validation/library'
import { assertDepotInOrg } from './tool'
import { applyEntryTx } from './stock'

/**
 * Services — bibliothèque catalogue, côté organisation. Le catalogue est une
 * référence GLOBALE en lecture seule (pas d'organizationId) ; les organisations
 * le parcourent (`product:read`) et copient un produit dans leur propre stock
 * (`product:create`). La copie crée un `product` org-scoped et réutilise
 * l'`imagePath` du catalogue (même bucket, pas de duplication de fichier).
 */

export interface LibraryCategoryNode {
  id: string
  name: string
  subcategories: { id: string; name: string }[]
}

/** Arborescence catégories → sous-catégories du catalogue (pour les filtres). */
export const listLibraryTreeForOrg = async (ctx: OrgContext): Promise<LibraryCategoryNode[]> => {
  requirePermission(ctx, 'product', 'read')

  const cats = await db
    .select({ id: libraryCategory.id, name: libraryCategory.name })
    .from(libraryCategory)
    .where(isNull(libraryCategory.deletedAt))
    .orderBy(asc(libraryCategory.position), asc(libraryCategory.name))

  const subs = await db
    .select({
      id: librarySubcategory.id,
      name: librarySubcategory.name,
      categoryId: librarySubcategory.categoryId,
    })
    .from(librarySubcategory)
    .where(isNull(librarySubcategory.deletedAt))
    .orderBy(asc(librarySubcategory.position), asc(librarySubcategory.name))

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: subs.filter((s) => s.categoryId === c.id).map((s) => ({ id: s.id, name: s.name })),
  }))
}

export interface LibraryBrowseItem {
  id: string
  title: string
  description: string | null
  unit: string
  imagePath: string | null
  categoryName: string | null
  subcategoryName: string | null
}

export interface LibraryBrowseResult {
  items: LibraryBrowseItem[]
  total: number
  page: number
  pageSize: number
}

export const browseLibrary = async (
  ctx: OrgContext,
  params: LibraryListParams
): Promise<LibraryBrowseResult> => {
  requirePermission(ctx, 'product', 'read')

  const conditions = [isNull(libraryProduct.deletedAt)]
  if (params.categoryId) conditions.push(eq(libraryProduct.categoryId, params.categoryId))
  if (params.subcategoryId) conditions.push(eq(libraryProduct.subcategoryId, params.subcategoryId))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(
      ilike(libraryProduct.title, pattern),
      ilike(libraryProduct.description, pattern)
    )
    if (search) conditions.push(search)
  }
  const where = and(...conditions)
  const offset = (params.page - 1) * params.pageSize

  const rows = await db
    .select({
      id: libraryProduct.id,
      title: libraryProduct.title,
      description: libraryProduct.description,
      unit: libraryProduct.unit,
      imagePath: libraryProduct.imagePath,
      categoryName: libraryCategory.name,
      subcategoryName: librarySubcategory.name,
    })
    .from(libraryProduct)
    .leftJoin(libraryCategory, eq(libraryProduct.categoryId, libraryCategory.id))
    .leftJoin(librarySubcategory, eq(libraryProduct.subcategoryId, librarySubcategory.id))
    .where(where)
    .orderBy(asc(libraryProduct.title))
    .limit(params.pageSize)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(libraryProduct)
    .where(where)

  return { items: rows, total: count, page: params.page, pageSize: params.pageSize }
}

/** URL signée pour afficher l'image d'un produit du catalogue (lecture org). */
export const getLibraryImageUrlForOrg = async (
  ctx: OrgContext,
  libraryProductId: string
): Promise<string | null> => {
  requirePermission(ctx, 'product', 'read')
  const [row] = await db
    .select({ imagePath: libraryProduct.imagePath })
    .from(libraryProduct)
    .where(and(eq(libraryProduct.id, libraryProductId), isNull(libraryProduct.deletedAt)))
    .limit(1)
  if (!row?.imagePath) return null
  return createSignedDownloadUrl(row.imagePath)
}

/** Catégorie org existante (par nom) ou création à la volée, dans une transaction. */
const findOrCreateOrgCategory = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  name: string
): Promise<string> => {
  const [existing] = await tx
    .select({ id: productCategory.id })
    .from(productCategory)
    .where(
      and(
        eq(productCategory.organizationId, organizationId),
        eq(productCategory.name, name),
        isNull(productCategory.deletedAt)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [created] = await tx
    .insert(productCategory)
    .values({ organizationId, name })
    .returning({ id: productCategory.id })
  return created.id
}

const findOrCreateOrgSubcategory = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  categoryId: string,
  name: string
): Promise<string> => {
  const [existing] = await tx
    .select({ id: productSubcategory.id })
    .from(productSubcategory)
    .where(
      and(
        eq(productSubcategory.organizationId, organizationId),
        eq(productSubcategory.categoryId, categoryId),
        eq(productSubcategory.name, name),
        isNull(productSubcategory.deletedAt)
      )
    )
    .limit(1)
  if (existing) return existing.id
  const [created] = await tx
    .insert(productSubcategory)
    .values({ organizationId, categoryId, name })
    .returning({ id: productSubcategory.id })
  return created.id
}

/**
 * Copie un produit du catalogue dans le stock de l'organisation. Crée (ou
 * réutilise) la catégorie et la sous-catégorie de l'org par nom, puis crée le
 * `product` en reprenant l'image du catalogue. Stock initial optionnel.
 */
export const addLibraryProductToOrg = async (
  ctx: OrgContext,
  input: AddLibraryProductInput
): Promise<{ id: string }> => {
  requirePermission(ctx, 'product', 'create')

  const [lib] = await db
    .select({
      title: libraryProduct.title,
      description: libraryProduct.description,
      unit: libraryProduct.unit,
      imagePath: libraryProduct.imagePath,
      categoryName: libraryCategory.name,
      subcategoryName: librarySubcategory.name,
    })
    .from(libraryProduct)
    .leftJoin(libraryCategory, eq(libraryProduct.categoryId, libraryCategory.id))
    .leftJoin(librarySubcategory, eq(libraryProduct.subcategoryId, librarySubcategory.id))
    .where(and(eq(libraryProduct.id, input.libraryProductId), isNull(libraryProduct.deletedAt)))
    .limit(1)

  if (!lib) throw new NotFoundError('Produit catalogue introuvable')

  for (const line of input.initialStock) await assertDepotInOrg(ctx, line.depotId)

  const categoryName = lib.categoryName ?? 'Catalogue'
  const subcategoryName = lib.subcategoryName ?? categoryName
  const initialPrice = input.initialPurchasePrice ?? 0

  return db.transaction(async (tx) => {
    const categoryId = await findOrCreateOrgCategory(tx, ctx.organizationId, categoryName)
    const subcategoryId = await findOrCreateOrgSubcategory(
      tx,
      ctx.organizationId,
      categoryId,
      subcategoryName
    )

    const [created] = await tx
      .insert(product)
      .values({
        organizationId: ctx.organizationId,
        title: lib.title,
        imagePath: lib.imagePath,
        categoryId,
        subcategoryId,
        unit: lib.unit,
        description: lib.description,
        weightedAvgPrice: '0',
        initialPurchasePrice:
          input.initialPurchasePrice != null ? String(input.initialPurchasePrice) : null,
        alertThreshold: input.alertThreshold != null ? String(input.alertThreshold) : null,
      })
      .returning({ id: product.id })

    for (const line of input.initialStock) {
      await applyEntryTx(tx, ctx, {
        productId: created.id,
        quantity: line.quantity,
        unitPrice: initialPrice,
        to: { depotId: line.depotId, siteId: null },
        note: 'Stock initial (catalogue)',
      })
    }

    return { id: created.id }
  })
}

// --- Vue par catégories (sélection multiple + ajout en masse) ---------------

export interface CatalogSubcategory {
  id: string
  name: string
  productCount: number
}

export interface CatalogCategory {
  id: string
  name: string
  productCount: number
  subcategories: CatalogSubcategory[]
}

/** Arborescence du catalogue avec le nombre de produits par catégorie/sous-catégorie. */
export const listLibraryCatalog = async (ctx: OrgContext): Promise<CatalogCategory[]> => {
  requirePermission(ctx, 'product', 'read')

  const cats = await db
    .select({ id: libraryCategory.id, name: libraryCategory.name })
    .from(libraryCategory)
    .where(isNull(libraryCategory.deletedAt))
    .orderBy(asc(libraryCategory.position), asc(libraryCategory.name))

  const subs = await db
    .select({
      id: librarySubcategory.id,
      name: librarySubcategory.name,
      categoryId: librarySubcategory.categoryId,
    })
    .from(librarySubcategory)
    .where(isNull(librarySubcategory.deletedAt))
    .orderBy(asc(librarySubcategory.position), asc(librarySubcategory.name))

  const counts = await db
    .select({
      categoryId: libraryProduct.categoryId,
      subcategoryId: libraryProduct.subcategoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(libraryProduct)
    .where(isNull(libraryProduct.deletedAt))
    .groupBy(libraryProduct.categoryId, libraryProduct.subcategoryId)

  const catCount = new Map<string, number>()
  const subCount = new Map<string, number>()
  for (const c of counts) {
    catCount.set(c.categoryId, (catCount.get(c.categoryId) ?? 0) + c.count)
    subCount.set(c.subcategoryId, (subCount.get(c.subcategoryId) ?? 0) + c.count)
  }

  return cats.map((cat) => ({
    id: cat.id,
    name: cat.name,
    productCount: catCount.get(cat.id) ?? 0,
    subcategories: subs
      .filter((s) => s.categoryId === cat.id)
      .map((s) => ({ id: s.id, name: s.name, productCount: subCount.get(s.id) ?? 0 })),
  }))
}

export interface LibrarySubProduct {
  id: string
  title: string
  unit: string
  imagePath: string | null
}

/** Produits d'une sous-catégorie du catalogue (chargement à la demande). */
export const listLibrarySubcategoryProducts = async (
  ctx: OrgContext,
  subcategoryId: string
): Promise<LibrarySubProduct[]> => {
  requirePermission(ctx, 'product', 'read')
  return db
    .select({
      id: libraryProduct.id,
      title: libraryProduct.title,
      unit: libraryProduct.unit,
      imagePath: libraryProduct.imagePath,
    })
    .from(libraryProduct)
    .where(and(eq(libraryProduct.subcategoryId, subcategoryId), isNull(libraryProduct.deletedAt)))
    .orderBy(asc(libraryProduct.title))
}

export interface BulkAddResult {
  added: number
  skipped: number
}

/**
 * Copie en masse des produits du catalogue dans le stock de l'org, à partir
 * d'une sélection de catégories, sous-catégories et/ou produits. Les doublons
 * (même titre qu'un produit existant de l'org, ou en double dans la sélection)
 * sont ignorés. Catégories/sous-catégories de l'org créées par nom au besoin.
 */
export const bulkAddLibraryProductsToOrg = async (
  ctx: OrgContext,
  input: BulkAddLibraryInput
): Promise<BulkAddResult> => {
  requirePermission(ctx, 'product', 'create')

  const orFilters = []
  if (input.categoryIds.length)
    orFilters.push(inArray(libraryProduct.categoryId, input.categoryIds))
  if (input.subcategoryIds.length)
    orFilters.push(inArray(libraryProduct.subcategoryId, input.subcategoryIds))
  if (input.productIds.length) orFilters.push(inArray(libraryProduct.id, input.productIds))
  if (orFilters.length === 0) return { added: 0, skipped: 0 }

  const libs = await db
    .select({
      title: libraryProduct.title,
      description: libraryProduct.description,
      unit: libraryProduct.unit,
      imagePath: libraryProduct.imagePath,
      categoryName: libraryCategory.name,
      subcategoryName: librarySubcategory.name,
    })
    .from(libraryProduct)
    .leftJoin(libraryCategory, eq(libraryProduct.categoryId, libraryCategory.id))
    .leftJoin(librarySubcategory, eq(libraryProduct.subcategoryId, librarySubcategory.id))
    .where(and(isNull(libraryProduct.deletedAt), or(...orFilters)))
    .orderBy(asc(libraryProduct.title))

  if (libs.length === 0) return { added: 0, skipped: 0 }

  const existing = await db
    .select({ title: product.title })
    .from(product)
    .where(and(eq(product.organizationId, ctx.organizationId), isNull(product.deletedAt)))
  const seen = new Set(existing.map((e) => e.title.trim().toLowerCase()))

  let added = 0
  let skipped = 0

  await db.transaction(async (tx) => {
    const catCache = new Map<string, string>()
    const subCache = new Map<string, string>()
    const getCat = async (name: string) => {
      const c = catCache.get(name)
      if (c) return c
      const id = await findOrCreateOrgCategory(tx, ctx.organizationId, name)
      catCache.set(name, id)
      return id
    }
    const getSub = async (categoryId: string, name: string) => {
      const k = `${categoryId}|||${name}`
      const c = subCache.get(k)
      if (c) return c
      const id = await findOrCreateOrgSubcategory(tx, ctx.organizationId, categoryId, name)
      subCache.set(k, id)
      return id
    }

    const toInsert: (typeof product.$inferInsert)[] = []
    for (const lib of libs) {
      const key = lib.title.trim().toLowerCase()
      if (seen.has(key)) {
        skipped++
        continue
      }
      seen.add(key)
      const categoryName = lib.categoryName ?? 'Catalogue'
      const subcategoryName = lib.subcategoryName ?? categoryName
      const categoryId = await getCat(categoryName)
      const subcategoryId = await getSub(categoryId, subcategoryName)
      toInsert.push({
        organizationId: ctx.organizationId,
        title: lib.title,
        imagePath: lib.imagePath,
        categoryId,
        subcategoryId,
        unit: lib.unit,
        description: lib.description,
        weightedAvgPrice: '0',
      })
      added++
    }

    const BATCH = 500
    for (let i = 0; i < toInsert.length; i += BATCH) {
      await tx.insert(product).values(toInsert.slice(i, i + BATCH))
    }
  })

  return { added, skipped }
}
