import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { listContactsForClient } from '@/services/crm/contact'
import { getDeal } from '@/services/crm/deal'
import { listOrgMembers } from '@/services/org/members'
import { DealForm, type DealFormValues } from '../../_components/deal-form'

interface ModifierAffairePageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierAffairePage({ params }: ModifierAffairePageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'deal', 'update')) redirect('/affaires')
  const { id } = await params

  let deal: Awaited<ReturnType<typeof getDeal>>
  try {
    deal = await getDeal(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const [clients, owners, contacts] = await Promise.all([
    listClientOptions(ctx),
    listOrgMembers(ctx),
    listContactsForClient(ctx, deal.clientId),
  ])

  const initial: Partial<DealFormValues> = {
    title: deal.title,
    clientId: deal.clientId,
    primaryContactId: deal.primaryContactId,
    stage: deal.stage,
    estimatedAmount: deal.estimatedAmount,
    probability: deal.probability !== null ? String(deal.probability) : null,
    expectedCloseDate: deal.expectedCloseDate,
    source: deal.source,
    ownerId: deal.ownerId,
    notes: deal.notes,
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/affaires/${id}`} />}>
        <ChevronLeft className='size-4' /> Affaire
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier l'affaire</h1>
      <DealForm
        mode='edit'
        dealId={id}
        clients={clients}
        owners={owners}
        initial={initial}
        initialContacts={contacts}
      />
    </div>
  )
}
