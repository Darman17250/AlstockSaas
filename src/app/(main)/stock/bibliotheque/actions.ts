'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, toStockError } from '@/lib/action-result'
import { requireOrgContext } from '@/lib/auth/org-context'
import { addLibraryProductToOrg } from '@/services/crm/library'
import { addLibraryProductSchema } from '@/validation/library'

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
