import { z } from 'zod'

import { productUnitEnum } from '@/database/schema'

/**
 * Schémas de validation des produits (catalogue stock). À la création, la
 * quantité initiale peut être répartie sur plusieurs dépôts (chaque ligne =
 * dépôt + quantité), au prix d'achat unitaire commun qui amorce le WAC.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalPrice = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative('Prix invalide').optional()
)
const optionalQuantity = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative('Valeur invalide').optional()
)

export const productFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis'),
  categoryId: z.uuid('Catégorie requise'),
  subcategoryId: z.uuid('Sous-catégorie requise'),
  unit: z.enum(productUnitEnum.enumValues),
  description: optionalText,
  // Seuil d'alerte (stock bas) comparé au stock global (dépôts).
  alertThreshold: optionalQuantity,
})

/** Ligne de quantité initiale : un dépôt + une quantité (> 0). */
export const initialStockLineSchema = z.object({
  depotId: z.uuid('Dépôt requis'),
  quantity: z.coerce.number().positive('Quantité invalide'),
})

export const productCreateSchema = productFieldsSchema.extend({
  initialPurchasePrice: optionalPrice,
  initialStock: z.array(initialStockLineSchema).default([]),
})

export const productUpdateSchema = productFieldsSchema

export const productListParamsSchema = z.object({
  search: optionalText,
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  subcategoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ProductFieldsInput = z.infer<typeof productFieldsSchema>
export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type ProductListParams = z.infer<typeof productListParamsSchema>
