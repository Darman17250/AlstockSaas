import 'server-only'
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { libraryCategory, libraryProduct, librarySubcategory } from '@/database/schema'
import { ForbiddenError, NotFoundError } from '@/lib/auth/org-context'
import type { PlatformAdmin } from '@/lib/auth/platform-admin'
import { createSignedDownloadUrl, deleteObject, uploadObject } from '@/lib/supabase-storage'
import type {
  LibraryCategoryInput,
  LibraryListParams,
  LibraryProductFieldsInput,
  LibrarySubcategoryInput,
  LibrarySubcategoryUpdateInput,
} from '@/validation/library'

/**
 * Services — bibliothèque catalogue, côté administration plateforme (Alstock
 * Admin). Catalogue GLOBAL (pas d'organizationId) : les fonctions reçoivent un
 * `PlatformAdmin` qui matérialise l'autorisation (résolue dans la façade via
 * `requirePlatformAdmin`). Soft-delete sur les trois entités.
 */

const DEFAULT_TRADE = 'PLOMBIER - CHAUFFAGISTE - FRIGORISTE'

// --- Helpers d'intégrité ---------------------------------------------------

export const assertLibraryCategory = async (_admin: PlatformAdmin, id: string): Promise<void> => {
  const [row] = await db
    .select({ id: libraryCategory.id })
    .from(libraryCategory)
    .where(and(eq(libraryCategory.id, id), isNull(libraryCategory.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError('Catégorie catalogue introuvable')
}

export const assertLibrarySubcategoryInCategory = async (
  _admin: PlatformAdmin,
  subcategoryId: string,
  categoryId: string
): Promise<void> => {
  const [row] = await db
    .select({ id: librarySubcategory.id })
    .from(librarySubcategory)
    .where(
      and(
        eq(librarySubcategory.id, subcategoryId),
        eq(librarySubcategory.categoryId, categoryId),
        isNull(librarySubcategory.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new ForbiddenError('Sous-catégorie incohérente avec la catégorie')
}

// --- Arborescence catégories / sous-catégories -----------------------------

export interface LibrarySubcategoryItem {
  id: string
  name: string
  categoryId: string
  productCount: number
}

export interface LibraryCategoryWithSubcategories {
  id: string
  name: string
  trade: string
  productCount: number
  subcategories: LibrarySubcategoryItem[]
}

export const listLibraryTree = async (
  _admin: PlatformAdmin
): Promise<LibraryCategoryWithSubcategories[]> => {
  const cats = await db
    .select({ id: libraryCategory.id, name: libraryCategory.name, trade: libraryCategory.trade })
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
    trade: cat.trade,
    productCount: catCount.get(cat.id) ?? 0,
    subcategories: subs
      .filter((s) => s.categoryId === cat.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        productCount: subCount.get(s.id) ?? 0,
      })),
  }))
}

export const createLibraryCategory = async (_admin: PlatformAdmin, input: LibraryCategoryInput) => {
  const [created] = await db
    .insert(libraryCategory)
    .values({ name: input.name, trade: input.trade ?? DEFAULT_TRADE, position: input.position ?? 0 })
    .returning()
  return created
}

export const updateLibraryCategory = async (
  _admin: PlatformAdmin,
  id: string,
  input: LibraryCategoryInput
) => {
  const [updated] = await db
    .update(libraryCategory)
    .set({ name: input.name, trade: input.trade ?? DEFAULT_TRADE, position: input.position ?? 0 })
    .where(and(eq(libraryCategory.id, id), isNull(libraryCategory.deletedAt)))
    .returning({ id: libraryCategory.id })
  if (!updated) throw new NotFoundError('Catégorie catalogue introuvable')
}

/** Soft-delete d'une catégorie (refusé si des produits y sont rattachés). */
export const softDeleteLibraryCategory = async (
  _admin: PlatformAdmin,
  id: string
): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(libraryProduct)
    .where(and(eq(libraryProduct.categoryId, id), isNull(libraryProduct.deletedAt)))
  if (count > 0) throw new ForbiddenError('Catégorie utilisée par des produits du catalogue')

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(libraryCategory)
      .set({ deletedAt: new Date() })
      .where(and(eq(libraryCategory.id, id), isNull(libraryCategory.deletedAt)))
      .returning({ id: libraryCategory.id })
    if (!deleted) throw new NotFoundError('Catégorie catalogue introuvable')

    await tx
      .update(librarySubcategory)
      .set({ deletedAt: new Date() })
      .where(and(eq(librarySubcategory.categoryId, id), isNull(librarySubcategory.deletedAt)))
  })
}

export const createLibrarySubcategory = async (
  admin: PlatformAdmin,
  input: LibrarySubcategoryInput
) => {
  await assertLibraryCategory(admin, input.categoryId)
  const [created] = await db
    .insert(librarySubcategory)
    .values({ categoryId: input.categoryId, name: input.name, position: input.position ?? 0 })
    .returning()
  return created
}

export const updateLibrarySubcategory = async (
  _admin: PlatformAdmin,
  id: string,
  input: LibrarySubcategoryUpdateInput
) => {
  const [updated] = await db
    .update(librarySubcategory)
    .set({ name: input.name, position: input.position ?? 0 })
    .where(and(eq(librarySubcategory.id, id), isNull(librarySubcategory.deletedAt)))
    .returning({ id: librarySubcategory.id })
  if (!updated) throw new NotFoundError('Sous-catégorie catalogue introuvable')
}

