import { z } from 'zod'

import { fuelLevelEnum, toolKindEnum, toolStatusEnum } from '@/database/schema'

/**
 * Schémas de validation du matériel (parc d'outillage & machines de
 * l'organisation). Un matériel est un actif unitaire ; sa localisation initiale
 * est un dépôt requis à la création, puis change via les transferts.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional()
)
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional())
const optionalCost = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative('Coût invalide').optional()
)

export const toolFieldsSchema = z.object({
  kind: z.enum(toolKindEnum.enumValues),
  name: z.string().trim().min(1, 'Le nom est requis'),
  category: optionalText,
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  reference: optionalText,
  responsibleId: optionalText,
  purchaseDate: optionalDate,
  purchaseCost: optionalCost,
  maintenanceFrequencyMonths: optionalInt,
  // Champs machine (nullables).
  fuelLevel: z.preprocess(emptyToUndefined, z.enum(fuelLevelEnum.enumValues).optional()),
  engineHours: optionalInt,
  notes: optionalText,
})

// Localisation initiale : un dépôt est requis à la création.
export const toolCreateSchema = toolFieldsSchema.extend({
  depotId: z.uuid('Dépôt initial requis'),
})

// La localisation ne se modifie pas ici : elle change via un transfert.
export const toolUpdateSchema = toolFieldsSchema

export const toolListParamsSchema = z.object({
  search: optionalText,
  kind: z.preprocess(emptyToUndefined, z.enum(toolKindEnum.enumValues).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(toolStatusEnum.enumValues).optional()),
  category: optionalText,
  depotId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  siteId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const fuelLevelSchema = z.object({
  fuelLevel: z.enum(fuelLevelEnum.enumValues),
})

export const engineHoursSchema = z.object({
  engineHours: z.coerce.number().int().nonnegative('Compteur invalide'),
})

export type ToolFieldsInput = z.infer<typeof toolFieldsSchema>
export type ToolCreateInput = z.infer<typeof toolCreateSchema>
export type ToolUpdateInput = z.infer<typeof toolUpdateSchema>
export type ToolListParams = z.infer<typeof toolListParamsSchema>
