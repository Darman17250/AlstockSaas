import { z } from 'zod'

import { depotDocumentCategoryEnum } from '@/database/schema'

/**
 * Métadonnées d'un document de dépôt/véhicule (carte grise, assurance, CT…).
 * Les contraintes MIME/taille sont génériques (cf. validation/deal-document.ts).
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const depotDocumentMetaSchema = z.object({
  category: z.preprocess(emptyToUndefined, z.enum(depotDocumentCategoryEnum.enumValues).optional()),
  expiresAt: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
      .optional()
  ),
})

export type DepotDocumentMetaInput = z.infer<typeof depotDocumentMetaSchema>

export {
  ALLOWED_MIME_TYPES,
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_SIZE,
  isAllowedMimeType,
} from './deal-document'
