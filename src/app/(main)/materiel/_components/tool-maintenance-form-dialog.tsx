'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toolMaintenanceTypeEnum } from '@/database/schema'
import { TOOL_MAINTENANCE_TYPE_LABELS } from '@/lib/crm/labels'
import type { OrgMemberOption } from '@/services/org/members'
import { createToolMaintenanceAction, updateToolMaintenanceAction } from '../actions'

const NONE = '__none__'

export interface ToolMaintenanceEditView {
  id: string
  type: string
  performedAt: string
  performedById: string | null
  provider: string | null
  hours: number | null
  cost: string | null
  description: string | null
  nextDueDate: string | null
  nextDueHours: number | null
}

interface ToolMaintenanceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolId: string
  /** Affiche les champs compteur horaire (machines). */
  isMachine: boolean
  members: OrgMemberOption[]
  currentMemberId: string
  maintenance?: ToolMaintenanceEditView | null
}

const today = () => new Date().toISOString().slice(0, 10)

export const ToolMaintenanceFormDialog = ({
  open,
  onOpenChange,
  toolId,
  isMachine,
  members,
  currentMemberId,
  maintenance,
}: ToolMaintenanceFormDialogProps) => {
  const router = useRouter()
  const [type, setType] = useState<string>(maintenance?.type ?? 'controle')
  const [performedById, setPerformedById] = useState<string>(
    maintenance?.performedById ?? currentMemberId ?? NONE
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType(maintenance?.type ?? 'controle')
      setPerformedById(maintenance?.performedById ?? currentMemberId ?? NONE)
      setError(null)
    }
  }, [open, maintenance, currentMemberId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      type,
      performedAt: String(fd.get('performedAt') ?? ''),
      performedById: performedById !== NONE ? performedById : undefined,
      provider: String(fd.get('provider') ?? ''),
      hours: String(fd.get('hours') ?? ''),
      cost: String(fd.get('cost') ?? ''),
      nextDueDate: String(fd.get('nextDueDate') ?? ''),
      nextDueHours: String(fd.get('nextDueHours') ?? ''),
      description: String(fd.get('description') ?? ''),
    }
    const res = maintenance
      ? await updateToolMaintenanceAction(maintenance.id, toolId, payload)
      : await createToolMaintenanceAction({ ...payload, toolId })

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{maintenance ? "Modifier l'entretien" : 'Nouvel entretien'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
          <DialogPanel className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? 'controle')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => TOOL_MAINTENANCE_TYPE_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {toolMaintenanceTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TOOL_MAINTENANCE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='performedAt'>Date</Label>
                <Input
                  id='performedAt'
                  name='performedAt'
                  type='date'
                  defaultValue={maintenance?.performedAt ?? today()}
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label>Réalisé par</Label>
                <Select value={performedById} onValueChange={(v) => setPerformedById(v ?? NONE)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value === NONE
                          ? '— Non renseigné'
                          : (members.find((m) => m.id === value)?.name ?? '')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Non renseigné</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='provider'>Prestataire</Label>
                <Input
                  id='provider'
                  name='provider'
                  defaultValue={maintenance?.provider ?? ''}
                  placeholder='Atelier, SAV…'
                />
              </div>
              {isMachine && (
                <div className='space-y-2'>
                  <Label htmlFor='hours'>Compteur (h)</Label>
                  <Input
                    id='hours'
                    name='hours'
                    type='number'
                    min='0'
                    inputMode='numeric'
                    defaultValue={maintenance?.hours ?? ''}
                  />
                </div>
              )}
              <div className='space-y-2'>
                <Label htmlFor='cost'>Coût (€)</Label>
                <Input
                  id='cost'
                  name='cost'
                  type='number'
                  min='0'
                  step='any'
                  inputMode='decimal'
                  defaultValue={maintenance?.cost ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nextDueDate'>Prochaine échéance (date)</Label>
                <Input
                  id='nextDueDate'
                  name='nextDueDate'
                  type='date'
                  defaultValue={maintenance?.nextDueDate ?? ''}
                />
              </div>
              {isMachine && (
                <div className='space-y-2'>
                  <Label htmlFor='nextDueHours'>Prochaine échéance (h)</Label>
                  <Input
                    id='nextDueHours'
                    name='nextDueHours'
                    type='number'
                    min='0'
                    inputMode='numeric'
                    defaultValue={maintenance?.nextDueHours ?? ''}
                  />
                </div>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='description'>Détails</Label>
              <Textarea
                id='description'
                name='description'
                defaultValue={maintenance?.description ?? ''}
                placeholder='Travaux réalisés, pièces changées…'
              />
            </div>
            {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
            <Button type='submit' disabled={submitting}>
              {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
