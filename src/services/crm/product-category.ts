import 'server-only'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { product, productCategory, productSubcategory } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { ProductCategoryInput, ProductSubcategoryInput } from '@/validation/product-category'

/**
 * Services — catégories & sous-catégories de produits. Une catégorie possède
 * plusieurs sous-catégories ; un produit référence une catégorie ET une
 * sous-catégorie cohérentes (vérifié dans le service produit).
 */

/** Vérifie qu'une catégorie appartient à l'org (non supprimée). */
export const assertCategoryInOrg = async (ctx: OrgContext, categoryId: string): Promise<void> => {
  const [row] = await db
    .select({ id: productCategory.id })
    .from(productCategory)
    .where(
      and(
        eq(productCategory.id, categoryId),
        eq(productCategory.organizationId, ctx.organizationId),
        isNull(productCategory.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Catégorie introuvable')
}

/** Vérifie qu'une sous-catégorie appartient à l'org ET à la catégorie donnée. */
export const assertSubcategoryInCategory = async (
  ctx: OrgContext,
  subcategoryId: string,
  categoryId: string
): Promise<void> => {
  const [row] = await db
    .select({ id: productSubcategory.id })
    .from(productSubcategory)
    .where(
      and(
        eq(productSubcategory.id, subcategoryId),
        eq(productSubcategory.categoryId, categoryId),
        eq(productSubcategory.organizationId, ctx.organizationId),
        isNull(productSubcategory.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new ForbiddenError('Sous-catégorie incohérente avec la catégorie')
}

export interface SubcategoryItem {
  id: string
  name: string
  categoryId: string
  productCount: number
}

export interface CategoryWithSubcategories {
  id: string
  name: string
  productCount: number
  subcategories: SubcategoryItem[]
}

/** Arborescence catégories → sous-catégories, avec nombre de produits. */
export const listCategoriesTree = async (ctx: OrgContext): Promise<CategoryWithSubcategories[]> => {
  requirePermission(ctx, 'productCategory', 'read')

  const cats = await db
    .select({ id: productCategory.id, name: productCategory.name })
    .from(productCategory)
    .where(
      and(eq(productCategory.organizationId, ctx.organizationId), isNull(productCategory.deletedAt))
    )
    .orderBy(asc(productCategory.name))

  const subs = await db
    .select({
      id: productSubcategory.id,
      name: productSubcategory.name,
      categoryId: productSubcategory.categoryId,
    })
    .from(productSubcategory)
    .where(
      and(
        eq(productSubcategory.organizationId, ctx.organizationId),
        isNull(productSubcategory.deletedAt)
      )
    )
    .orderBy(asc(productSubcategory.name))

  // Comptage produits par catégorie et par sous-catégorie (produits non supprimés).
  const counts = await db
    .select({
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(product)
    .where(and(eq(product.organizationId, ctx.organizationId), isNull(product.deletedAt)))
    .groupBy(product.categoryId, product.subcategoryId)

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
      .map((s) => ({
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        productCount: subCount.get(s.id) ?? 0,
      })),
  }))
}

export const createCategory = async (ctx: OrgContext, input: ProductCategoryInput) => {
  requirePermission(ctx, 'productCategory', 'create')
  const [created] = await db
    .insert(productCategory)
    .values({ organizationId: ctx.organizationId, name: input.name })
    .returning()
  return created
}

export const updateCategory = async (ctx: OrgContext, id: string, input: ProductCategoryInput) => {
  requirePermission(ctx, 'productCategory', 'update')
  const [updated] = await db
    .update(productCategory)
    .set({ name: input.name })
    .where(
      and(
        eq(productCategory.id, id),
        eq(productCategory.organizationId, ctx.organizationId),
        isNull(productCategory.deletedAt)
      )
    )
    .returning({ id: productCategory.id })
  if (!updated) throw new NotFoundError('Catégorie introuvable')
}

/** Soft-delete d'une catégorie (refusé si des produits y sont encore rattachés). */
export const softDeleteCategory = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'productCategory', 'delete')

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(product)
    .where(
      and(
        eq(product.categoryId, id),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
  if (count > 0) throw new ForbiddenError('Catégorie utilisée par des produits')

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(productCategory)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(productCategory.id, id),
          eq(productCategory.organizationId, ctx.organizationId),
          isNull(productCategory.deletedAt)
        )
      )
      .returning({ id: productCategory.id })
    if (!deleted) throw new NotFoundError('Catégorie introuvable')

    await tx
      .update(productSubcategory)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(productSubcategory.categoryId, id),
          eq(productSubcategory.organizationId, ctx.organizationId),
          isNull(productSubcategory.deletedAt)
        )
      )
  })
}

export const createSubcategory = async (ctx: OrgContext, input: ProductSubcategoryInput) => {
  requirePermission(ctx, 'productCategory', 'create')
  await assertCategoryInOrg(ctx, input.categoryId)
  const [created] = await db
    .insert(productSubcategory)
    .values({
      organizationId: ctx.organizationId,
      categoryId: input.categoryId,
      name: input.name,
    })
    .returning()
  return created
}

export const updateSubcategory = async (ctx: OrgContext, id: string, input: { name: string }) => {
  requirePermission(ctx, 'productCategory', 'update')
  const [updated] = await db
    .update(productSubcategory)
    .set({ name: input.name })
    .where(
      and(
        eq(productSubcategory.id, id),
        eq(productSubcategory.organizationId, ctx.organizationId),
        isNull(productSubcategory.deletedAt)
      )
    )
    .returning({ id: productSubcategory.id })
  if (!updated) throw new NotFoundError('Sous-catégorie introuvable')
}

export const softDeleteSubcategory = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'productCategory', 'delete')

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(product)
    .where(
      and(
        eq(product.subcategoryId, id),
        eq(product.organizationId, ctx.organizationId),
        isNull(product.deletedAt)
      )
    )
  if (count > 0) throw new ForbiddenError('Sous-catégorie utilisée par des produits')

  const [deleted] = await db
    .update(productSubcategory)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(productSubcategory.id, id),
        eq(productSubcategory.organizationId, ctx.organizationId),
        isNull(productSubcategory.deletedAt)
      )
    )
    .returning({ id: productSubcategory.id })
  if (!deleted) throw new NotFoundError('Sous-catégorie introuvable')
}
