'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TOOL_MAINTENANCE_TYPE_LABELS, formatCost } from '@/lib/crm/labels'
import type { ToolMaintenanceItem } from '@/services/crm/tool-maintenance'
import type { OrgMemberOption } from '@/services/org/members'
import {
  ToolMaintenanceFormDialog,
  type ToolMaintenanceEditView,
} from '../../_components/tool-maintenance-form-dialog'
import { deleteToolMaintenanceAction } from '../../actions'

interface ToolMaintenanceSectionProps {
  toolId: string
  isMachine: boolean
  items: ToolMaintenanceItem[]
  totalCost: number
  members: OrgMemberOption[]
  currentMemberId: string
  canManage: boolean
}

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${d}T00:00:00`)
  )

const formatHours = (h: number | null) =>
  h === null ? null : `${new Intl.NumberFormat('fr-FR').format(h)} h`

export const ToolMaintenanceSection = ({
  toolId,
  isMachine,
  items,
  totalCost,
  members,
  currentMemberId,
  canManage,
}: ToolMaintenanceSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ToolMaintenanceEditView | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (m: ToolMaintenanceItem) => {
    setEditing({
      id: m.id,
      type: m.type,
      performedAt: m.performedAt,
      performedById: m.performedById,
      provider: m.provider,
      hours: m.hours,
      cost: m.cost,
      description: m.description,
      nextDueDate: m.nextDueDate,
      nextDueHours: m.nextDueHours,
    })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    await deleteToolMaintenanceAction(id, toolId)
    setBusyId(null)
    router.refresh()
  }

  const total = formatCost(totalCost)

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <Wrench className='size-4' /> Entretiens ({items.length})
        </h2>
        <div className='flex items-center gap-3'>
          {total && items.length > 0 && (
            <span className='text-sm text-muted-foreground'>Total {total}</span>
          )}
          {canManage && (
            <Button size='sm' variant='outline' onClick={openCreate}>
              <Plus className='size-4' /> Ajouter
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun entretien enregistré.</p>
      ) : (
        <ul className='divide-y'>
          {items.map((m) => {
            const cost = formatCost(m.cost)
            const hours = formatHours(m.hours)
            const nextHours = formatHours(m.nextDueHours)
            return (
              <li key={m.id} className='flex items-start gap-3 px-5 py-3'>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-baseline gap-x-2'>
                    <Badge variant='outline'>
                      {TOOL_MAINTENANCE_TYPE_LABELS[m.type] ?? m.type}
                    </Badge>
                    <span className='text-sm font-medium'>{formatDate(m.performedAt)}</span>
                    {hours && (
                      <span className='inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground'>
                        <Clock className='size-3' /> {hours}
                      </span>
                    )}
                    {cost && <span className='text-sm tabular-nums'>· {cost}</span>}
                  </div>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    {m.provider ?? m.performedByName ?? 'Intervenant non renseigné'}
                    {m.nextDueDate && ` · prochain : ${formatDate(m.nextDueDate)}`}
                    {nextHours && ` · ${nextHours}`}
                  </p>
                  {m.description && (
                    <p className='mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground'>
                      {m.description}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label="Modifier l'entretien"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className='size-4' />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            size='icon-sm'
                            variant='ghost'
                            aria-label="Supprimer l'entretien"
                            disabled={busyId === m.id}
                          />
                        }
                      >
                        <Trash2 className='size-4 text-destructive-foreground' />
                      </AlertDialogTrigger>
                      <AlertDialogPopup>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet entretien ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette intervention sera définitivement archivée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogClose render={<Button variant='outline' />}>
                            Annuler
                          </AlertDialogClose>
                          <AlertDialogClose
                            render={<Button variant='destructive' />}
                            onClick={() => handleDelete(m.id)}
                          >
                            Supprimer
                          </AlertDialogClose>
                        </AlertDialogFooter>
                      </AlertDialogPopup>
                    </AlertDialog>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && (
        <ToolMaintenanceFormDialog
          open={open}
          onOpenChange={setOpen}
          toolId={toolId}
          isMachine={isMachine}
          members={members}
          currentMemberId={currentMemberId}
          maintenance={editing}
        />
      )}
    </section>
  )
}
