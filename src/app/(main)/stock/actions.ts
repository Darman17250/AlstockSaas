'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, toStockError } from '@/lib/action-result'
import { requireOrgContext } from '@/lib/auth/org-context'
import { createProduct, softDeleteProduct, updateProduct } from '@/services/crm/product'
import { createStockTransfer } from '@/services/crm/stock-transfer'
import { productCreateSchema, productUpdateSchema } from '@/validation/product'
import { stockTransferCreateSchema } from '@/validation/stock-transfer'

/**
 * Façade fine du module stock : contexte org → validation Zod → service →
 * revalidation. Aucune logique métier ici (cf. CLAUDE.md §7).
 */

export const createProductAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = productCreateSchema.parse(input)
    const created = await createProduct(ctx, data)
    revalidatePath('/stock')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateProductAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = productUpdateSchema.parse(input)
    await updateProduct(ctx, id, data)
    revalidatePath('/stock')
    revalidatePath(`/stock/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteProductAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteProduct(ctx, id)
    revalidatePath('/stock')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const createStockTransferAction = async (
  productId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = stockTransferCreateSchema.parse(input)
    const res = await createStockTransfer(ctx, productId, data)
    revalidatePath('/stock')
    revalidatePath(`/stock/${productId}`)
    // Revalide les fiches dépôt/chantier source et destination.
    for (const id of [res.fromDepotId, res.toDepotId]) if (id) revalidatePath(`/depots/${id}`)
    for (const id of [res.fromSiteId, res.toSiteId]) if (id) revalidatePath(`/chantiers/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}
