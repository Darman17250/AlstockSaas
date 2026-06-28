import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { getDepot } from '@/services/crm/depot'
import { listOrgMembers } from '@/services/org/members'
import { DepotForm } from '../../_components/depot-form'

interface ModifierDepotPageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierDepotPage({ params }: ModifierDepotPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'depot', 'update')) redirect('/depots')
  const { id } = await params

  let depot: Awaited<ReturnType<typeof getDepot>>
  try {
    depot = await getDepot(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const members = await listOrgMembers(ctx)

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/depots/${id}`} />}>
        <ChevronLeft className='size-4' /> {depot.name}
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le dépôt</h1>
      <DepotForm
        mode='edit'
        depotId={id}
        members={members}
        initial={{
          type: depot.type,
          name: depot.name,
          addressLine1: depot.addressLine1,
          addressLine2: depot.addressLine2,
          postalCode: depot.postalCode,
          city: depot.city,
          country: depot.country,
          responsibleId: depot.responsibleId,
          notes: depot.notes,
          registrationNumber: depot.registrationNumber,
          brand: depot.brand,
          model: depot.model,
          year: depot.year,
          fuelType: depot.fuelType,
          vin: depot.vin,
          firstRegistrationDate: depot.firstRegistrationDate,
          mileage: depot.mileage,
        }}
      />
    </div>
  )
}
