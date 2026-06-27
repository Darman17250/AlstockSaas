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
import { createTask } from '@/services/crm/task'
import {
  createTool,
  setFuelLevel,
  softDeleteTool,
  updateEngineHours,
  updateTool,
} from '@/services/crm/tool'
import { deleteToolDocument } from '@/services/crm/tool-document'
import { reportIssue, resolveIssue } from '@/services/crm/tool-issue'
import {
  createToolMaintenance,
  softDeleteToolMaintenance,
  updateToolMaintenance,
} from '@/services/crm/tool-maintenance'
import { createTransfer } from '@/services/crm/tool-transfer'
import { taskCreateSchema } from '@/validation/task'
import {
  engineHoursSchema,
  fuelLevelSchema,
  toolCreateSchema,
  toolUpdateSchema,
} from '@/validation/tool'
import { toolIssueReportSchema } from '@/validation/tool-issue'
import {
  toolMaintenanceCreateSchema,
  toolMaintenanceUpdateSchema,
} from '@/validation/tool-maintenance'
import { toolTransferCreateSchema } from '@/validation/tool-transfer'

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

// ── Matériel ────────────────────────────────────────────────────────────────

export const createToolAction = async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolCreateSchema.parse(input)
    const created = await createTool(ctx, data)
    revalidatePath('/materiel')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateToolAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolUpdateSchema.parse(input)
    await updateTool(ctx, id, data)
    revalidatePath('/materiel')
    revalidatePath(`/materiel/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteToolAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteTool(ctx, id)
    revalidatePath('/materiel')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const setFuelLevelAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const { fuelLevel } = fuelLevelSchema.parse(input)
    await setFuelLevel(ctx, id, fuelLevel)
    revalidatePath(`/materiel/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateEngineHoursAction = async (
  id: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const { engineHours } = engineHoursSchema.parse(input)
    await updateEngineHours(ctx, id, engineHours)
    revalidatePath(`/materiel/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Entretiens ────────────────────────────────────────────────────────────

export const createToolMaintenanceAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolMaintenanceCreateSchema.parse(input)
    await createToolMaintenance(ctx, data)
    revalidatePath(`/materiel/${data.toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateToolMaintenanceAction = async (
  id: string,
  toolId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolMaintenanceUpdateSchema.parse(input)
    await updateToolMaintenance(ctx, id, data)
    revalidatePath(`/materiel/${toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteToolMaintenanceAction = async (
  id: string,
  toolId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteToolMaintenance(ctx, id)
    revalidatePath(`/materiel/${toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Transfert ───────────────────────────────────────────────────────────────

export const createTransferAction = async (
  toolId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolTransferCreateSchema.parse(input)
    const res = await createTransfer(ctx, toolId, data)
    revalidatePath('/materiel')
    revalidatePath(`/materiel/${toolId}`)
    // Revalide les fiches dépôt/chantier de départ et d'arrivée.
    for (const id of [res.fromDepotId, res.toDepotId]) if (id) revalidatePath(`/depots/${id}`)
    for (const id of [res.fromSiteId, res.toSiteId]) if (id) revalidatePath(`/chantiers/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Problèmes ────────────────────────────────────────────────────────────────

export const reportIssueAction = async (toolId: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = toolIssueReportSchema.parse(input)
    await reportIssue(ctx, toolId, data)
    revalidatePath('/materiel')
    revalidatePath(`/materiel/${toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const resolveIssueAction = async (
  issueId: string,
  toolId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await resolveIssue(ctx, issueId)
    revalidatePath('/materiel')
    revalidatePath(`/materiel/${toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Rappel d'entretien (tâche) ─────────────────────────────────────────────

export const createToolReminderTaskAction = async (args: {
  toolId: string
  subject: string
  dueDate?: string
}): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskCreateSchema.parse({
      subject: args.subject,
      dueDate: args.dueDate,
      toolId: args.toolId,
      assigneeId: ctx.memberId,
    })
    await createTask(ctx, data)
    revalidatePath('/taches')
    revalidatePath(`/materiel/${args.toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Documents ──────────────────────────────────────────────────────────────

export const deleteToolDocumentAction = async (
  documentId: string,
  toolId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteToolDocument(ctx, documentId)
    revalidatePath(`/materiel/${toolId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
