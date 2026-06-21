import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { listOrgMembers } from '@/services/org/members'
import { DealForm } from '../_components/deal-form'

interface NouvelleAffairePageProps {
  searchParams: Promise<{ clientId?: string }>
}

export default async function NouvelleAffairePage({ searchParams }: NouvelleAffairePageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'deal', 'create')) redirect('/affaires')

  const { clientId } = await searchParams
  const [clients, owners] = await Promise.all([listClientOptions(ctx), listOrgMembers(ctx)])
  const prefillClient = clientId && clients.some((c) => c.id === clientId) ? clientId : undefined

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/affaires' />}>
        <ChevronLeft className='size-4' /> Affaires
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouvelle affaire</h1>
      <DealForm
        mode='create'
        clients={clients}
        owners={owners}
        initial={prefillClient ? { clientId: prefillClient } : undefined}
      />
    </div>
  )
}
