import 'server-only'
import { and, asc, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@/database'
import { client, contact } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { ContactCreateInput, ContactUpdateInput } from '@/validation/contact'

export interface ContactOption {
  id: string
  firstName: string
  lastName: string | null
}

/** Contacts d'un client pour un sélecteur (ex. interlocuteur d'une affaire). */
export const listContactsForClient = async (
  ctx: OrgContext,
  clientId: string
): Promise<ContactOption[]> => {
  requirePermission(ctx, 'contact', 'read')

  return db
    .select({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
    })
    .from(contact)
    .where(
      and(
        eq(contact.clientId, clientId),
        eq(contact.organizationId, ctx.organizationId),
        isNull(contact.deletedAt)
      )
    )
    .orderBy(asc(contact.firstName))
}

/**
 * Services CRM — contacts (interlocuteurs d'un client).
 * Cloisonnement multi-tenant : filtre `organizationId` partout ; on vérifie que
 * le client parent appartient à l'organisation avant toute écriture.
 */

/** Vérifie qu'un client appartient à l'organisation (et n'est pas supprimé). */
const assertClientInOrg = async (ctx: OrgContext, clientId: string): Promise<void> => {
  const [row] = await db
    .select({ id: client.id })
    .from(client)
    .where(
      and(
        eq(client.id, clientId),
        eq(client.organizationId, ctx.organizationId),
        isNull(client.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Client introuvable')
}

export const createContact = async (ctx: OrgContext, input: ContactCreateInput) => {
  requirePermission(ctx, 'contact', 'create')
  await assertClientInOrg(ctx, input.clientId)

  return db.transaction(async (tx) => {
    if (input.isPrimary) {
      await tx
        .update(contact)
        .set({ isPrimary: false })
        .where(
          and(eq(contact.clientId, input.clientId), eq(contact.organizationId, ctx.organizationId))
        )
    }
    const [created] = await tx
      .insert(contact)
      .values({ ...input, organizationId: ctx.organizationId })
      .returning()
    return created
  })
}

export const updateContact = async (ctx: OrgContext, id: string, input: ContactUpdateInput) => {
  requirePermission(ctx, 'contact', 'update')

  const [existing] = await db
    .select({ id: contact.id, clientId: contact.clientId })
    .from(contact)
    .where(
      and(
        eq(contact.id, id),
        eq(contact.organizationId, ctx.organizationId),
        isNull(contact.deletedAt)
      )
    )
    .limit(1)
  if (!existing) throw new NotFoundError('Contact introuvable')

  return db.transaction(async (tx) => {
    if (input.isPrimary && existing.clientId) {
      await tx
        .update(contact)
        .set({ isPrimary: false })
        .where(
          and(
            eq(contact.clientId, existing.clientId),
            eq(contact.organizationId, ctx.organizationId),
            ne(contact.id, id)
          )
        )
    }
    const [updated] = await tx
      .update(contact)
      .set(input)
      .where(and(eq(contact.id, id), eq(contact.organizationId, ctx.organizationId)))
      .returning()
    return updated
  })
}

export const softDeleteContact = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'contact', 'delete')

  const [deleted] = await db
    .update(contact)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(contact.id, id),
        eq(contact.organizationId, ctx.organizationId),
        isNull(contact.deletedAt)
      )
    )
    .returning({ id: contact.id })

  if (!deleted) throw new NotFoundError('Contact introuvable')
}
