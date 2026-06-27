import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Calendar,
  ChevronLeft,
  Forklift,
  HardHat,
  Hash,
  Tag,
  User,
  Warehouse,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { TOOL_KIND_LABELS, TOOL_STATUS_LABELS, formatCost } from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { listTasksForTool, type TaskItem } from '@/services/crm/task'
import { getTool } from '@/services/crm/tool'
import { listToolDocuments } from '@/services/crm/tool-document'
import { listIssuesForTool } from '@/services/crm/tool-issue'
import { listMaintenanceForTool } from '@/services/crm/tool-maintenance'
import { listTransfersForTool } from '@/services/crm/tool-transfer'
import { listOrgMembers } from '@/services/org/members'
import { TasksSection } from '../../taches/_components/tasks-section'
import { ToolDetailActions } from './_components/tool-detail-actions'
import { ToolDocumentsSection } from './_components/tool-documents-section'
import { ToolIssuesSection } from './_components/tool-issues-section'
import { ToolMachineSection } from './_components/tool-machine-section'
import { ToolMaintenanceSection } from './_components/tool-maintenance-section'
import { ToolReminderButton } from './_components/tool-reminder-button'
import { ToolTransfersSection } from './_components/tool-transfers-section'

const taskToView = (t: TaskItem) => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

interface MaterielPageProps {
  params: Promise<{ id: string }>
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const formatDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(`${d}T00:00:00`)
      )
    : null

const Line = ({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

export default async function MaterielDetailPage({ params }: MaterielPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let tool: Awaited<ReturnType<typeof getTool>>
  try {
    tool = await getTool(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx.role, 'tool', 'update')
  const canDelete = can(ctx.role, 'tool', 'delete')
  const canTransfer = can(ctx.role, 'toolTransfer', 'create')
  const canManageMaintenance = can(ctx.role, 'toolMaintenance', 'create')
  const canReportIssue = can(ctx.role, 'toolIssue', 'create')
  const canResolveIssue = can(ctx.role, 'toolIssue', 'update')
  const canCreateTask = can(ctx.role, 'activity', 'create')
  const canReadTasks = can(ctx.role, 'activity', 'read')

  const isMachine = tool.kind === 'machine'
  const { items, totalCost } = await listMaintenanceForTool(ctx, id)
  const transfers = await listTransfersForTool(ctx, id)
  const issues = await listIssuesForTool(ctx, id)
  const members = canManageMaintenance || canCreateTask ? await listOrgMembers(ctx) : []
  const documents = await listToolDocuments(ctx, id)
  const tasks = canReadTasks ? await listTasksForTool(ctx, id) : []
  const storageConfigured = isStorageConfigured()

  const overdue = tool.nextMaintenanceDate !== null && tool.nextMaintenanceDate < todayKey()
  const location = tool.currentDepotName ?? tool.currentSiteName
  const identification = [tool.brand, tool.model].filter(Boolean).join(' ')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/materiel' />}>
        <ChevronLeft className='size-4' /> Matériel
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            {isMachine ? <Forklift className='size-5' /> : <Wrench className='size-5' />}
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{tool.name}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant='secondary'>{TOOL_KIND_LABELS[tool.kind] ?? tool.kind}</Badge>
              <Badge variant='outline'>{TOOL_STATUS_LABELS[tool.status] ?? tool.status}</Badge>
              {tool.category && <Badge variant='outline'>{tool.category}</Badge>}
              {tool.hasOpenIssue && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  Problème en cours
                </Badge>
              )}
              {overdue && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  Entretien en retard
                </Badge>
              )}
            </div>
          </div>
        </div>
        <ToolDetailActions
          toolId={tool.id}
          toolName={tool.name}
          canEdit={canEdit}
          canDelete={canDelete}
          canTransfer={canTransfer}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          <Line icon={tool.currentSiteName ? HardHat : Warehouse}>
            Localisation : {location ?? 'Non localisé'}
          </Line>
          {tool.responsibleName && <Line icon={User}>Responsable : {tool.responsibleName}</Line>}
          {identification && <Line icon={Tag}>{identification}</Line>}
          {tool.serialNumber && <Line icon={Hash}>N° de série : {tool.serialNumber}</Line>}
          {tool.reference && <Line icon={Hash}>Réf. : {tool.reference}</Line>}
          {tool.purchaseDate && (
            <Line icon={Calendar}>Acheté le {formatDate(tool.purchaseDate)}</Line>
          )}
          {tool.purchaseCost && (
            <Line icon={Tag}>Coût d'achat : {formatCost(tool.purchaseCost)}</Line>
          )}
        </section>

        {isMachine && (
          <ToolMachineSection
            toolId={tool.id}
            fuelLevel={tool.fuelLevel}
            engineHours={tool.engineHours}
            canEdit={canEdit}
          />
        )}

        {tool.nextMaintenanceDate && (
          <section className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5'>
            <div>
              <h2 className='font-semibold'>Prochain entretien</h2>
              <p
                className={`text-sm ${overdue ? 'text-destructive-foreground' : 'text-muted-foreground'}`}
              >
                {overdue ? 'En retard depuis le ' : 'Prévu le '}
                {formatDate(tool.nextMaintenanceDate)}
              </p>
            </div>
            {canCreateTask && (
              <ToolReminderButton
                toolId={tool.id}
                subject={`Entretien : ${tool.name}`}
                dueDate={tool.nextMaintenanceDate}
              />
            )}
          </section>
        )}

        {tool.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{tool.notes}</p>
          </section>
        )}

        <ToolMaintenanceSection
          toolId={tool.id}
          isMachine={isMachine}
          items={items}
          totalCost={totalCost}
          members={members}
          currentMemberId={ctx.memberId}
          canManage={canManageMaintenance}
        />

        <ToolIssuesSection
          toolId={tool.id}
          issues={issues}
          canReport={canReportIssue}
          canResolve={canResolveIssue}
        />

        <ToolTransfersSection transfers={transfers} />

        {canReadTasks && (
          <TasksSection
            tasks={tasks.map(taskToView)}
            canEdit={canCreateTask}
            currentMemberId={ctx.memberId}
            members={members}
            locked={{ toolId: tool.id }}
          />
        )}

        <ToolDocumentsSection
          toolId={tool.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
