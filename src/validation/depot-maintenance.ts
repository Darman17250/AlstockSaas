import { z } from 'zod'

import { depotMaintenanceTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des entretiens d'un dépôt/véhicule (historique).
 * Entretien daté et/ou au kilométrage (`mileage` / `nextDueMileage`).
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

export const depotMaintenanceFieldsSchema = z.object({
  type: z.enum(depotMaintenanceTypeEnum.enumValues).default('revision'),
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date requise'),
  performedById: optionalText,
  provider: optionalText,
  mileage: optionalInt,
  cost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative('Coût invalide').optional()),
  description: optionalText,
  nextDueDate: optionalDate,
  nextDueMileage: optionalInt,
})

export const depotMaintenanceCreateSchema = depotMaintenanceFieldsSchema.extend({
  depotId: z.uuid(),
})

export const depotMaintenanceUpdateSchema = depotMaintenanceFieldsSchema

export type DepotMaintenanceFieldsInput = z.infer<typeof depotMaintenanceFieldsSchema>
export type DepotMaintenanceCreateInput = z.infer<typeof depotMaintenanceCreateSchema>
export type DepotMaintenanceUpdateInput = z.infer<typeof depotMaintenanceUpdateSchema>
