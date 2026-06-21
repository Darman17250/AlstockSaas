import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listOrgMembers } from '@/services/org/members'
import { ClientForm } from '../_components/client-form'

export default async function NouveauClientPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'client', 'create')) redirect('/clients')

  const owners = await listOrgMembers(ctx)

  return (
    <div className='mx-auto max-w-2xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/clients' />}>
        <ChevronLeft className='size-4' /> Retour
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau client</h1>
      <ClientForm mode='create' owners={owners} />
    </div>
  )
}
