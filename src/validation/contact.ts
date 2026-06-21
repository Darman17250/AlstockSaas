import { z } from 'zod'

/**
 * Schémas de validation des contacts (interlocuteurs d'un client).
 * Source de vérité des champs : docs/cadrage-crm-chantiers-mvp.md.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalEmail = z.preprocess(emptyToUndefined, z.email().optional())

/** Champs modifiables d'un contact (sans le rattachement client). */
export const contactFieldsSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: optionalText,
  jobTitle: optionalText,
  email: optionalEmail,
  phone: optionalText,
  mobile: optionalText,
  isPrimary: z.coerce.boolean().default(false),
  notes: optionalText,
})

/** Création : on rattache le contact à un client de l'organisation. */
export const contactCreateSchema = contactFieldsSchema.extend({
  clientId: z.uuid(),
})

export const contactUpdateSchema = contactFieldsSchema

export type ContactFieldsInput = z.infer<typeof contactFieldsSchema>
export type ContactCreateInput = z.infer<typeof contactCreateSchema>
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>
