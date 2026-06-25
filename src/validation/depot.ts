import { z } from 'zod'

import { depotTypeEnum, vehicleFuelTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des dépôts (entrepôt, atelier, véhicule…).
 * Un véhicule est un dépôt mobile : même table avec un type + champs véhicule
 * nullables (renseignés uniquement quand `type = vehicule`).
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

export const depotFieldsSchema = z.object({
  type: z.enum(depotTypeEnum.enumValues),
  name: z.string().trim().min(1, 'Le nom est requis'),
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: z.preprocess(emptyToUndefined, z.string().trim().default('FR')),
  responsibleId: optionalText,
  notes: optionalText,
  // Champs véhicule (nullables).
  registrationNumber: optionalText,
  brand: optionalText,
  model: optionalText,
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1900).max(2100).optional()),
  fuelType: z.preprocess(emptyToUndefined, z.enum(vehicleFuelTypeEnum.enumValues).optional()),
  vin: optionalText,
  firstRegistrationDate: optionalDate,
  mileage: optionalInt,
})

export const depotCreateSchema = depotFieldsSchema
export const depotUpdateSchema = depotFieldsSchema

export const depotListParamsSchema = z.object({
  search: optionalText,
  type: z.preprocess(emptyToUndefined, z.enum(depotTypeEnum.enumValues).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type DepotFieldsInput = z.infer<typeof depotFieldsSchema>
export type DepotCreateInput = z.infer<typeof depotCreateSchema>
export type DepotUpdateInput = z.infer<typeof depotUpdateSchema>
export type DepotListParams = z.infer<typeof depotListParamsSchema>
