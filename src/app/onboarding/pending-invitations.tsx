'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { client } from '@/lib/auth/auth-client'
import { ROLE_LABELS } from '@/lib/auth/permissions'

interface Invite {
  id: string
  role: string | null
  organizationName: string
}

export const PendingInvitations = ({ invites }: { invites: Invite[] }) => {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async (id: string) => {
    setBusy(id)
    setError(null)
    const res = await client.organization.acceptInvitation({ invitationId: id })
    if (res.error) {
      setError(res.error.message ?? 'Impossible de rejoindre l’organisation.')
      setBusy(null)
      return
    }
    const organizationId = res.data?.invitation?.organizationId
    if (organizationId) {
      await client.organization.setActive({ organizationId })
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-1 text-center'>
        <h1 className='text-2xl font-semibold tracking-tight'>Vous êtes invité 🎉</h1>
        <p className='text-sm text-muted-foreground'>
          Rejoignez une organisation qui vous a invité.
        </p>
      </div>

      {error && <p className='text-center text-sm text-red-500'>{error}</p>}

      <ul className='space-y-2'>
        {invites.map((inv) => (
          <li key={inv.id} className='flex items-center gap-3 rounded-lg border p-3'>
            <div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
              <Building className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{inv.organizationName}</p>
              <p className='text-xs text-muted-foreground'>
                {ROLE_LABELS[inv.role ?? 'member'] ?? inv.role}
              </p>
            </div>
            <Button size='sm' onClick={() => handleAccept(inv.id)} disabled={busy !== null}>
              {busy === inv.id ? <Loader2 className='size-4 animate-spin' /> : 'Rejoindre'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
