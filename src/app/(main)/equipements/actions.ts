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
import { createEquipment, softDeleteEquipment, updateEquipment } from '@/services/crm/equipment'
import { deleteEquipmentDocument } from '@/services/crm/equipment-document'
import { createLocation, softDeleteLocation, updateLocation } from '@/services/crm/location'
import {
  createMaintenance,
  softDeleteMaintenance,
  updateMaintenance,
} from '@/services/crm/maintenance'
import { createTask } from '@/services/crm/task'
import { equipmentCreateSchema, equipmentUpdateSchema } from '@/validation/equipment'
import { locationCreateSchema, locationUpdateSchema } from '@/validation/location'
import { maintenanceCreateSchema, maintenanceUpdateSchema } from '@/validation/maintenance'
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

// ── Localisations ───────────────────────────────────────────────────────────

export const createLocationAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = locationCreateSchema.parse(input)
    await createLocation(ctx, data)
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateLocationAction = async (
  id: string,
  clientId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = locationUpdateSchema.parse(input)
    await updateLocation(ctx, id, data)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteLocationAction = async (id: string, clientId: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteLocation(ctx, id)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Équipements ───────────────────────────────────────────────────────────

export const createEquipmentAction = async (
  clientId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = equipmentCreateSchema.parse(input)
    const created = await createEquipment(ctx, data)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateEquipmentAction = async (
  id: string,
  clientId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = equipmentUpdateSchema.parse(input)
    await updateEquipment(ctx, id, data)
    revalidatePath(`/equipements/${id}`)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteEquipmentAction = async (
  id: string,
  clientId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteEquipment(ctx, id)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Entretiens ───────────────────────────────────────────────────────────

export const createMaintenanceAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = maintenanceCreateSchema.parse(input)
    await createMaintenance(ctx, data)
    revalidatePath(`/equipements/${data.equipmentId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateMaintenanceAction = async (
  id: string,
  equipmentId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = maintenanceUpdateSchema.parse(input)
    await updateMaintenance(ctx, id, data)
    revalidatePath(`/equipements/${equipmentId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteMaintenanceAction = async (
  id: string,
  equipmentId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteMaintenance(ctx, id)
    revalidatePath(`/equipements/${equipmentId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Rappel d'entretien (tâche) ───────────────────────────────────────────

export const createMaintenanceReminderTaskAction = async (args: {
  equipmentId: string
  clientId?: string
  subject: string
  dueDate?: string
}): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = taskCreateSchema.parse({
      subject: args.subject,
      dueDate: args.dueDate,
      clientId: args.clientId,
      equipmentId: args.equipmentId,
      assigneeId: ctx.memberId,
    })
    await createTask(ctx, data)
    revalidatePath('/taches')
    revalidatePath(`/equipements/${args.equipmentId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Documents / images ───────────────────────────────────────────────────

export const deleteEquipmentDocumentAction = async (
  documentId: string,
  equipmentId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteEquipmentDocument(ctx, documentId)
    revalidatePath(`/equipements/${equipmentId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
