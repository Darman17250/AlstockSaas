'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ClientOption } from '@/services/crm/client'
import type { DealOption } from '@/services/crm/deal'
import type { EquipmentOption } from '@/services/crm/equipment'
import type { SiteOption } from '@/services/crm/site'
import type { OrgMemberOption } from '@/services/org/members'
import { TaskFormDialog } from './task-form-dialog'
import { TaskRow, type TaskView } from './task-row'

interface TasksViewProps {
  mode: 'mine' | 'team'
  tasks: TaskView[]
  canEdit: boolean
  currentMemberId: string
  members: OrgMemberOption[]
  clients: ClientOption[]
  deals: DealOption[]
  sites: SiteOption[]
  equipments: EquipmentOption[]
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

interface Group {
  key: string
  title: string
  tasks: TaskView[]
}

/** Répartit « Mes tâches » par échéance ; les autres vues en une seule liste. */
const groupMine = (tasks: TaskView[]): Group[] => {
  const today = startOfToday()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todo = tasks.filter((t) => t.status === 'a_faire')
  const overdue = todo.filter((t) => t.dueDate && new Date(t.dueDate) < today)
  const dueToday = todo.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow
  )
  const upcoming = todo.filter((t) => t.dueDate && new Date(t.dueDate) >= tomorrow)
  const noDate = todo.filter((t) => !t.dueDate)
  const done = tasks.filter((t) => t.status === 'fait')

  return [
    { key: 'overdue', title: 'En retard', tasks: overdue },
    { key: 'today', title: "Aujourd'hui", tasks: dueToday },
    { key: 'upcoming', title: 'À venir', tasks: upcoming },
    { key: 'nodate', title: 'Sans échéance', tasks: noDate },
    { key: 'done', title: 'Terminées', tasks: done },
  ].filter((g) => g.tasks.length > 0)
}

export const TasksView = ({
  mode,
  tasks,
  canEdit,
  currentMemberId,
  members,
  clients,
  deals,
  sites,
  equipments,
}: TasksViewProps) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaskView | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (t: TaskView) => {
    setEditing(t)
    setOpen(true)
  }

  const groups = mode === 'mine' ? groupMine(tasks) : [{ key: 'all', title: '', tasks }]

  return (
    <div>
      {canEdit && (
        <div className='mb-4 flex justify-end'>
          <Button size='sm' onClick={openCreate}>
            <Plus className='size-4' /> Nouvelle tâche
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className='rounded-lg border p-6 text-center text-sm text-muted-foreground'>
          Aucune tâche.
        </p>
      ) : (
        <div className='space-y-6'>
          {groups.map((g) => (
            <section key={g.key}>
              {g.title && (
                <h2 className='mb-1 text-sm font-semibold text-muted-foreground'>
                  {g.title} ({g.tasks.length})
                </h2>
              )}
              <ul className='divide-y rounded-lg border px-4'>
                {g.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    canEdit={canEdit}
                    onEdit={openEdit}
                    showAssignee={mode === 'team'}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <TaskFormDialog
          open={open}
          onOpenChange={setOpen}
          task={editing}
          members={members}
          currentMemberId={currentMemberId}
          clients={clients}
          deals={deals}
          sites={sites}
          equipments={equipments}
        />
      )}
    </div>
  )
}
