import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listOrgMembers } from '@/services/org/members'
import { DepotForm } from '../_components/depot-form'

export default async function NouveauDepotPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'depot', 'create')) redirect('/depots')

  const members = await listOrgMembers(ctx)

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/depots' />}>
        <ChevronLeft className='size-4' /> Dépôts
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau dépôt</h1>
      <DepotForm mode='create' members={members} />
    </div>
  )
}
