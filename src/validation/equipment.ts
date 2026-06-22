import { z } from 'zod'

import { equipmentStatusEnum } from '@/database/schema'

/**
 * Schémas de validation des équipements installés (chaudière, poêle, PAC, VMC…).
 * Rattachés à une localisation client ; `clientId` est dérivé côté service.
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

export const equipmentFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  category: optionalText,
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  installDate: optionalDate,
  status: z.enum(equipmentStatusEnum.enumValues).default('en_service'),
  maintenanceFrequencyMonths: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(120).optional()
  ),
  nextMaintenanceDate: optionalDate,
  notes: optionalText,
})

/** Création : rattachement à une localisation de l'organisation. */
export const equipmentCreateSchema = equipmentFieldsSchema.extend({
  locationId: z.uuid(),
})

/** Édition : `locationId` permet aussi de déplacer l'équipement. */
export const equipmentUpdateSchema = equipmentFieldsSchema.extend({
  locationId: z.uuid(),
})

export type EquipmentFieldsInput = z.infer<typeof equipmentFieldsSchema>
export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>
