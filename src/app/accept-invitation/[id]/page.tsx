import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth/auth'
import { AcceptInvitation } from './accept-invitation'

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  // Doit être connecté pour accepter (avec l'email invité). Sinon → login,
  // puis retour ici via callbackUrl.
  if (!session?.user) {
    redirect(`/login?callbackUrl=/accept-invitation/${id}`)
  }

  return (
    <main className='flex min-h-svh items-center justify-center p-4'>
      <AcceptInvitation invitationId={id} />
    </main>
  )
}
