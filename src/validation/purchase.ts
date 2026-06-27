import { z } from 'zod'

/**
 * Schémas de validation des achats. Un achat brouillon contient des lignes
 * (produit, quantité, prix d'achat). À la validation, chaque ligne reçoit une
 * destination (dépôt OU chantier) où la quantité entre en stock.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional()
)

export const purchaseLineInputSchema = z.object({
  productId: z.uuid('Produit requis'),
  quantity: z.coerce.number().positive('Quantité invalide'),
  unitPrice: z.coerce.number().nonnegative('Prix invalide'),
})

export const purchaseCreateSchema = z.object({
  supplierId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  reference: optionalText,
  orderDate: optionalDate,
  notes: optionalText,
  lines: z.array(purchaseLineInputSchema).min(1, 'Ajoutez au moins une ligne'),
})

export const purchaseUpdateSchema = purchaseCreateSchema

/** Destination d'une ligne, fournie à la validation (dépôt XOR chantier). */
export const purchaseLineDestinationSchema = z.object({
  lineId: z.uuid(),
  destinationKind: z.enum(['depot', 'site']),
  destinationId: z.uuid('Destination requise'),
})

export const purchaseValidateSchema = z.object({
  destinations: z.array(purchaseLineDestinationSchema).min(1),
})

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>
export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>
export type PurchaseUpdateInput = z.infer<typeof purchaseUpdateSchema>
export type PurchaseValidateInput = z.infer<typeof purchaseValidateSchema>
