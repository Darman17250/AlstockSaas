import { z } from 'zod'

import { habilitationTypeEnum } from '@/database/schema'

/**
 * Métadonnées d'une habilitation/certification BTP d'un membre.
 * Contraintes MIME/taille du document : génériques (cf. validation/deal-document.ts).
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const dateField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional()
)

export const habilitationCreateSchema = z.object({
  type: z.enum(habilitationTypeEnum.enumValues),
  name: z.string().trim().min(2, 'Libellé requis').max(120),
  issuer: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  reference: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  issuedAt: dateField,
  expiresAt: dateField,
})

export const habilitationUpdateSchema = habilitationCreateSchema

export type HabilitationInput = z.infer<typeof habilitationCreateSchema>

export {
  ALLOWED_MIME_TYPES,
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_SIZE,
  isAllowedMimeType,
} from './deal-document'
