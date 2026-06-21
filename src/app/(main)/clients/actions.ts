'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import {
  createCommunication,
  deleteCommunication,
  updateCommunication,
} from '@/services/crm/activity'
import { createClient, softDeleteClient, updateClient } from '@/services/crm/client'
import { createContact, softDeleteContact, updateContact } from '@/services/crm/contact'
import { communicationCreateSchema, communicationUpdateSchema } from '@/validation/activity'
import { clientCreateSchema, clientUpdateSchema } from '@/validation/client'
import { contactCreateSchema, contactUpdateSchema } from '@/validation/contact'

/**
 * Façade fine : récupère le contexte org, valide l'entrée (Zod), appelle un
 * service, revalide le cache, renvoie un résultat sérialisable. Aucune logique
 * métier ici (cf. CLAUDE.md §7).
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

/** Traduit les erreurs typées (Zod + métier) en message FR pour l'UI. */
const toError = (e: unknown): string => {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Données invalides'
  if (e instanceof UnauthorizedError) return 'Authentification requise'
  if (e instanceof ForbiddenError) return e.message
  if (e instanceof NotFoundError) return e.message
  return 'Une erreur est survenue'
}

export const createClientAction = async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = clientCreateSchema.parse(input)
    const created = await createClient(ctx, data)
    revalidatePath('/clients')
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateClientAction = async (
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = clientUpdateSchema.parse(input)
    const updated = await updateClient(ctx, id, data)
    revalidatePath('/clients')
    revalidatePath(`/clients/${id}`)
    return { ok: true, data: { id: updated.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteClientAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteClient(ctx, id)
    revalidatePath('/clients')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const createContactAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = contactCreateSchema.parse(input)
    await createContact(ctx, data)
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateContactAction = async (
  id: string,
  clientId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = contactUpdateSchema.parse(input)
    await updateContact(ctx, id, data)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteContactAction = async (id: string, clientId: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteContact(ctx, id)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const createCommunicationAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = communicationCreateSchema.parse(input)
    await createCommunication(ctx, data)
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateCommunicationAction = async (
  id: string,
  clientId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = communicationUpdateSchema.parse(input)
    await updateCommunication(ctx, id, data)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteCommunicationAction = async (
  id: string,
  clientId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteCommunication(ctx, id)
    revalidatePath(`/clients/${clientId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
