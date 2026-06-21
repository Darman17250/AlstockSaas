import { z } from 'zod'

import { dealSourceEnum, dealStageEnum, dealStatusEnum } from '@/database/schema'

/**
 * Schémas de validation des affaires (pipeline commercial).
 * Source de vérité des champs : docs/cadrage-crm-chantiers-mvp.md (entité `deal`).
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
 * Champs saisissables d'une affaire. Le `status` n'y figure PAS : les transitions
 * (gagnée/perdue/réouverture) et le déplacement de `stage` passent par des actions
 * dédiées, jamais par le formulaire d'édition.
 */
export const dealBaseSchema = z.object({
  title: z.string().trim().min(1, "L'intitulé est requis"),
  clientId: z.uuid('Client requis'),
  primaryContactId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  stage: z.enum(dealStageEnum.enumValues).default('nouveau'),
  estimatedAmount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative('Montant invalide').optional()
  ),
  currency: z.preprocess(emptyToUndefined, z.string().trim().default('EUR')),
  probability: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100).optional()),
  expectedCloseDate: optionalDate,
  source: z.preprocess(emptyToUndefined, z.enum(dealSourceEnum.enumValues).optional()),
  ownerId: optionalText,
  notes: optionalText,
})

export const dealCreateSchema = dealBaseSchema
export const dealUpdateSchema = dealBaseSchema

/** Filtres + pagination des listes (onglets Gagnées / Perdues). */
export const dealListParamsSchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(dealStatusEnum.enumValues).optional()),
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Déplacement d'une affaire dans le pipeline. */
export const dealStageSchema = z.object({
  stage: z.enum(dealStageEnum.enumValues),
})

/** Passage en « gagnée » : crée le chantier lié en option (slice F5). */
export const dealWonSchema = z.object({
  createSite: z.coerce.boolean().default(false),
})

/** Passage en « perdue » avec motif. */
export const dealLostSchema = z.object({
  lostReason: optionalText,
})

export type DealCreateInput = z.infer<typeof dealCreateSchema>
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>
export type DealListParams = z.infer<typeof dealListParamsSchema>
export type DealStageInput = z.infer<typeof dealStageSchema>
export type DealWonInput = z.infer<typeof dealWonSchema>
export type DealLostInput = z.infer<typeof dealLostSchema>
