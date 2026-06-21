import 'server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { member, site, siteMember, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'

/**
 * Services — équipe assignée à un chantier (liaison n–n `site_member`).
 * Cloisonnement multi-tenant : toute requête filtre `organizationId = ctx.organizationId`.
 */

/** Vérifie qu'un chantier appartient à l'organisation (et n'est pas supprimé). */
const assertSiteInOrg = async (ctx: OrgContext, siteId: string): Promise<void> => {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(
      and(eq(site.id, siteId), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Chantier introuvable')
}

/** Vérifie qu'un membre appartient bien à l'organisation du contexte. */
const assertMemberInOrg = async (ctx: OrgContext, memberId: string): Promise<void> => {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!row) throw new ForbiddenError('Salarié invalide pour cette organisation')
}

export interface SiteTeamMember {
  memberId: string
  name: string
  role: string
}

export const listSiteTeam = async (ctx: OrgContext, siteId: string): Promise<SiteTeamMember[]> => {
  requirePermission(ctx, 'site', 'read')

  const rows = await db
    .select({ memberId: siteMember.memberId, name: user.name, email: user.email, role: member.role })
    .from(siteMember)
    .innerJoin(member, eq(siteMember.memberId, member.id))
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(siteMember.siteId, siteId), eq(siteMember.organizationId, ctx.organizationId)))
    .orderBy(asc(user.name))

  return rows.map((r) => ({ memberId: r.memberId, name: r.name || r.email, role: r.role }))
}

/** Assigne un salarié à un chantier (idempotent : ignore les doublons). */
export const assignSiteMember = async (
  ctx: OrgContext,
  siteId: string,
  memberId: string
): Promise<void> => {
  requirePermission(ctx, 'site', 'update')
  await assertSiteInOrg(ctx, siteId)
  await assertMemberInOrg(ctx, memberId)

  await db
    .insert(siteMember)
    .values({ organizationId: ctx.organizationId, siteId, memberId })
    .onConflictDoNothing({ target: [siteMember.siteId, siteMember.memberId] })
}

/** Retire un salarié de l'équipe d'un chantier. */
export const removeSiteMember = async (
  ctx: OrgContext,
  siteId: string,
  memberId: string
): Promise<void> => {
  requirePermission(ctx, 'site', 'update')
  await assertSiteInOrg(ctx, siteId)

  await db
    .delete(siteMember)
    .where(
      and(
        eq(siteMember.siteId, siteId),
        eq(siteMember.memberId, memberId),
        eq(siteMember.organizationId, ctx.organizationId)
      )
    )
}
