import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { getSite } from '@/services/crm/site'
import { listOrgMembers } from '@/services/org/members'
import { SiteForm, type SiteFormValues } from '../../_components/site-form'

interface ModifierChantierPageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierChantierPage({ params }: ModifierChantierPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'site', 'update')) redirect('/chantiers')
  const { id } = await params

  let site: Awaited<ReturnType<typeof getSite>>
  try {
    site = await getSite(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const [clients, members] = await Promise.all([listClientOptions(ctx), listOrgMembers(ctx)])

  const initial: Partial<SiteFormValues> = {
    name: site.name,
    clientId: site.clientId,
    reference: site.reference,
    status: site.status,
    addressLine1: site.addressLine1,
    postalCode: site.postalCode,
    city: site.city,
    country: site.country,
    startDate: site.startDate,
    endDate: site.endDate,
    actualStartDate: site.actualStartDate,
    actualEndDate: site.actualEndDate,
    conducteurId: site.conducteurId,
    description: site.description,
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button
        variant='ghost'
        size='sm'
        className='mb-4'
        render={<Link href={`/chantiers/${id}`} />}
      >
        <ChevronLeft className='size-4' /> Chantier
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le chantier</h1>
      <SiteForm mode='edit' siteId={id} clients={clients} members={members} initial={initial} />
    </div>
  )
}
