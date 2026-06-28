import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { listOrgMembers } from '@/services/org/members'
import { SiteForm } from '../_components/site-form'

interface NouveauChantierPageProps {
  searchParams: Promise<{ clientId?: string }>
}

export default async function NouveauChantierPage({ searchParams }: NouveauChantierPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'site', 'create')) redirect('/chantiers')

  const { clientId } = await searchParams
  const [clients, members] = await Promise.all([listClientOptions(ctx), listOrgMembers(ctx)])
  const prefillClient = clientId && clients.some((c) => c.id === clientId) ? clientId : undefined

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/chantiers' />}>
        <ChevronLeft className='size-4' /> Chantiers
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau chantier</h1>
      <SiteForm
        mode='create'
        clients={clients}
        members={members}
        initial={prefillClient ? { clientId: prefillClient } : undefined}
      />
    </div>
  )
}
