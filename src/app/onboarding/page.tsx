import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt } from 'drizzle-orm'

import { db } from '@/database'
import { invitation, organization } from '@/database/schema'
import { auth } from '@/lib/auth/auth'
import { getOrgContext } from '@/lib/auth/org-context'
import { OnboardingForm } from './onboarding-form'
import { PendingInvitations } from './pending-invitations'

/**
 * Onboarding — l'utilisateur connecté sans organisation active peut :
 *  - rejoindre une organisation qui l'a invité (invitations en attente sur son email),
 *  - ou créer sa propre organisation.
 * Hors du guard `(main)` car accessible sans org active.
 */
export default async function OnboardingPage() {
  const ctx = await getOrgContext()
  if (ctx) redirect('/dashboard')

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login?callbackUrl=/onboarding')

  const invites = await db
    .select({
      id: invitation.id,
      role: invitation.role,
      organizationName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(
      and(
        eq(invitation.email, session.user.email),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date())
      )
    )

  return (
    <main className='flex min-h-svh items-center justify-center p-4'>
      <div className='w-full max-w-md space-y-8'>
        {invites.length > 0 && <PendingInvitations invites={invites} />}
        <OnboardingForm hasInvites={invites.length > 0} />
      </div>
    </main>
  )
}
