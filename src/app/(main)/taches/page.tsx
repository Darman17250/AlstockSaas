import Link from 'next/link'

import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { listDealOptions } from '@/services/crm/deal'
import { listEquipmentOptions } from '@/services/crm/equipment'
import { listSiteOptions } from '@/services/crm/site'
import { listMyTasks, listTeamTasks, type TaskItem } from '@/services/crm/task'
import { listOrgMembers } from '@/services/org/members'
import { taskListParamsSchema } from '@/validation/task'
import { TaskFilters } from './_components/task-filters'
import type { TaskView } from './_components/task-row'
import { TasksCalendar } from './_components/tasks-calendar'
import { TasksView } from './_components/tasks-view'

interface TachesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TABS = [
  { key: 'mine', label: 'Mes tâches' },
  { key: 'team', label: 'Équipe' },
  { key: 'calendar', label: 'Calendrier' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** Sérialise les tâches (Date → ISO) pour les composants client. */
const toView = (t: TaskItem): TaskView => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

export default async function TachesPage({ searchParams }: TachesPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const tab: TabKey = sp.tab === 'team' ? 'team' : sp.tab === 'calendar' ? 'calendar' : 'mine'
  const scope = sp.scope === 'team' ? 'team' : 'mine'
  const canEdit = can(ctx, 'activity', 'create')

  const tabHref = (key: TabKey) => (key === 'mine' ? '/taches' : `/taches?tab=${key}`)

  // Options pour le formulaire (uniquement si l'utilisateur peut éditer).
  const canReadEquipment = can(ctx, 'equipment', 'read')
  const [members, clients, deals, sites, equipments] = canEdit
    ? await Promise.all([
        listOrgMembers(ctx),
        listClientOptions(ctx),
        listDealOptions(ctx),
        listSiteOptions(ctx),
        canReadEquipment ? listEquipmentOptions(ctx) : Promise.resolve([]),
      ])
    : [await listOrgMembers(ctx), [], [], [], []]

  let tasks: TaskItem[]
  if (tab === 'team') {
    tasks = await listTeamTasks(ctx, taskListParamsSchema.parse(sp))
  } else if (tab === 'calendar') {
    tasks =
      scope === 'team'
        ? await listTeamTasks(ctx, taskListParamsSchema.parse(sp))
        : await listMyTasks(ctx)
  } else {
    tasks = await listMyTasks(ctx)
  }

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Tâches</h1>
        <p className='text-muted-foreground'>Activités à faire, rappels et suivi.</p>
      </div>

      <div className='mb-6 flex gap-1 border-b'>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'team' && (
        <div className='mb-4'>
          <TaskFilters members={members} />
        </div>
      )}

      {tab === 'calendar' && (
        <div className='mb-4 flex flex-wrap items-center gap-3'>
          <div className='inline-flex rounded-lg border p-0.5 text-sm'>
            {(['mine', 'team'] as const).map((s) => (
              <Link
                key={s}
                href={`/taches?tab=calendar&scope=${s}`}
                className={`rounded-md px-3 py-1 transition-colors ${
                  scope === s
                    ? 'bg-accent font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'mine' ? 'Mes tâches' : 'Équipe'}
              </Link>
            ))}
          </div>
          {scope === 'team' && (
            <TaskFilters
              members={members}
              preserve={{ tab: 'calendar', scope: 'team' }}
              showStatus={false}
            />
          )}
        </div>
      )}

      {tab === 'calendar' ? (
        <TasksCalendar
          tasks={tasks.map(toView)}
          canEdit={canEdit}
          currentMemberId={ctx.memberId}
          members={members}
          clients={clients}
          deals={deals}
          sites={sites}
          equipments={equipments}
        />
      ) : (
        <TasksView
          mode={tab}
          tasks={tasks.map(toView)}
          canEdit={canEdit}
          currentMemberId={ctx.memberId}
          members={members}
          clients={clients}
          deals={deals}
          sites={sites}
          equipments={equipments}
        />
      )}
    </div>
  )
}
