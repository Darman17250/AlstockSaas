import { and, eq } from 'drizzle-orm'

import { db } from '@/database'
import { invitation, member, user } from '@/database/schema'
import { requireOrgContext } from '@/lib/auth/org-context'
import { TeamManagement } from '../_components/team-management'

export default async function EquipePage() {
  const ctx = await requireOrgContext()
  const canManage = ctx.role === 'owner' || ctx.role === 'admin'

  const members = await db
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

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <h1 className='mb-2 text-2xl font-bold tracking-tight'>Équipe</h1>
      <p className='mb-8 text-muted-foreground'>
        Gérez les membres de votre organisation, leurs rôles et les invitations.
      </p>

      <TeamManagement
        canManage={canManage}
        currentMemberId={ctx.memberId}
        members={members}
        invitations={pendingInvitations.map((i) => ({
          ...i,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </div>
  )
}
