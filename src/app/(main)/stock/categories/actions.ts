'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, toStockError } from '@/lib/action-result'
import { requireOrgContext } from '@/lib/auth/org-context'
import {
  createCategory,
  createSubcategory,
  softDeleteCategory,
  softDeleteSubcategory,
  updateCategory,
  updateSubcategory,
} from '@/services/crm/product-category'
import { productCategorySchema, productSubcategorySchema } from '@/validation/product-category'

const revalidate = () => {
  revalidatePath('/stock/categories')
  revalidatePath('/stock')
}

export const createCategoryAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = productCategorySchema.parse(input)
    await createCategory(ctx, data)
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateCategoryAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = productCategorySchema.parse(input)
    await updateCategory(ctx, id, data)
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteCategoryAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteCategory(ctx, id)
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const createSubcategoryAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = productSubcategorySchema.parse(input)
    await createSubcategory(ctx, data)
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateSubcategoryAction = async (
  id: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const { name } = productSubcategorySchema.pick({ name: true }).parse(input)
    await updateSubcategory(ctx, id, { name })
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteSubcategoryAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteSubcategory(ctx, id)
    revalidate()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}
