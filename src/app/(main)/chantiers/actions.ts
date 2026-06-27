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
import { deleteSiteDocument } from '@/services/crm/site-document'
import { assignSiteMember, removeSiteMember } from '@/services/crm/site-member'
import { deleteSiteMessage } from '@/services/crm/site-message'
import {
  createSiteReport,
  softDeleteSiteReport,
  updateSiteReport,
} from '@/services/crm/site-report'
import { deleteSiteReportPhoto } from '@/services/crm/site-report-photo'
import { createSite, softDeleteSite, updateSite } from '@/services/crm/site'
import { siteCreateSchema, siteUpdateSchema } from '@/validation/site'
import { siteReportCreateSchema, siteReportUpdateSchema } from '@/validation/site-report'

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

export const createSiteAction = async (input: unknown): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = siteCreateSchema.parse(input)
    const created = await createSite(ctx, data)
    revalidatePath('/chantiers')
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateSiteAction = async (
  id: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = siteUpdateSchema.parse(input)
    const updated = await updateSite(ctx, id, data)
    revalidatePath('/chantiers')
    revalidatePath(`/chantiers/${id}`)
    revalidatePath(`/clients/${data.clientId}`)
    if (updated.dealId) revalidatePath(`/affaires/${updated.dealId}`)
    return { ok: true, data: { id: updated.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteSiteAction = async (id: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteSite(ctx, id)
    revalidatePath('/chantiers')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteSiteDocumentAction = async (
  documentId: string,
  siteId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteSiteDocument(ctx, documentId)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const assignSiteMemberAction = async (
  siteId: string,
  memberId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await assignSiteMember(ctx, siteId, memberId)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const removeSiteMemberAction = async (
  siteId: string,
  memberId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await removeSiteMember(ctx, siteId, memberId)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteSiteMessageAction = async (messageId: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteSiteMessage(ctx, messageId)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const createSiteReportAction = async (
  input: unknown
): Promise<ActionResult<{ id: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = siteReportCreateSchema.parse(input)
    const created = await createSiteReport(ctx, data)
    revalidatePath(`/chantiers/${data.siteId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateSiteReportAction = async (
  id: string,
  siteId: string,
  input: unknown
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = siteReportUpdateSchema.parse(input)
    await updateSiteReport(ctx, id, data)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteSiteReportAction = async (id: string, siteId: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await softDeleteSiteReport(ctx, id)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteSiteReportPhotoAction = async (
  photoId: string,
  siteId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteSiteReportPhoto(ctx, photoId)
    revalidatePath(`/chantiers/${siteId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
