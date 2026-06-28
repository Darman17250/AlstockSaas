import { z } from 'zod'

import { productUnitEnum } from '@/database/schema'
import { initialStockLineSchema } from './product'

/**
 * Schémas de validation de la bibliothèque catalogue. Les schémas « library* »
 * servent à l'administration plateforme (Alstock Admin). Le schéma
 * `addLibraryProductSchema` sert côté organisation pour copier un produit du
 * catalogue dans le stock de l'org.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional())
const optionalPosition = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional())
const optionalPrice = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative('Prix invalide').optional()
)
const optionalQuantity = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative('Valeur invalide').optional()
)

// --- Administration (Alstock Admin) ---------------------------------------

export const libraryCategorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  trade: optionalText,
  position: optionalPosition,
})

export const librarySubcategorySchema = z.object({
  categoryId: z.uuid('Catégorie requise'),
  name: z.string().trim().min(1, 'Le nom est requis'),
  position: optionalPosition,
})

export const librarySubcategoryUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  position: optionalPosition,
})

export const libraryProductFieldsSchema = z.object({
  categoryId: z.uuid('Catégorie requise'),
  subcategoryId: z.uuid('Sous-catégorie requise'),
  title: z.string().trim().min(1, 'Le titre est requis'),
  description: optionalText,
  unit: z.enum(productUnitEnum.enumValues),
})

export const libraryProductCreateSchema = libraryProductFieldsSchema
export const libraryProductUpdateSchema = libraryProductFieldsSchema

export const libraryListParamsSchema = z.object({
  search: optionalText,
  categoryId: optionalUuid,
  subcategoryId: optionalUuid,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})

// --- Côté organisation : ajout au stock -----------------------------------

export const addLibraryProductSchema = z.object({
  libraryProductId: z.uuid('Produit catalogue requis'),
  alertThreshold: optionalQuantity,
  initialPurchasePrice: optionalPrice,
  initialStock: z.array(initialStockLineSchema).default([]),
})

export type LibraryCategoryInput = z.infer<typeof libraryCategorySchema>
export type LibrarySubcategoryInput = z.infer<typeof librarySubcategorySchema>
export type LibrarySubcategoryUpdateInput = z.infer<typeof librarySubcategoryUpdateSchema>
/** Ajout en masse depuis le catalogue : sélection de catégories / sous-catégories / produits. */
export const bulkAddLibrarySchema = z
  .object({
    categoryIds: z.array(z.uuid()).default([]),
    subcategoryIds: z.array(z.uuid()).default([]),
    productIds: z.array(z.uuid()).default([]),
  })
  .refine((d) => d.categoryIds.length + d.subcategoryIds.length + d.productIds.length > 0, {
    message: 'Sélectionnez au moins une catégorie, sous-catégorie ou produit',
  })

export type LibraryProductFieldsInput = z.infer<typeof libraryProductFieldsSchema>
export type LibraryListParams = z.infer<typeof libraryListParamsSchema>
export type AddLibraryProductInput = z.infer<typeof addLibraryProductSchema>
export type BulkAddLibraryInput = z.infer<typeof bulkAddLibrarySchema>
