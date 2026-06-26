import { z } from 'zod'

import { toolMaintenanceTypeEnum } from '@/database/schema'

/**
 * Schémas de validation des entretiens d'un matériel (historique).
 * Entretien daté et/ou au compteur horaire (`hours` / `nextDueHours`, machines).
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

export const toolMaintenanceFieldsSchema = z.object({
  type: z.enum(toolMaintenanceTypeEnum.enumValues).default('controle'),
  performedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date requise'),
  performedById: optionalText,
  provider: optionalText,
  hours: optionalInt,
  cost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative('Coût invalide').optional()),
  description: optionalText,
  nextDueDate: optionalDate,
  nextDueHours: optionalInt,
})

export const toolMaintenanceCreateSchema = toolMaintenanceFieldsSchema.extend({
  toolId: z.uuid(),
})

export const toolMaintenanceUpdateSchema = toolMaintenanceFieldsSchema

export type ToolMaintenanceFieldsInput = z.infer<typeof toolMaintenanceFieldsSchema>
export type ToolMaintenanceCreateInput = z.infer<typeof toolMaintenanceCreateSchema>
export type ToolMaintenanceUpdateInput = z.infer<typeof toolMaintenanceUpdateSchema>
