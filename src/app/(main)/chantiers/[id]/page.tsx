import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  ChevronLeft,
  HardHat,
  Hash,
  MapPin,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { SITE_STATUS_LABELS } from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getSite } from '@/services/crm/site'
import { listSiteDocuments } from '@/services/crm/site-document'
import { listSiteMessages } from '@/services/crm/site-message'
import { listSiteTeam } from '@/services/crm/site-member'
import { listSiteReports } from '@/services/crm/site-report'
import { listTasksForSite, type TaskItem } from '@/services/crm/task'
import { getLocationStockValue, listStockForLocation } from '@/services/crm/stock'
import { listToolsForSite } from '@/services/crm/tool'
import { listOrgMembers } from '@/services/org/members'
import { LocationStockSection } from '../../stock/_components/location-stock-section'
import { ToolsPresentSection } from '../../materiel/_components/tools-present-section'
import { TasksSection } from '../../taches/_components/tasks-section'
import { DocumentsSection } from './_components/documents-section'
import { SiteActions } from './_components/site-actions'
import { SiteChat } from './_components/site-chat'
import { SiteReportsSection } from './_components/site-reports-section'
import { SiteStats } from './_components/site-stats'
import { SiteTeamSection } from './_components/site-team-section'

const taskToView = (t: TaskItem) => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

interface SitePageProps {
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

const statusVariant = (status: string): 'default' | 'secondary' | 'outline' =>
  status === 'en_cours' ? 'default' : status === 'termine' ? 'secondary' : 'outline'

export default async function SitePage({ params }: SitePageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let data: Awaited<ReturnType<typeof getSite>>
  try {
    data = await getSite(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx, 'site', 'update')
  const canDelete = can(ctx, 'site', 'delete')
  const documents = await listSiteDocuments(ctx, id)
  const team = await listSiteTeam(ctx, id)
  const messages = await listSiteMessages(ctx, id)
  const canReadReports = can(ctx, 'report', 'read')
  const reports = canReadReports ? await listSiteReports(ctx, id) : []
  const storageConfigured = isStorageConfigured()
  const canReadTasks = can(ctx, 'activity', 'read')
  const canEditTasks = can(ctx, 'activity', 'create')
  const tasks = canReadTasks ? await listTasksForSite(ctx, id) : []
  const canReadTools = can(ctx, 'tool', 'read')
  const canTransferTools = can(ctx, 'toolTransfer', 'create')
  const toolsPresent = canReadTools ? await listToolsForSite(ctx, id) : []
  const canReadStock = can(ctx, 'product', 'read')
  const stockLoc = { depotId: null, siteId: id }
  const [stockItems, stockValue] = canReadStock
    ? await Promise.all([listStockForLocation(ctx, stockLoc), getLocationStockValue(ctx, stockLoc)])
    : [[], 0]
  // Liste des membres org partagée par l'équipe, les tâches et les mentions du chat.
  const orgMembers = await listOrgMembers(ctx)
  const taskMembers = canEditTasks ? orgMembers : []
  const teamMembers = canEdit ? orgMembers : []

  // Vues sérialisables pour le chat (dates en ISO).
  const chatMessages = messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
  const chatMembers = orgMembers.map((m) => ({ id: m.id, name: m.name }))
  const chatTasks = tasks.map((t) => ({ id: t.id, subject: t.subject }))

  const addressParts = [data.addressLine1, [data.postalCode, data.city].filter(Boolean).join(' ')]
    .filter((p) => p?.trim())
    .join(', ')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/chantiers' />}>
        <ChevronLeft className='size-4' /> Chantiers
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <HardHat className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{data.name}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant={statusVariant(data.status)}>
                {SITE_STATUS_LABELS[data.status] ?? data.status}
              </Badge>
              {data.reference && (
                <Badge variant='outline'>
                  <Hash className='size-3' /> {data.reference}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <SiteActions siteId={data.id} name={data.name} canEdit={canEdit} canDelete={canDelete} />
      </div>

      <div className='space-y-6'>
        <SiteStats
          tasksTotal={tasks.length}
          tasksDone={tasks.filter((t) => t.status === 'fait').length}
          messagesCount={messages.length}
          documentsCount={documents.length}
          teamCount={team.length}
          reportsCount={reports.length}
        />

        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          <Line icon={Building2}>
            <Link href={`/clients/${data.clientId}`} className='hover:underline'>
              {data.clientName}
            </Link>
          </Line>
          {data.conducteurName && <Line icon={User}>Conducteur : {data.conducteurName}</Line>}
          {addressParts && <Line icon={MapPin}>{addressParts}</Line>}
          {(data.startDate || data.endDate) && (
            <Line icon={Calendar}>
              Planifié : {dateLabel(data.startDate) ?? '—'} → {dateLabel(data.endDate) ?? '—'}
            </Line>
          )}
          {(data.actualStartDate || data.actualEndDate) && (
            <Line icon={CalendarCheck}>
              Réel : {dateLabel(data.actualStartDate) ?? '—'} →{' '}
              {dateLabel(data.actualEndDate) ?? '—'}
            </Line>
          )}
          {data.dealId && (
            <Line icon={Briefcase}>
              <Link href={`/affaires/${data.dealId}`} className='hover:underline'>
                Affaire d'origine{data.dealTitle ? ` : ${data.dealTitle}` : ''}
              </Link>
            </Line>
          )}
        </section>

        {data.description && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Description</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{data.description}</p>
          </section>
        )}

        {canReadReports && (
          <SiteReportsSection
            siteId={data.id}
            reports={reports}
            canCreate={can(ctx, 'report', 'create')}
            canUpdate={can(ctx, 'report', 'update')}
            canDelete={can(ctx, 'report', 'delete')}
            storageConfigured={storageConfigured}
          />
        )}

        <SiteTeamSection siteId={data.id} team={team} members={teamMembers} canEdit={canEdit} />

        {canReadTools && (
          <ToolsPresentSection items={toolsPresent} canTransfer={canTransferTools} />
        )}

        {canReadStock && <LocationStockSection items={stockItems} totalValue={stockValue} />}

        <SiteChat
          siteId={data.id}
          initialMessages={chatMessages}
          members={chatMembers}
          tasks={chatTasks}
          canManageAll={canEdit}
        />

        {canReadTasks && (
          <TasksSection
            tasks={tasks.map(taskToView)}
            canEdit={canEditTasks}
            currentMemberId={ctx.memberId}
            members={taskMembers}
            locked={{ siteId: data.id, clientId: data.clientId }}
          />
        )}

        <DocumentsSection
          siteId={data.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
