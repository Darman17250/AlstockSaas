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
import { listContactsForClient, type ContactOption } from '@/services/crm/contact'
import {
  createDeal,
  markDealLost,
  markDealWon,
  moveDealStage,
  reopenDeal,
  softDeleteDeal,
  updateDeal,
} from '@/services/crm/deal'
import { deleteDealDocument } from '@/services/crm/deal-document'
import {
  dealCreateSchema,
  dealLostSchema,
  dealStageSchema,
  dealUpdateSchema,
  dealWonSchema,
} from '@/validation/deal'

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
  if (e instanceof StorageNotConfiguredError) return e.message
  return 'Une erreur est survenue'
}

export const createDealAction = async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = dealCreateSchema.parse(input)
    const created = await createDeal(ctx, data)
    revalidatePath('/affaires')
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateDealAction = async (
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = dealUpdateSchema.parse(input)
    const updated = await updateDeal(ctx, id, data)
    revalidatePath('/affaires')
    revalidatePath(`/affaires/${id}`)
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: { id: updated.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteDealAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteDeal(ctx, id)
    revalidatePath('/affaires')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const moveDealStageAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = dealStageSchema.parse(input)
    await moveDealStage(ctx, id, data)
    revalidatePath('/affaires')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const markDealWonAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = dealWonSchema.parse(input)
    await markDealWon(ctx, id, data)
    revalidatePath('/affaires')
    revalidatePath(`/affaires/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const markDealLostAction = async (id: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = dealLostSchema.parse(input)
    await markDealLost(ctx, id, data)
    revalidatePath('/affaires')
    revalidatePath(`/affaires/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const reopenDealAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await reopenDeal(ctx, id)
    revalidatePath('/affaires')
    revalidatePath(`/affaires/${id}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

/** Lecture des interlocuteurs d'un client — peuple le sélecteur de contact. */
export const clientContactsAction = async (
  clientId: string
): Promise<ActionResult<ContactOption[]>> => {
  try {
    const ctx = await requireOrgContext()
    const contacts = await listContactsForClient(ctx, clientId)
    return { ok: true, data: contacts }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteDealDocumentAction = async (
  documentId: string,
  dealId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteDealDocument(ctx, documentId)
    revalidatePath(`/affaires/${dealId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
