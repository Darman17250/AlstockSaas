import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDepotOptions } from '@/services/crm/depot'
import { listOrgMembers } from '@/services/org/members'
import { ToolForm } from '../_components/tool-form'

export default async function NouveauMaterielPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'tool', 'create')) redirect('/materiel')

  const [members, depots] = await Promise.all([listOrgMembers(ctx), listDepotOptions(ctx)])

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/materiel' />}>
        <ChevronLeft className='size-4' /> Matériel
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau matériel</h1>
      <ToolForm mode='create' members={members} depots={depots} />
    </div>
  )
}
