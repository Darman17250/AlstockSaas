import { z } from 'zod'

import { maintenanceTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des entretiens d'un équipement (historique).
 * « Qui a fait l'entretien » = un membre de l'organisation (`performedById`).
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

export const maintenanceFieldsSchema = z.object({
  type: z.enum(maintenanceTypeEnum.enumValues).default('entretien'),
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date requise'),
  performedById: optionalText,
  cost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative('Coût invalide').optional()),
  description: optionalText,
  nextDueDate: optionalDate,
})

export const maintenanceCreateSchema = maintenanceFieldsSchema.extend({
  equipmentId: z.uuid(),
})

export const maintenanceUpdateSchema = maintenanceFieldsSchema

export type MaintenanceFieldsInput = z.infer<typeof maintenanceFieldsSchema>
export type MaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>
export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>
