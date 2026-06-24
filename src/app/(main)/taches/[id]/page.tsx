import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  ChevronLeft,
  HardHat,
  Package,
  User,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { TASK_STATUS_LABELS } from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { listClientOptions } from '@/services/crm/client'
import { listDealOptions } from '@/services/crm/deal'
import { listEquipmentOptions } from '@/services/crm/equipment'
import { listSiteOptions } from '@/services/crm/site'
import { getTask } from '@/services/crm/task'
import { listTaskDocuments } from '@/services/crm/task-document'
import { listOrgMembers } from '@/services/org/members'
import { TaskDetailActions } from './_components/task-detail-actions'
import { TaskDocumentsSection } from './_components/task-documents-section'

interface TaskPageProps {
  params: Promise<{ id: string }>
}

const dateLabel = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

const Line = ({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

const statusVariant = (status: string): 'default' | 'secondary' | 'outline' =>
  status === 'fait' ? 'secondary' : status === 'annule' ? 'outline' : 'default'

export default async function TaskPage({ params }: TaskPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let task: Awaited<ReturnType<typeof getTask>>
  try {
    task = await getTask(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx.role, 'activity', 'update')
  const canDelete = can(ctx.role, 'activity', 'delete')
  const documents = await listTaskDocuments(ctx, id)
  const storageConfigured = isStorageConfigured()

  const canReadEquipment = can(ctx.role, 'equipment', 'read')
  const [members, clients, deals, sites, equipments] = canEdit
    ? await Promise.all([
        listOrgMembers(ctx),
        listClientOptions(ctx),
        listDealOptions(ctx),
        listSiteOptions(ctx),
        canReadEquipment ? listEquipmentOptions(ctx) : Promise.resolve([]),
      ])
    : [[], [], [], [], []]

  const view = {
    ...task,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/taches' />}>
        <ChevronLeft className='size-4' /> Tâches
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <CheckSquare className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{task.subject}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant={statusVariant(task.status)}>
                {TASK_STATUS_LABELS[task.status] ?? task.status}
              </Badge>
              {task.dueDate && (
                <Badge variant='outline'>Échéance : {dateLabel(task.dueDate)}</Badge>
              )}
            </div>
          </div>
        </div>
        <TaskDetailActions
          task={view}
          members={members}
          clients={clients}
          deals={deals}
          sites={sites}
          equipments={equipments}
          currentMemberId={ctx.memberId}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          {task.assigneeName && <Line icon={User}>Responsable : {task.assigneeName}</Line>}
          {task.coAssignees.length > 0 && (
            <Line icon={Users}>
              <span className='flex flex-wrap gap-1'>
                {task.coAssignees.map((c) => (
                  <Badge key={c.id} variant='secondary' size='sm'>
                    {c.name}
                  </Badge>
                ))}
              </span>
            </Line>
          )}
          {task.dueDate && <Line icon={Calendar}>Échéance : {dateLabel(task.dueDate)}</Line>}
          {task.clientId && task.clientName && (
            <Line icon={Building2}>
              <Link href={`/clients/${task.clientId}`} className='hover:underline'>
                {task.clientName}
              </Link>
            </Line>
          )}
          {task.dealId && task.dealTitle && (
            <Line icon={Briefcase}>
              <Link href={`/affaires/${task.dealId}`} className='hover:underline'>
                {task.dealTitle}
              </Link>
            </Line>
          )}
          {task.siteId && task.siteName && (
            <Line icon={HardHat}>
              <Link href={`/chantiers/${task.siteId}`} className='hover:underline'>
                {task.siteName}
              </Link>
            </Line>
          )}
          {task.equipmentId && task.equipmentName && (
            <Line icon={Package}>
              <Link href={`/equipements/${task.equipmentId}`} className='hover:underline'>
                {task.equipmentName}
              </Link>
            </Line>
          )}
        </section>

        {task.description && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Détails</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{task.description}</p>
          </section>
        )}

        <TaskDocumentsSection
          taskId={task.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
