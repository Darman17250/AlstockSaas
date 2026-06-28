'use server'

import { revalidatePath } from 'next/cache'

import { type ActionResult, toStockError } from '@/lib/action-result'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import {
  createLibraryCategory,
  createLibraryProduct,
  createLibrarySubcategory,
  softDeleteLibraryCategory,
  softDeleteLibraryProduct,
  softDeleteLibrarySubcategory,
  updateLibraryCategory,
  updateLibraryProduct,
  updateLibrarySubcategory,
} from '@/services/admin/library'
import {
  libraryCategorySchema,
  libraryProductCreateSchema,
  libraryProductUpdateSchema,
  librarySubcategorySchema,
  librarySubcategoryUpdateSchema,
} from '@/validation/library'

/**
 * Façade fine de l'administration plateforme (Alstock Admin) : autorisation via
 * `requirePlatformAdmin` → validation Zod → service → revalidation.
 */

const revalidateCategories = () => {
  revalidatePath('/admin/bibliotheque/categories')
  revalidatePath('/admin/bibliotheque')
}

const revalidateProducts = () => {
  revalidatePath('/admin/bibliotheque')
}

export const createLibraryCategoryAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await createLibraryCategory(admin, libraryCategorySchema.parse(input))
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateLibraryCategoryAction = async (
  id: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await updateLibraryCategory(admin, id, libraryCategorySchema.parse(input))
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteLibraryCategoryAction = async (id: string): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await softDeleteLibraryCategory(admin, id)
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const createLibrarySubcategoryAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await createLibrarySubcategory(admin, librarySubcategorySchema.parse(input))
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateLibrarySubcategoryAction = async (
  id: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await updateLibrarySubcategory(admin, id, librarySubcategoryUpdateSchema.parse(input))
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteLibrarySubcategoryAction = async (id: string): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await softDeleteLibrarySubcategory(admin, id)
    revalidateCategories()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const createLibraryProductAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const admin = await requirePlatformAdmin()
    const created = await createLibraryProduct(admin, libraryProductCreateSchema.parse(input))
    revalidateProducts()
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const updateLibraryProductAction = async (
  id: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await updateLibraryProduct(admin, id, libraryProductUpdateSchema.parse(input))
    revalidateProducts()
    revalidatePath(`/admin/bibliotheque/${id}/modifier`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}

export const deleteLibraryProductAction = async (id: string): Promise<ActionResult> => {
  try {
    const admin = await requirePlatformAdmin()
    await softDeleteLibraryProduct(admin, id)
    revalidateProducts()
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toStockError(e) }
  }
}
