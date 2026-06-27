import { z } from 'zod'

/** Schémas de validation des catégories et sous-catégories de produits. */

export const productCategorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
})

export const productSubcategorySchema = z.object({
  categoryId: z.uuid('Catégorie requise'),
  name: z.string().trim().min(1, 'Le nom est requis'),
})

export type ProductCategoryInput = z.infer<typeof productCategorySchema>
export type ProductSubcategoryInput = z.infer<typeof productSubcategorySchema>
