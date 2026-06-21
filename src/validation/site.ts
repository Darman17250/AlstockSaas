import { z } from 'zod'

import { siteStatusEnum } from '@/database/schema'

/**
 * Schémas de validation des chantiers (entité `site`).
 * Source de vérité des champs : docs/cadrage-crm-chantiers-mvp.md (entité `site`).
 * Les valeurs d'enum sont dérivées du schéma Drizzle (pas de littéraux dupliqués).
 */

/** Normalise les chaînes vides venant des formulaires en `undefined`. */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional()
)

/**
 * Champs saisissables d'un chantier. Contrairement aux affaires, le `status`
 * fait partie du formulaire : un chantier n'a pas de logique de transition
 * dédiée (prépa → en cours → terminé… librement modifiables).
 */
export const siteBaseSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  clientId: z.uuid('Client requis'),
  reference: optionalText,
  status: z.enum(siteStatusEnum.enumValues).default('prepa'),
  addressLine1: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: z.preprocess(emptyToUndefined, z.string().trim().default('FR')),
  startDate: optionalDate,
  endDate: optionalDate,
  actualStartDate: optionalDate,
  actualEndDate: optionalDate,
  conducteurId: optionalText,
  description: optionalText,
})

export const siteCreateSchema = siteBaseSchema
export const siteUpdateSchema = siteBaseSchema

/** Filtres + pagination de la liste des chantiers. */
export const siteListParamsSchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.preprocess(emptyToUndefined, z.enum(siteStatusEnum.enumValues).optional()),
  clientId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type SiteCreateInput = z.infer<typeof siteCreateSchema>
export type SiteUpdateInput = z.infer<typeof siteUpdateSchema>
export type SiteListParams = z.infer<typeof siteListParamsSchema>
