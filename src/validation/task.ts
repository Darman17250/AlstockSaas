import { z } from 'zod'

import { taskStatusEnum } from '@/database/schema'

/**
 * Schémas de validation des tâches (entité `activity` du cadrage, `type = tache`).
 * Distinct des communications (`validation/activity.ts`, types d'interaction).
 * Une tâche peut être rattachée à un client / une affaire / un chantier, ou autonome.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
const optionalUuid = z.preprocess(emptyToUndefined, z.uuid().optional())
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional()
)

export const taskFieldsSchema = z.object({
  subject: z.string().trim().min(1, "L'intitulé est requis"),
  description: optionalText,
  dueDate: optionalDate,
  status: z.enum(taskStatusEnum.enumValues).default('a_faire'),
  assigneeId: optionalText,
  /** Co-assignés (en plus du responsable `assigneeId`). Ids de membres. */
  coAssigneeIds: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.string()).default([])),
  clientId: optionalUuid,
  dealId: optionalUuid,
  siteId: optionalUuid,
  equipmentId: optionalUuid,
})

export const taskCreateSchema = taskFieldsSchema
export const taskUpdateSchema = taskFieldsSchema

/** Bascule rapide de statut (case à cocher). */
export const taskStatusSchema = z.object({
  status: z.enum(taskStatusEnum.enumValues),
})

/** Filtres de l'onglet « Équipe ». */
export const taskListParamsSchema = z.object({
  assigneeId: optionalText,
  status: z.preprocess(emptyToUndefined, z.enum(taskStatusEnum.enumValues).optional()),
})

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type TaskStatusInput = z.infer<typeof taskStatusSchema>
export type TaskListParams = z.infer<typeof taskListParamsSchema>
