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
import { EQUIPMENT_CATEGORY_SUGGESTIONS, EQUIPMENT_STATUS_LABELS } from '@/lib/crm/labels'
import { equipmentStatusEnum } from '@/database/schema'
import { createEquipmentAction, updateEquipmentAction } from '../actions'

export interface EquipmentEditView {
  id: string
  locationId: string
  name: string
  category: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  installDate: string | null
  status: string
  maintenanceFrequencyMonths: number | null
  nextMaintenanceDate: string | null
  notes: string | null
}

interface EquipmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  locations: { id: string; name: string }[]
  defaultLocationId?: string
  equipment?: EquipmentEditView | null
}

export const EquipmentFormDialog = ({
  open,
  onOpenChange,
  clientId,
  locations,
  defaultLocationId,
  equipment,
}: EquipmentFormDialogProps) => {
  const router = useRouter()
  const [locationId, setLocationId] = useState<string>(
    equipment?.locationId ?? defaultLocationId ?? locations[0]?.id ?? ''
  )
  const [status, setStatus] = useState<string>(equipment?.status ?? 'en_service')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLocationId(equipment?.locationId ?? defaultLocationId ?? locations[0]?.id ?? '')
      setStatus(equipment?.status ?? 'en_service')
      setError(null)
    }
  }, [open, equipment, defaultLocationId, locations])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!locationId) {
      setError('Sélectionnez une localisation.')
      return
    }
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      locationId,
      name: String(fd.get('name') ?? ''),
      category: String(fd.get('category') ?? ''),
      brand: String(fd.get('brand') ?? ''),
      model: String(fd.get('model') ?? ''),
      serialNumber: String(fd.get('serialNumber') ?? ''),
      installDate: String(fd.get('installDate') ?? ''),
      status,
      maintenanceFrequencyMonths: String(fd.get('maintenanceFrequencyMonths') ?? ''),
      nextMaintenanceDate: String(fd.get('nextMaintenanceDate') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    }
    const res = equipment
      ? await updateEquipmentAction(equipment.id, clientId, payload)
      : await createEquipmentAction(clientId, payload)

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
          <DialogTitle>{equipment ? "Modifier l'équipement" : 'Nouvel équipement'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogPanel className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Nom</Label>
                <Input
                  id='name'
                  name='name'
                  defaultValue={equipment?.name ?? ''}
                  placeholder='Ex. Chaudière salon'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='category'>Catégorie</Label>
                <Input
                  id='category'
                  name='category'
                  list='equipment-categories'
                  defaultValue={equipment?.category ?? ''}
                  placeholder='Chaudière, Poêle à bois…'
                />
                <datalist id='equipment-categories'>
                  {EQUIPMENT_CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className='space-y-2'>
                <Label>Localisation</Label>
                <Select value={locationId} onValueChange={(v) => setLocationId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => locations.find((l) => l.id === value)?.name ?? '—'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? 'en_service')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => EQUIPMENT_STATUS_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentStatusEnum.enumValues.map((s) => (
                      <SelectItem key={s} value={s}>
                        {EQUIPMENT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='brand'>Marque</Label>
                <Input id='brand' name='brand' defaultValue={equipment?.brand ?? ''} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='model'>Modèle</Label>
                <Input id='model' name='model' defaultValue={equipment?.model ?? ''} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='serialNumber'>N° de série</Label>
                <Input
                  id='serialNumber'
                  name='serialNumber'
                  defaultValue={equipment?.serialNumber ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='installDate'>Date d'installation</Label>
                <Input
                  id='installDate'
                  name='installDate'
                  type='date'
                  defaultValue={equipment?.installDate ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='maintenanceFrequencyMonths'>Fréquence d'entretien (mois)</Label>
                <Input
                  id='maintenanceFrequencyMonths'
                  name='maintenanceFrequencyMonths'
                  type='number'
                  min='1'
                  max='120'
                  defaultValue={equipment?.maintenanceFrequencyMonths ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nextMaintenanceDate'>Prochain entretien</Label>
                <Input
                  id='nextMaintenanceDate'
                  name='nextMaintenanceDate'
                  type='date'
                  defaultValue={equipment?.nextMaintenanceDate ?? ''}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='notes'>Notes</Label>
              <Textarea id='notes' name='notes' defaultValue={equipment?.notes ?? ''} />
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
