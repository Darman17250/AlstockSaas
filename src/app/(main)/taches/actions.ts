'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { createTask, deleteTask, setTaskStatus, updateTask } from '@/services/crm/task'
import { taskCreateSchema, taskStatusSchema, taskUpdateSchema } from '@/validation/task'

/**
 * Façade fine : contexte org → validation Zod → service → revalidation → résultat
 * sérialisable. Aucune logique métier ici (cf. CLAUDE.md §7).
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const toError = (e: unknown): string => {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Données invalides'
  if (e instanceof UnauthorizedError) return 'Authentification requise'
  if (e instanceof ForbiddenError) return e.message
  if (e instanceof NotFoundError) return e.message
  return 'Une erreur est survenue'
}

/** Revalide la page tâches + les fiches liées (affaire/client) le cas échéant. */
const revalidateTaskPaths = (links: { dealId?: string; clientId?: string }) => {
  revalidatePath('/taches')
  if (links.dealId) revalidatePath(`/affaires/${links.dealId}`)
  if (links.clientId) revalidatePath(`/clients/${links.clientId}`)
}

export const createTaskAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskCreateSchema.parse(input)
    await createTask(ctx, data)
    revalidateTaskPaths(data)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateTaskAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskUpdateSchema.parse(input)
    await updateTask(ctx, id, data)
    revalidateTaskPaths(data)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const setTaskStatusAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskStatusSchema.parse(input)
    await setTaskStatus(ctx, id, data)
    revalidatePath('/taches')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteTaskAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteTask(ctx, id)
    revalidatePath('/taches')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
