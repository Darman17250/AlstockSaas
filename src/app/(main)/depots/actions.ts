'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { createDepot, softDeleteDepot, updateDepot } from '@/services/crm/depot'
import { deleteDepotDocument } from '@/services/crm/depot-document'
import {
  createDepotMaintenance,
  softDeleteDepotMaintenance,
  updateDepotMaintenance,
} from '@/services/crm/depot-maintenance'
import { createTask } from '@/services/crm/task'
import { depotCreateSchema, depotUpdateSchema } from '@/validation/depot'
import {
  depotMaintenanceCreateSchema,
  depotMaintenanceUpdateSchema,
} from '@/validation/depot-maintenance'
import { taskCreateSchema } from '@/validation/task'

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
  if (e instanceof StorageNotConfiguredError) return e.message
  return 'Une erreur est survenue'
}

// ── Dépôts ───────────────────────────────────────────────────────────────

export const createDepotAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = depotCreateSchema.parse(input)
    const created = await createDepot(ctx, data)
    revalidatePath('/depots')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateDepotAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = depotUpdateSchema.parse(input)
    await updateDepot(ctx, id, data)
    revalidatePath('/depots')
    revalidatePath(`/depots/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteDepotAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteDepot(ctx, id)
    revalidatePath('/depots')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Entretiens ───────────────────────────────────────────────────────────

export const createDepotMaintenanceAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = depotMaintenanceCreateSchema.parse(input)
    await createDepotMaintenance(ctx, data)
    revalidatePath(`/depots/${data.depotId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateDepotMaintenanceAction = async (
  id: string,
  depotId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = depotMaintenanceUpdateSchema.parse(input)
    await updateDepotMaintenance(ctx, id, data)
    revalidatePath(`/depots/${depotId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteDepotMaintenanceAction = async (
  id: string,
  depotId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteDepotMaintenance(ctx, id)
    revalidatePath(`/depots/${depotId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Rappel d'entretien (tâche) ─────────────────────────────────────────────

export const createDepotMaintenanceReminderTaskAction = async (args: {
  depotId: string
  subject: string
  dueDate?: string
}): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskCreateSchema.parse({
      subject: args.subject,
      dueDate: args.dueDate,
      depotId: args.depotId,
      assigneeId: ctx.memberId,
    })
    await createTask(ctx, data)
    revalidatePath('/taches')
    revalidatePath(`/depots/${args.depotId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Documents ──────────────────────────────────────────────────────────────

export const deleteDepotDocumentAction = async (
  documentId: string,
  depotId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteDepotDocument(ctx, documentId)
    revalidatePath(`/depots/${depotId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
