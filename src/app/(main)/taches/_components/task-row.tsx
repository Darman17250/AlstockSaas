'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Briefcase, Building2, HardHat, Package, Pencil, Trash2, User } from 'lucide-react'

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
import { Checkbox } from '@/components/ui/checkbox'
import { deleteTaskAction, setTaskStatusAction } from '../actions'

export interface TaskView {
  id: string
  subject: string
  description: string | null
  dueDate: string | null
  status: string
  assigneeId: string | null
  assigneeName: string | null
  clientId: string | null
  clientName: string | null
  dealId: string | null
  dealTitle: string | null
  siteId: string | null
  siteName: string | null
  equipmentId: string | null
  equipmentName: string | null
  coAssignees: { id: string; name: string }[]
}

interface TaskRowProps {
  task: TaskView
  canEdit: boolean
  onEdit: (task: TaskView) => void
  /** Affiche l'assigné (utile dans la vue Équipe). */
  showAssignee?: boolean
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const formatDue = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso))

export const TaskRow = ({ task, canEdit, onEdit, showAssignee }: TaskRowProps) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const done = task.status === 'fait'
  const cancelled = task.status === 'annule'
  const overdue =
    !done && !cancelled && task.dueDate !== null && new Date(task.dueDate) < startOfToday()

  const toggle = async (checked: boolean) => {
    setBusy(true)
    await setTaskStatusAction(task.id, { status: checked ? 'fait' : 'a_faire' })
    setBusy(false)
    router.refresh()
  }

  const remove = async () => {
    setBusy(true)
    await deleteTaskAction(task.id)
    setBusy(false)
    router.refresh()
  }

  return (
    <li className='flex items-start gap-3 py-2'>
      <Checkbox
        checked={done}
        disabled={!canEdit || busy || cancelled}
        onCheckedChange={(v) => toggle(v === true)}
        className='mt-0.5'
        aria-label={done ? 'Marquer à faire' : 'Marquer fait'}
      />
      <div className='min-w-0 flex-1'>
        <Link
          href={`/taches/${task.id}`}
          className={`text-sm font-medium hover:underline ${done || cancelled ? 'text-muted-foreground line-through' : ''}`}
        >
          {task.subject}
        </Link>
        <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
          {task.dueDate && (
            <span className={overdue ? 'font-medium text-destructive-foreground' : ''}>
              {overdue ? 'En retard · ' : ''}
              {formatDue(task.dueDate)}
            </span>
          )}
          {cancelled && <span>Annulé</span>}
          {showAssignee && (task.assigneeName || task.coAssignees.length > 0) && (
            <span className='inline-flex items-center gap-1'>
              <User className='size-3' /> {task.assigneeName ?? task.coAssignees[0]?.name}
              {task.coAssignees.length > 0 && (
                <span className='text-muted-foreground'>
                  +{task.assigneeName ? task.coAssignees.length : task.coAssignees.length - 1}
                </span>
              )}
            </span>
          )}
          {task.dealId && task.dealTitle && (
            <Link
              href={`/affaires/${task.dealId}`}
              className='inline-flex items-center gap-1 hover:underline'
            >
              <Briefcase className='size-3' /> {task.dealTitle}
            </Link>
          )}
          {task.clientId && task.clientName && (
            <Link
              href={`/clients/${task.clientId}`}
              className='inline-flex items-center gap-1 hover:underline'
            >
              <Building2 className='size-3' /> {task.clientName}
            </Link>
          )}
          {task.siteName && (
            <span className='inline-flex items-center gap-1'>
              <HardHat className='size-3' /> {task.siteName}
            </span>
          )}
          {task.equipmentId && task.equipmentName && (
            <Link
              href={`/equipements/${task.equipmentId}`}
              className='inline-flex items-center gap-1 hover:underline'
            >
              <Package className='size-3' /> {task.equipmentName}
            </Link>
          )}
        </div>
        {task.description && (
          <p className='mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground'>
            {task.description}
          </p>
        )}
      </div>
      {canEdit && (
        <div className='flex shrink-0 gap-1'>
          <Button
            size='icon-sm'
            variant='ghost'
            aria-label='Modifier la tâche'
            onClick={() => onEdit(task)}
          >
            <Pencil className='size-4' />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label='Supprimer la tâche'
                  disabled={busy}
                />
              }
            >
              <Trash2 className='size-4 text-destructive-foreground' />
            </AlertDialogTrigger>
            <AlertDialogPopup>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                <AlertDialogDescription>
                  « {task.subject} » sera définitivement supprimée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant='outline' />}>Annuler</AlertDialogClose>
                <AlertDialogClose render={<Button variant='destructive' />} onClick={remove}>
                  Supprimer
                </AlertDialogClose>
              </AlertDialogFooter>
            </AlertDialogPopup>
          </AlertDialog>
        </div>
      )}
    </li>
  )
}
