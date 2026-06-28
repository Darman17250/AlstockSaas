'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, toStockError } from '@/lib/action-result'
import { requireOrgContext } from '@/lib/auth/org-context'
import {
  type LibrarySubProduct,
  addLibraryProductToOrg,
  bulkAddLibraryProductsToOrg,
  listLibrarySubcategoryProducts,
} from '@/services/crm/library'
import { addLibraryProductSchema, bulkAddLibrarySchema } from '@/validation/library'

/** Copie un produit du catalogue partagé dans le stock de l'organisation. */
export const addLibraryProductAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = addLibraryProductSchema.parse(input)
    const created = await addLibraryProductToOrg(ctx, data)
    revalidatePath('/stock')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

/** Charge les produits d'une sous-catégorie du catalogue (vue dépliable). */
export const loadLibrarySubcategoryProductsAction = async (
  subcategoryId: string
): Promise<ActionResult<LibrarySubProduct[]>> => {
  try {
    const ctx = await requireOrgContext()
    const products = await listLibrarySubcategoryProducts(ctx, subcategoryId)
    return { ok: true, data: products }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

/** Ajoute en masse une sélection de catégories / sous-catégories / produits au stock. */
export const bulkAddLibraryAction = async (
  input: unknown
): Promise<ActionResult<{ added: number; skipped: number }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = bulkAddLibrarySchema.parse(input)
    const result = await bulkAddLibraryProductsToOrg(ctx, data)
    revalidatePath('/stock')
    return { ok: true, data: result }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}
