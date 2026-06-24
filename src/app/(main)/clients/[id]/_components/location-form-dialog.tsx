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
import { LOCATION_TYPE_LABELS } from '@/lib/crm/labels'
import { locationTypeEnum } from '@/database/schema'
import { createLocationAction, updateLocationAction } from '../../../equipements/actions'

export interface LocationView {
  id: string
  type: string
  name: string
  addressLine1: string | null
  postalCode: string | null
  city: string | null
  notes: string | null
}

interface LocationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  location?: LocationView | null
}

export const LocationFormDialog = ({
  open,
  onOpenChange,
  clientId,
  location,
}: LocationFormDialogProps) => {
  const router = useRouter()
  const [type, setType] = useState<string>(location?.type ?? 'maison')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType(location?.type ?? 'maison')
      setError(null)
    }
  }, [open, location])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      type,
      name: String(fd.get('name') ?? ''),
      addressLine1: String(fd.get('addressLine1') ?? ''),
      addressLine2: String(fd.get('addressLine2') ?? ''),
      postalCode: String(fd.get('postalCode') ?? ''),
      city: String(fd.get('city') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    }
    const res = location
      ? await updateLocationAction(location.id, clientId, payload)
      : await createLocationAction({ ...payload, clientId })

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
          <DialogTitle>
            {location ? 'Modifier la localisation' : 'Nouvelle localisation'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
          <DialogPanel className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? 'maison')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => LOCATION_TYPE_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locationTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LOCATION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='name'>Nom</Label>
                <Input
                  id='name'
                  name='name'
                  defaultValue={location?.name ?? ''}
                  placeholder='Ex. Maison principale'
                  required
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='addressLine1'>Adresse</Label>
              <Input
                id='addressLine1'
                name='addressLine1'
                defaultValue={location?.addressLine1 ?? ''}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='addressLine2'>Complément d'adresse</Label>
              <Input id='addressLine2' name='addressLine2' defaultValue='' />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='postalCode'>Code postal</Label>
                <Input
                  id='postalCode'
                  name='postalCode'
                  defaultValue={location?.postalCode ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='city'>Ville</Label>
                <Input id='city' name='city' defaultValue={location?.city ?? ''} />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='notes'>Notes</Label>
              <Textarea id='notes' name='notes' defaultValue={location?.notes ?? ''} />
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
