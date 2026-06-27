import { z } from 'zod'

/**
 * Transfert de stock d'un produit. Trois sens autorisés — JAMAIS chantier →
 * chantier (pour déplacer entre chantiers, repasser par un dépôt) :
 *  - depot_depot : dépôt → dépôt
 *  - depot_site  : dépôt → chantier
 *  - site_depot  : chantier → dépôt (retour chantier)
 */
export const stockTransferDirectionEnum = ['depot_depot', 'depot_site', 'site_depot'] as const

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const stockTransferCreateSchema = z.object({
  direction: z.enum(stockTransferDirectionEnum),
  sourceId: z.uuid('Source requise'),
  destinationId: z.uuid('Destination requise'),
  quantity: z.coerce.number().positive('Quantité invalide'),
  note: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
})

export type StockTransferDirection = (typeof stockTransferDirectionEnum)[number]
export type StockTransferCreateInput = z.infer<typeof stockTransferCreateSchema>
