import { and, eq } from 'drizzle-orm'

import { db } from '@/database'
import { invitation, member, user } from '@/database/schema'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can, ROLE_LABELS } from '@/lib/auth/permissions'
import { listExpiringHabilitations } from '@/services/org/habilitation'
import { listRoles, type RoleSummary } from '@/services/org/roles'
import { TeamTabs } from '../_components/team-tabs'

export default async function EquipePage() {
  const ctx = await requireOrgContext()
  const canManage = ctx.role === 'owner' || ctx.role === 'admin'

  const rawMembers = await db
    .select({
      memberId: member.id,
      role: member.role,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.organizationId))

  const pendingInvitations = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, ctx.organizationId), eq(invitation.status, 'pending')))

  // Gestion des rôles réservée à l'administration ; bannière visible si lecture des
  // habilitations autorisée.
  const roles: RoleSummary[] = canManage ? await listRoles(ctx) : []
  const expiring = can(ctx, 'habilitation', 'read') ? await listExpiringHabilitations(ctx) : []

  const roleLookup = new Map(roles.map((r) => [r.slug, { name: r.name, color: r.color }]))
  const resolveRole = (slug: string) =>
    roleLookup.get(slug) ?? { name: ROLE_LABELS[slug] ?? slug, color: null }

  const members = rawMembers.map((m) => ({
    ...m,
    roleName: resolveRole(m.role).name,
    roleColor: resolveRole(m.role).color,
  }))

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <h1 className='mb-2 text-2xl font-bold tracking-tight'>Équipe</h1>
      <p className='mb-8 text-muted-foreground'>
        Gérez les membres de votre organisation, leurs rôles et leurs habilitations.
      </p>

      <TeamTabs
        canManage={canManage}
        currentMemberId={ctx.memberId}
        members={members}
        invitations={pendingInvitations.map((i) => ({
          ...i,
          roleName: resolveRole(i.role ?? 'member').name,
          expiresAt: i.expiresAt.toISOString(),
        }))}
        roles={roles}
        expiring={expiring}
      />
    </div>
  )
}