export const softDeleteLibrarySubcategory = async (
  _admin: PlatformAdmin,
  id: string
): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(libraryProduct)
    .where(and(eq(libraryProduct.subcategoryId, id), isNull(libraryProduct.deletedAt)))
  if (count > 0) throw new ForbiddenError('Sous-catégorie utilisée par des produits du catalogue')

  const [deleted] = await db
    .update(librarySubcategory)
    .set({ deletedAt: new Date() })
    .where(and(eq(librarySubcategory.id, id), isNull(librarySubcategory.deletedAt)))
    .returning({ id: librarySubcategory.id })
  if (!deleted) throw new NotFoundError('Sous-catégorie catalogue introuvable')
}

// --- Produits du catalogue -------------------------------------------------

export interface LibraryProductListItem {
  id: string
  title: string
  unit: string
  imagePath: string | null
  categoryName: string | null
  subcategoryName: string | null
}

export interface LibraryProductListResult {
  items: LibraryProductListItem[]
  total: number
  page: number
  pageSize: number
}

const productListQuery = async (
  params: LibraryListParams
): Promise<LibraryProductListResult> => {
  const conditions = [isNull(libraryProduct.deletedAt)]
  if (params.categoryId) conditions.push(eq(libraryProduct.categoryId, params.categoryId))
  if (params.subcategoryId) conditions.push(eq(libraryProduct.subcategoryId, params.subcategoryId))
  if (params.search) {
    const pattern = `%${params.search}%`
    const search = or(ilike(libraryProduct.title, pattern), ilike(libraryProduct.description, pattern))
    if (search) conditions.push(search)
  }
  const where = and(...conditions)
  const offset = (params.page - 1) * params.pageSize

  const rows = await db
    .select({
      id: libraryProduct.id,
      title: libraryProduct.title,
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

export const listLibraryProductsAdmin = async (
  _admin: PlatformAdmin,
  params: LibraryListParams
): Promise<LibraryProductListResult> => productListQuery(params)

export const getLibraryProductAdmin = async (_admin: PlatformAdmin, id: string) => {
  const [row] = await db
    .select()
    .from(libraryProduct)
    .where(and(eq(libraryProduct.id, id), isNull(libraryProduct.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError('Produit catalogue introuvable')
  return row
}

export const createLibraryProduct = async (
  admin: PlatformAdmin,
  input: LibraryProductFieldsInput
) => {
  await assertLibraryCategory(admin, input.categoryId)
  await assertLibrarySubcategoryInCategory(admin, input.subcategoryId, input.categoryId)
  const [created] = await db
    .insert(libraryProduct)
    .values({
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      title: input.title,
      description: input.description ?? null,
      unit: input.unit,
    })
    .returning()
  return created
}

export const updateLibraryProduct = async (
  admin: PlatformAdmin,
  id: string,
  input: LibraryProductFieldsInput
) => {
  await assertLibraryCategory(admin, input.categoryId)
  await assertLibrarySubcategoryInCategory(admin, input.subcategoryId, input.categoryId)
  const [updated] = await db
    .update(libraryProduct)
    .set({
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      title: input.title,
      description: input.description ?? null,
      unit: input.unit,
    })
    .where(and(eq(libraryProduct.id, id), isNull(libraryProduct.deletedAt)))
    .returning()
  if (!updated) throw new NotFoundError('Produit catalogue introuvable')
  return updated
}

export const softDeleteLibraryProduct = async (
  _admin: PlatformAdmin,
  id: string
): Promise<void> => {
  const [deleted] = await db
    .update(libraryProduct)
    .set({ deletedAt: new Date() })
    .where(and(eq(libraryProduct.id, id), isNull(libraryProduct.deletedAt)))
    .returning({ id: libraryProduct.id })
  if (!deleted) throw new NotFoundError('Produit catalogue introuvable')
}

const libraryImagePath = (productId: string, fileName: string) =>
  `library/${productId}/${Date.now()}-${fileName}`

/** Envoie/remplace l'image d'un produit catalogue (bucket partagé, préfixe library/). */
export const uploadLibraryProductImage = async (
  admin: PlatformAdmin,
  input: { libraryProductId: string; file: File }
): Promise<{ imagePath: string }> => {
  const current = await getLibraryProductAdmin(admin, input.libraryProductId)

  const safeName = input.file.name.replace(/[^\w.-]+/g, '_')
  const path = libraryImagePath(input.libraryProductId, safeName)
  await uploadObject(path, input.file, input.file.type || 'application/octet-stream')

  await db
    .update(libraryProduct)
    .set({ imagePath: path })
    .where(eq(libraryProduct.id, input.libraryProductId))

  if (current.imagePath) await deleteObject(current.imagePath).catch(() => {})
  return { imagePath: path }
}

export const getLibraryProductImageUrlAdmin = async (
  admin: PlatformAdmin,
  id: string
): Promise<string | null> => {
  const row = await getLibraryProductAdmin(admin, id)
  if (!row.imagePath) return null
  return createSignedDownloadUrl(row.imagePath)
}
