import { z } from 'zod'

import { toolDocumentCategoryEnum } from '@/database/schema'

/**
 * Métadonnées d'un document de matériel (facture, manuel, garantie, photo…).
 * Les contraintes MIME/taille sont génériques (cf. validation/deal-document.ts).
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const toolDocumentMetaSchema = z.object({
  category: z.preprocess(emptyToUndefined, z.enum(toolDocumentCategoryEnum.enumValues).optional()),
})

export type ToolDocumentMetaInput = z.infer<typeof toolDocumentMetaSchema>

export {
  ALLOWED_MIME_TYPES,
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_SIZE,
  isAllowedMimeType,
} from './deal-document'
