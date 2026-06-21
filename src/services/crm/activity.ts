import 'server-only'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { activity, client, member, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import { COMMUNICATION_TYPES } from '@/lib/crm/labels'
import type { CommunicationCreateInput, CommunicationUpdateInput } from '@/validation/activity'

/**
 * Services CRM — communications (entité `activity`, types d'interaction).
 * Cloisonnement multi-tenant : filtre `organizationId` partout ; le client parent
 * et l'auteur (assigneeId) doivent appartenir à l'organisation.
 * Hard-delete (l'activité est une entité « journal », cf. cadrage).
 */

const COMM_TYPES = [...COMMUNICATION_TYPES]

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

/** Vérifie qu'un membre (auteur) appartient à l'organisation du contexte. */
const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Auteur invalide pour cette organisation')
}

export interface CommunicationItem {
  id: string
  type: string
  subject: string
  description: string | null
  occurredAt: Date | null
  authorId: string | null
  authorName: string | null
}

export const listClientCommunications = async (
  ctx: OrgContext,
  clientId: string
): Promise<CommunicationItem[]> => {
  requirePermission(ctx, 'activity', 'read')

  const rows = await db
    .select({
      id: activity.id,
      type: activity.type,
      subject: activity.subject,
      description: activity.description,
      occurredAt: activity.completedAt,
      authorId: activity.assigneeId,
      authorName: user.name,
    })
    .from(activity)
    .leftJoin(member, eq(activity.assigneeId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(activity.clientId, clientId),
        eq(activity.organizationId, ctx.organizationId),
        inArray(activity.type, COMM_TYPES)
      )
    )
    .orderBy(desc(activity.completedAt), desc(activity.createdAt))

  return rows
}

export const createCommunication = async (ctx: OrgContext, input: CommunicationCreateInput) => {
  requirePermission(ctx, 'activity', 'create')
  await assertClientInOrg(ctx, input.clientId)
  if (input.assigneeId) await assertMemberInOrg(ctx, input.assigneeId)

  const [created] = await db
    .insert(activity)
    .values({
      organizationId: ctx.organizationId,
      type: input.type,
      subject: input.subject,
      description: input.description,
      clientId: input.clientId,
      assigneeId: input.assigneeId ?? ctx.memberId,
      status: 'fait',
      completedAt: input.occurredAt,
    })
    .returning()

  return created
}

export const updateCommunication = async (
  ctx: OrgContext,
  id: string,
  input: CommunicationUpdateInput
) => {
  requirePermission(ctx, 'activity', 'update')
  if (input.assigneeId) await assertMemberInOrg(ctx, input.assigneeId)

  const [updated] = await db
    .update(activity)
    .set({
      type: input.type,
      subject: input.subject,
      description: input.description ?? null,
      completedAt: input.occurredAt,
      assigneeId: input.assigneeId ?? ctx.memberId,
    })
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        inArray(activity.type, COMM_TYPES)
      )
    )
    .returning()

  if (!updated) throw new NotFoundError('Communication introuvable')
  return updated
}

export const deleteCommunication = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'activity', 'delete')

  const [deleted] = await db
    .delete(activity)
    .where(
      and(
        eq(activity.id, id),
        eq(activity.organizationId, ctx.organizationId),
        inArray(activity.type, COMM_TYPES)
      )
    )
    .returning({ id: activity.id })

  if (!deleted) throw new NotFoundError('Communication introuvable')
}
