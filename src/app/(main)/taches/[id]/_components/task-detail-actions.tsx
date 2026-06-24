'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { ClientOption } from '@/services/crm/client'
import type { DealOption } from '@/services/crm/deal'
import type { EquipmentOption } from '@/services/crm/equipment'
import type { SiteOption } from '@/services/crm/site'
import type { OrgMemberOption } from '@/services/org/members'
import { deleteTaskAction } from '../../actions'
import { TaskFormDialog } from '../../_components/task-form-dialog'
import type { TaskView } from '../../_components/task-row'

interface TaskDetailActionsProps {
  task: TaskView
  members: OrgMemberOption[]
  clients: ClientOption[]
  deals: DealOption[]
  sites: SiteOption[]
  equipments: EquipmentOption[]
  currentMemberId: string
  canEdit: boolean
  canDelete: boolean
}

export const TaskDetailActions = ({
  task,
  members,
  clients,
  deals,
  sites,
  equipments,
  currentMemberId,
  canEdit,
  canDelete,
}: TaskDetailActionsProps) => {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteTaskAction(task.id)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.push('/taches')
    router.refresh()
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {canEdit && (
        <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
          <Pencil className='size-4' /> Modifier
        </Button>
      )}
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant='destructive-outline' size='sm' disabled={busy} />}
          >
            <Trash2 className='size-4' /> Supprimer
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {task.subject} » sera définitivement supprimée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant='outline' />}>Annuler</AlertDialogClose>
              <AlertDialogClose render={<Button variant='destructive' />} onClick={handleDelete}>
                Supprimer
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      )}

      {canEdit && (
        <TaskFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          members={members}
          currentMemberId={currentMemberId}
          clients={clients}
          deals={deals}
          sites={sites}
          equipments={equipments}
          task={task}
        />
      )}
    </div>
  )
}
