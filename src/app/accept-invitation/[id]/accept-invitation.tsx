'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { client } from '@/lib/auth/auth-client'

export const AcceptInvitation = ({ invitationId }: { invitationId: string }) => {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setLoading('accept')
    setError(null)
    const res = await client.organization.acceptInvitation({ invitationId })
    if (res.error) {
      setError(res.error.message ?? 'Impossible d’accepter l’invitation.')
      setLoading(null)
      return
    }
    const organizationId = res.data?.invitation?.organizationId
    if (organizationId) {
      await client.organization.setActive({ organizationId })
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleReject = async () => {
    setLoading('reject')
    setError(null)
    await client.organization.rejectInvitation({ invitationId })
    router.push('/')
  }

  return (
    <div className='w-full max-w-md space-y-6 text-center'>
      <h1 className='text-2xl font-semibold tracking-tight'>
        Invitation à rejoindre une organisation
      </h1>
      <p className='text-muted-foreground'>
        Vous avez été invité à rejoindre une organisation. Souhaitez-vous accepter ?
      </p>
      {error && <p className='text-sm text-red-500'>{error}</p>}
      <div className='flex justify-center gap-3'>
        <Button onClick={handleAccept} disabled={loading !== null}>
          {loading === 'accept' ? 'Acceptation…' : 'Accepter'}
        </Button>
        <Button variant='outline' onClick={handleReject} disabled={loading !== null}>
          Refuser
        </Button>
      </div>
    </div>
  )
}
