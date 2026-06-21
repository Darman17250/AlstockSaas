'use client'

import { useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ClientOption } from '@/services/crm/client'
import type { DealOption } from '@/services/crm/deal'
import type { SiteOption } from '@/services/crm/site'
import type { OrgMemberOption } from '@/services/org/members'
import { TaskFormDialog } from './task-form-dialog'
import { TaskRow, type TaskView } from './task-row'

interface TasksCalendarProps {
  tasks: TaskView[]
  canEdit: boolean
  currentMemberId: string
  members: OrgMemberOption[]
  clients: ClientOption[]
  deals: DealOption[]
  sites: SiteOption[]
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
/** Lundi = 0 … Dimanche = 6. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

const formatLongDate = (key: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${key}T00:00:00`))

export const TasksCalendar = ({
  tasks,
  canEdit,
  currentMemberId,
  members,
  clients,
  deals,
  sites,
}: TasksCalendarProps) => {
  const todayKey = keyOf(new Date())
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<string | null>(todayKey)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaskView | null>(null)
  const [createDate, setCreateDate] = useState<string | undefined>(undefined)

  const byDate = useMemo(() => {
    const map = new Map<string, TaskView[]>()
    for (const t of tasks) {
      if (!t.dueDate) continue
      const k = keyOf(new Date(t.dueDate))
      const arr = map.get(k) ?? []
      arr.push(t)
      map.set(k, arr)
    }
    return map
  }, [tasks])

  const cells = useMemo(() => {
    const first = startOfMonth(cursor)
    const start = new Date(first)
    start.setDate(first.getDate() - mondayIndex(first))
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const currentMonth = cursor.getMonth()

  const openCreate = (dateKey?: string) => {
    setEditing(null)
    setCreateDate(dateKey)
    setOpen(true)
  }
  const openEdit = (t: TaskView) => {
    setEditing(t)
    setCreateDate(undefined)
    setOpen(true)
  }

  const selectedTasks = selected ? (byDate.get(selected) ?? []) : []

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='font-semibold capitalize'>{monthLabel}</h2>
        <div className='flex items-center gap-1'>
          <Button
            size='icon-sm'
            variant='outline'
            aria-label='Mois précédent'
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft className='size-4' />
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setCursor(startOfMonth(new Date()))
              setSelected(todayKey)
            }}
          >
            Aujourd'hui
          </Button>
          <Button
            size='icon-sm'
            variant='outline'
            aria-label='Mois suivant'
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className='size-4' />
          </Button>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <div className='grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground'>
          {WEEKDAYS.map((w) => (
            <div key={w} className='py-1.5'>
              {w}
            </div>
          ))}
        </div>
        <div className='grid grid-cols-7'>
          {cells.map((d) => {
            const k = keyOf(d)
            const dayTasks = byDate.get(k) ?? []
            const outside = d.getMonth() !== currentMonth
            const isToday = k === todayKey
            const isSelected = k === selected
            return (
              <button
                key={k}
                type='button'
                onClick={() => setSelected(k)}
                className={`min-h-16 border-r border-b p-1 text-left align-top last:border-r-0 sm:min-h-24 ${
                  outside ? 'bg-muted/30 text-muted-foreground' : ''
                } ${isSelected ? 'ring-2 ring-inset ring-primary' : ''}`}
              >
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-primary font-semibold text-primary-foreground' : ''
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className='mt-0.5 space-y-0.5'>
                  {dayTasks.slice(0, 3).map((t) => {
                    const done = t.status === 'fait'
                    const cancelled = t.status === 'annule'
                    const overdue = !done && !cancelled && k < todayKey
                    return (
                      <span
                        key={t.id}
                        onClick={(e) => {
                          if (!canEdit) return
                          e.stopPropagation()
                          openEdit(t)
                        }}
                        className={`block truncate rounded px-1 text-xs ${
                          done || cancelled
                            ? 'text-muted-foreground line-through'
                            : overdue
                              ? 'bg-destructive/10 text-destructive-foreground'
                              : 'bg-primary/10 text-foreground'
                        }`}
                      >
                        {t.subject}
                      </span>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <span className='block px-1 text-xs text-muted-foreground'>
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <section className='rounded-lg border'>
          <div className='flex items-center justify-between gap-2 border-b px-5 py-3'>
            <h3 className='font-semibold capitalize'>{formatLongDate(selected)}</h3>
            {canEdit && (
              <Button size='sm' variant='outline' onClick={() => openCreate(selected)}>
                <Plus className='size-4' /> Nouvelle
              </Button>
            )}
          </div>
          {selectedTasks.length === 0 ? (
            <div className='flex flex-col items-center gap-3 px-5 py-8 text-center'>
              <p className='text-sm text-muted-foreground'>Aucune tâche ce jour.</p>
              {canEdit && (
                <Button size='sm' variant='ghost' onClick={() => openCreate(selected)}>
                  <CalendarPlus className='size-4' /> Ajouter une tâche
                </Button>
              )}
            </div>
          ) : (
            <ul className='divide-y px-5'>
              {selectedTasks.map((t) => (
                <TaskRow key={t.id} task={t} canEdit={canEdit} onEdit={openEdit} showAssignee />
              ))}
            </ul>
          )}
        </section>
      )}

      {canEdit && (
        <TaskFormDialog
          open={open}
          onOpenChange={setOpen}
          task={editing}
          defaultDueDate={createDate}
          members={members}
          currentMemberId={currentMemberId}
          clients={clients}
          deals={deals}
          sites={sites}
        />
      )}
    </div>
  )
}
