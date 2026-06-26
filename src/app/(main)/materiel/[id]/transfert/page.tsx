import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, Forklift, HardHat, MapPin, Warehouse, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { TOOL_KIND_LABELS, TOOL_STATUS_LABELS } from '@/lib/crm/labels'
import { listDepotOptions } from '@/services/crm/depot'
import { listSiteOptions } from '@/services/crm/site'
import { getTool } from '@/services/crm/tool'
import { TransferForm } from './_components/transfer-form'

interface TransfertPageProps {
  params: Promise<{ id: string }>
}

export default async function TransfertPage({ params }: TransfertPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'toolTransfer', 'create')) redirect('/materiel')
  const { id } = await params

  let tool: Awaited<ReturnType<typeof getTool>>
  try {
    tool = await getTool(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const [depots, sites] = await Promise.all([listDepotOptions(ctx), listSiteOptions(ctx)])

  const isMachine = tool.kind === 'machine'
  const location = tool.currentDepotName ?? tool.currentSiteName
  const currentDepotId = tool.currentDepotId
  const currentSiteId = tool.currentSiteId

  return (
    <div className='mx-auto max-w-md px-4 py-6'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/materiel/${id}`} />}>
        <ChevronLeft className='size-4' /> Fiche matériel
      </Button>

      <div className='mb-6 flex items-start gap-3'>
        <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
          {isMachine ? <Forklift className='size-5' /> : <Wrench className='size-5' />}
        </div>
        <div>
          <h1 className='text-xl font-bold tracking-tight'>{tool.name}</h1>
          <div className='mt-1 flex flex-wrap gap-2'>
            <Badge variant='secondary'>{TOOL_KIND_LABELS[tool.kind] ?? tool.kind}</Badge>
            <Badge variant='outline'>{TOOL_STATUS_LABELS[tool.status] ?? tool.status}</Badge>
          </div>
        </div>
      </div>

      <div className='mb-6 flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm'>
        {tool.currentSiteName ? (
          <HardHat className='size-4 text-muted-foreground' />
        ) : (
          <Warehouse className='size-4 text-muted-foreground' />
        )}
        <span>
          Actuellement : <span className='font-medium'>{location ?? 'Non localisé'}</span>
        </span>
      </div>

      <h2 className='mb-3 flex items-center gap-2 font-semibold'>
        <MapPin className='size-4' /> Nouvelle localisation
      </h2>

      <TransferForm
        toolId={id}
        depots={depots}
        sites={sites}
        currentDepotId={currentDepotId}
        currentSiteId={currentSiteId}
      />
    </div>
  )
}
