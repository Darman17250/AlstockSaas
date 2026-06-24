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
import { MAINTENANCE_TYPE_LABELS } from '@/lib/crm/labels'
import { maintenanceTypeEnum } from '@/database/schema'
import type { OrgMemberOption } from '@/services/org/members'
import { createMaintenanceAction, updateMaintenanceAction } from '../actions'

const NONE = '__none__'

export interface MaintenanceEditView {
  id: string
  type: string
  performedAt: string
  performedById: string | null
  cost: string | null
  description: string | null
  nextDueDate: string | null
}

interface MaintenanceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  members: OrgMemberOption[]
  currentMemberId: string
  maintenance?: MaintenanceEditView | null
}

const today = () => new Date().toISOString().slice(0, 10)

export const MaintenanceFormDialog = ({
  open,
  onOpenChange,
  equipmentId,
  members,
  currentMemberId,
  maintenance,
}: MaintenanceFormDialogProps) => {
  const router = useRouter()
  const [type, setType] = useState<string>(maintenance?.type ?? 'entretien')
  const [performedById, setPerformedById] = useState<string>(
    maintenance?.performedById ?? currentMemberId ?? NONE
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType(maintenance?.type ?? 'entretien')
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
      cost: String(fd.get('cost') ?? ''),
      nextDueDate: String(fd.get('nextDueDate') ?? ''),
      description: String(fd.get('description') ?? ''),
    }
    const res = maintenance
      ? await updateMaintenanceAction(maintenance.id, equipmentId, payload)
      : await createMaintenanceAction({ ...payload, equipmentId })

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
                <Select value={type} onValueChange={(v) => setType(v ?? 'entretien')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => MAINTENANCE_TYPE_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>
                        {MAINTENANCE_TYPE_LABELS[t]}
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
                <Label htmlFor='nextDueDate'>Prochain entretien prévu</Label>
                <Input
                  id='nextDueDate'
                  name='nextDueDate'
                  type='date'
                  defaultValue={maintenance?.nextDueDate ?? ''}
                />
              </div>
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
