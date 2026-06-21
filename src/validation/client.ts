import { z } from 'zod'

import { civilityEnum, clientTypeEnum, relationTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des clients (société ou particulier).
 * Source de vérité des champs : docs/cadrage-crm-chantiers-mvp.md.
 * Les valeurs d'enum sont dérivées du schéma Drizzle (pas de littéraux dupliqués).
 */

/** Normalise les chaînes vides venant des formulaires en `undefined`. */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalEmail = z.preprocess(emptyToUndefined, z.email().optional())

export const clientBaseSchema = z.object({
  type: z.enum(clientTypeEnum.enumValues),
  relationType: z.enum(relationTypeEnum.enumValues).default('client'),
  name: z.string().trim().min(1, 'Le nom est requis'),
  civility: z.preprocess(emptyToUndefined, z.enum(civilityEnum.enumValues).optional()),
  siret: optionalText,
  sector: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: z.preprocess(emptyToUndefined, z.string().trim().default('FR')),
  ownerId: optionalText,
  notes: optionalText,
})

export const clientCreateSchema = clientBaseSchema
export const clientUpdateSchema = clientBaseSchema

/** Filtres + pagination de la liste des clients. */
export const clientListParamsSchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  type: z.preprocess(emptyToUndefined, z.enum(clientTypeEnum.enumValues).optional()),
  relationType: z.preprocess(emptyToUndefined, z.enum(relationTypeEnum.enumValues).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ClientCreateInput = z.infer<typeof clientCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>
export type ClientListParams = z.infer<typeof clientListParamsSchema>
