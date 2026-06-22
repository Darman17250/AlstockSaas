import { z } from 'zod'

import { locationTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des localisations client (maison, appartement, local…).
 * Une localisation regroupe des équipements installés (cf. validation/equipment.ts).
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())

export const locationFieldsSchema = z.object({
  type: z.enum(locationTypeEnum.enumValues),
  name: z.string().trim().min(1, 'Le nom est requis'),
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: z.preprocess(emptyToUndefined, z.string().trim().default('FR')),
  notes: optionalText,
})

export const locationCreateSchema = locationFieldsSchema.extend({
  clientId: z.uuid(),
})

export const locationUpdateSchema = locationFieldsSchema

export type LocationFieldsInput = z.infer<typeof locationFieldsSchema>
export type LocationCreateInput = z.infer<typeof locationCreateSchema>
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>
