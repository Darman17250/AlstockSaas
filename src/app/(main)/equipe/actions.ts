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
import { assignMemberRole, createRole, deleteRole, updateRole } from '@/services/org/roles'
import { deleteHabilitation, deleteHabilitationDocument } from '@/services/org/habilitation'
import { assignRoleSchema, customRoleCreateSchema } from '@/validation/custom-role'

/**
 * Façade fine : contexte org → validation Zod → service → revalidation → résultat
 * sérialisable. Aucune logique métier ici (cf. CLAUDE.md §7). L'upload de fichiers
 * (habilitations) passe par des Route Handlers, cf. api/members/[memberId]/habilitations.
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

// ── Rôles ────────────────────────────────────────────────────────────────────

export const createRoleAction = async (input: unknown): Promise<ActionResult<{ slug: string }>> => {
  try {
    const ctx = await requireOrgContext()
    const data = customRoleCreateSchema.parse(input)
    const created = await createRole(ctx, data)
    revalidatePath('/equipe')
    return { ok: true, data: { slug: created.slug } }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const updateRoleAction = async (slug: string, input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const data = customRoleCreateSchema.parse(input)
    await updateRole(ctx, slug, data)
    revalidatePath('/equipe')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteRoleAction = async (slug: string): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteRole(ctx, slug)
    revalidatePath('/equipe')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const assignMemberRoleAction = async (input: unknown): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    const { memberId, slug } = assignRoleSchema.parse(input)
    await assignMemberRole(ctx, memberId, slug)
    revalidatePath('/equipe')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

// ── Habilitations ──────────────────────────────────────────────────────────

export const deleteHabilitationAction = async (
  habId: string,
  memberId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteHabilitation(ctx, habId)
    revalidatePath(`/equipe/${memberId}`)
    revalidatePath('/equipe')
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}

export const deleteHabilitationDocumentAction = async (
  habId: string,
  memberId: string
): Promise<ActionResult> => {
  try {
    const ctx = await requireOrgContext()
    await deleteHabilitationDocument(ctx, habId)
    revalidatePath(`/equipe/${memberId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: toError(e) }
  }
}
