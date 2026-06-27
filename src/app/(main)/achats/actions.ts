'use server'

import { revalidatePath } from 'next/cache'

import { requireOrgContext } from '@/lib/auth/org-context'
import {
  createPurchase,
  softDeletePurchase,
  updatePurchase,
  validatePurchase,
} from '@/services/crm/purchase'
import { createSupplier, softDeleteSupplier, updateSupplier } from '@/services/crm/supplier'
import {
  purchaseCreateSchema,
  purchaseUpdateSchema,
  purchaseValidateSchema,
} from '@/validation/purchase'
import { type ActionResult, toStockError } from '@/lib/action-result'
import { supplierSchema } from '@/validation/supplier'

// ── Fournisseurs ──────────────────────────────────────────────────────────

export const createSupplierAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = supplierSchema.parse(input)
    const created = await createSupplier(ctx, data)
    revalidatePath('/achats/fournisseurs')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateSupplierAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = supplierSchema.parse(input)
    await updateSupplier(ctx, id, data)
    revalidatePath('/achats/fournisseurs')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteSupplierAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteSupplier(ctx, id)
    revalidatePath('/achats/fournisseurs')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

// ── Achats ────────────────────────────────────────────────────────────────

export const createPurchaseAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = purchaseCreateSchema.parse(input)
    const created = await createPurchase(ctx, data)
    revalidatePath('/achats')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updatePurchaseAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = purchaseUpdateSchema.parse(input)
    await updatePurchase(ctx, id, data)
    revalidatePath('/achats')
    revalidatePath(`/achats/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deletePurchaseAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeletePurchase(ctx, id)
    revalidatePath('/achats')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const validatePurchaseAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = purchaseValidateSchema.parse(input)
    const res = await validatePurchase(ctx, id, data)
    revalidatePath('/achats')
    revalidatePath(`/achats/${id}`)
    revalidatePath('/stock')
    for (const depotId of res.affectedDepotIds) revalidatePath(`/depots/${depotId}`)
    for (const siteId of res.affectedSiteIds) revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}
