'use client'

import { useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { OrgMemberOption } from '@/services/org/members'
import { TaskFormDialog } from './task-form-dialog'
import { TaskRow, type TaskView } from './task-row'

interface TasksSectionProps {
  tasks: TaskView[]
  canEdit: boolean
  currentMemberId: string
  members: OrgMemberOption[]
  /** Liaison imposée par le contexte (fiche affaire/client/chantier/équipement/dépôt). */
  locked: {
    clientId?: string
    dealId?: string
    siteId?: string
    equipmentId?: string
    depotId?: string
  }
}

/** Section « Tâches » réutilisable sur les fiches (affaire, client). */
export const TasksSection = ({
  tasks,
  canEdit,
  currentMemberId,
  members,
  locked,
}: TasksSectionProps) => {
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

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <ListChecks className='size-4' /> Tâches ({tasks.length})
        </h2>
        {canEdit && (
          <Button size='sm' variant='outline' onClick={openCreate}>
            <Plus className='size-4' /> Ajouter
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucune tâche.</p>
      ) : (
        <ul className='divide-y px-5'>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} canEdit={canEdit} onEdit={openEdit} showAssignee />
          ))}
        </ul>
      )}

      {canEdit && (
        <TaskFormDialog
          open={open}
          onOpenChange={setOpen}
          task={editing}
          members={members}
          currentMemberId={currentMemberId}
          locked={locked}
        />
      )}
    </section>
  )
}
