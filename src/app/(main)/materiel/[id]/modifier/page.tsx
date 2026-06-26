import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { getTool } from '@/services/crm/tool'
import { listOrgMembers } from '@/services/org/members'
import { ToolForm } from '../../_components/tool-form'

interface ModifierMaterielPageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierMaterielPage({ params }: ModifierMaterielPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'tool', 'update')) redirect('/materiel')
  const { id } = await params

  let tool: Awaited<ReturnType<typeof getTool>>
  try {
    tool = await getTool(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const members = await listOrgMembers(ctx)

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/materiel/${id}`} />}>
        <ChevronLeft className='size-4' /> {tool.name}
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le matériel</h1>
      <ToolForm
        mode='edit'
        toolId={id}
        members={members}
        initial={{
          kind: tool.kind,
          name: tool.name,
          category: tool.category,
          brand: tool.brand,
          model: tool.model,
          serialNumber: tool.serialNumber,
          reference: tool.reference,
          responsibleId: tool.responsibleId,
          purchaseDate: tool.purchaseDate,
          purchaseCost: tool.purchaseCost,
          maintenanceFrequencyMonths: tool.maintenanceFrequencyMonths,
          fuelLevel: tool.fuelLevel,
          engineHours: tool.engineHours,
          notes: tool.notes,
        }}
      />
    </div>
  )
}
