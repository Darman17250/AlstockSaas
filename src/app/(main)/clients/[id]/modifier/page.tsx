import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { getClient } from '@/services/crm/client'
import { listOrgMembers } from '@/services/org/members'
import { ClientForm } from '../../_components/client-form'

interface ModifierClientPageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierClientPage({ params }: ModifierClientPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'client', 'update')) redirect('/clients')
  const { id } = await params

  let data: Awaited<ReturnType<typeof getClient>>
  try {
    data = await getClient(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const owners = await listOrgMembers(ctx)

  return (
    <div className='mx-auto max-w-2xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/clients/${id}`} />}>
        <ChevronLeft className='size-4' /> Retour
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le client</h1>
      <ClientForm
        mode='edit'
        clientId={id}
        owners={owners}
        initial={{
          type: data.type as 'societe' | 'particulier',
          relationType: data.relationType as 'client' | 'prestataire',
          name: data.name,
          civility: data.civility as 'monsieur' | 'madame' | null,
          siret: data.siret,
          sector: data.sector,
          email: data.email,
          phone: data.phone,
          website: data.website,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          postalCode: data.postalCode,
          city: data.city,
          country: data.country,
          ownerId: data.ownerId,
          notes: data.notes,
        }}
      />
    </div>
  )
}
