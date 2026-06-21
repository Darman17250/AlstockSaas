import { z } from 'zod'

import { COMMUNICATION_TYPES } from '@/lib/crm/labels'

/**
 * Schémas de validation des communications (entité `activity` du cadrage,
 * restreinte aux interactions : appel, email, réunion, visite, note).
 * Le périmètre « tâche/rappel » de l'activité relève de F4, pas du suivi client.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())

export const communicationFieldsSchema = z.object({
  type: z.enum(COMMUNICATION_TYPES),
  subject: z.string().trim().min(1, 'Le sujet est requis'),
  description: optionalText,
  occurredAt: z.coerce.date(),
  assigneeId: optionalText,
})

/** Création : rattachée à un client de l'organisation. */
export const communicationCreateSchema = communicationFieldsSchema.extend({
  clientId: z.uuid(),
})

export const communicationUpdateSchema = communicationFieldsSchema

export type CommunicationFieldsInput = z.infer<typeof communicationFieldsSchema>
export type CommunicationCreateInput = z.infer<typeof communicationCreateSchema>
export type CommunicationUpdateInput = z.infer<typeof communicationUpdateSchema>
