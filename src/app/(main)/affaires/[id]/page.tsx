import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Briefcase, Building2, Calendar, ChevronLeft, HardHat, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import {
  DEAL_SOURCE_LABELS,
  DEAL_STAGE_LABELS,
  DEAL_STATUS_LABELS,
  formatDealAmount,
} from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getDeal } from '@/services/crm/deal'
import { listDealDocuments } from '@/services/crm/deal-document'
import { listTasksForDeal, type TaskItem } from '@/services/crm/task'
import { listOrgMembers } from '@/services/org/members'
import { TasksSection } from '../../taches/_components/tasks-section'
import { DealActions } from './_components/deal-actions'
import { DocumentsSection } from './_components/documents-section'

const taskToView = (t: TaskItem) => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

interface DealPageProps {
  params: Promise<{ id: string }>
}

const dateLabel = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

const Line = ({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

export default async function DealPage({ params }: DealPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let data: Awaited<ReturnType<typeof getDeal>>
  try {
    data = await getDeal(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx.role, 'deal', 'update')
  const canDelete = can(ctx.role, 'deal', 'delete')
  const canCreateSite = can(ctx.role, 'site', 'create')
  const documents = await listDealDocuments(ctx, id)
  const storageConfigured = isStorageConfigured()
  const canReadTasks = can(ctx.role, 'activity', 'read')
  const canEditTasks = can(ctx.role, 'activity', 'create')
  const tasks = canReadTasks ? await listTasksForDeal(ctx, id) : []
  const taskMembers = canEditTasks ? await listOrgMembers(ctx) : []

  const amount = formatDealAmount(data.estimatedAmount, data.currency)
  const statusVariant =
    data.status === 'gagnee' ? 'secondary' : data.status === 'perdue' ? 'outline' : 'default'

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/affaires' />}>
        <ChevronLeft className='size-4' /> Affaires
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Briefcase className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{data.title}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant={statusVariant}>
                {DEAL_STATUS_LABELS[data.status] ?? data.status}
              </Badge>
              {data.status === 'en_cours' && (
                <Badge variant='outline'>{DEAL_STAGE_LABELS[data.stage] ?? data.stage}</Badge>
              )}
              {data.source && (
                <Badge variant='outline'>{DEAL_SOURCE_LABELS[data.source] ?? data.source}</Badge>
              )}
            </div>
          </div>
        </div>
        <DealActions
          dealId={data.id}
          status={data.status}
          title={data.title}
          canEdit={canEdit}
          canDelete={canDelete}
          canCreateSite={canCreateSite}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          <Line icon={Building2}>
            <Link href={`/clients/${data.clientId}`} className='hover:underline'>
              {data.clientName}
            </Link>
          </Line>
          {data.contactName && <Line icon={User}>{data.contactName}</Line>}
          {amount && (
            <Line icon={Briefcase}>
              <span className='font-semibold tabular-nums'>{amount}</span>
              {data.probability !== null && (
                <span className='text-muted-foreground'> · {data.probability}%</span>
              )}
            </Line>
          )}
          {data.expectedCloseDate && (
            <Line icon={Calendar}>Clôture prévue : {dateLabel(data.expectedCloseDate)}</Line>
          )}
          {data.ownerName && <Line icon={User}>Commercial : {data.ownerName}</Line>}
          {data.siteId && (
            <Line icon={HardHat}>
              <Link href={`/chantiers/${data.siteId}`} className='hover:underline'>
                Chantier lié
              </Link>
            </Line>
          )}
        </section>

        {data.status === 'gagnee' && data.wonAt && (
          <p className='text-sm text-muted-foreground'>
            Affaire gagnée le {dateLabel(data.wonAt)}.
          </p>
        )}
        {data.status === 'perdue' && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Perte</h2>
            <p className='text-sm text-muted-foreground'>
              {data.lostAt && `Le ${dateLabel(data.lostAt)}. `}
              {data.lostReason ? `Motif : ${data.lostReason}` : 'Aucun motif renseigné.'}
            </p>
          </section>
        )}

        {data.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{data.notes}</p>
          </section>
        )}

        {canReadTasks && (
          <TasksSection
            tasks={tasks.map(taskToView)}
            canEdit={canEditTasks}
            currentMemberId={ctx.memberId}
            members={taskMembers}
            locked={{ dealId: data.id, clientId: data.clientId }}
          />
        )}

        <DocumentsSection
          dealId={data.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
