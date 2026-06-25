'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { vehicleFuelTypeEnum } from '@/database/schema'
import { DEPOT_TYPES, DEPOT_TYPE_LABELS, FUEL_TYPE_LABELS } from '@/lib/crm/labels'
import type { OrgMemberOption } from '@/services/org/members'
import { createDepotAction, updateDepotAction } from '../actions'

export interface DepotFormValues {
  type: string
  name: string
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  responsibleId: string | null
  notes: string | null
  registrationNumber: string | null
  brand: string | null
  model: string | null
  year: number | null
  fuelType: string | null
  vin: string | null
  firstRegistrationDate: string | null
  mileage: number | null
}

interface DepotFormProps {
  mode: 'create' | 'edit'
  depotId?: string
  members: OrgMemberOption[]
  initial?: Partial<DepotFormValues>
}

const NONE = '__none__'

export const DepotForm = ({ mode, depotId, members, initial }: DepotFormProps) => {
  const router = useRouter()
  const [type, setType] = useState<string>(initial?.type ?? 'entrepot')
  const [fuelType, setFuelType] = useState<string>(initial?.fuelType ?? NONE)
  const [responsibleId, setResponsibleId] = useState<string>(initial?.responsibleId ?? NONE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVehicle = type === 'vehicule'
  const val = (k: keyof DepotFormValues) => {
    const v = initial?.[k]
    return v === null || v === undefined ? '' : String(v)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      type,
      name: String(fd.get('name') ?? ''),
      addressLine1: String(fd.get('addressLine1') ?? ''),
      addressLine2: String(fd.get('addressLine2') ?? ''),
      postalCode: String(fd.get('postalCode') ?? ''),
      city: String(fd.get('city') ?? ''),
      country: String(fd.get('country') ?? ''),
      responsibleId: responsibleId !== NONE ? responsibleId : undefined,
      notes: String(fd.get('notes') ?? ''),
      registrationNumber: String(fd.get('registrationNumber') ?? ''),
      brand: String(fd.get('brand') ?? ''),
      model: String(fd.get('model') ?? ''),
      year: String(fd.get('year') ?? ''),
      fuelType: fuelType !== NONE ? fuelType : undefined,
      vin: String(fd.get('vin') ?? ''),
      firstRegistrationDate: String(fd.get('firstRegistrationDate') ?? ''),
      mileage: String(fd.get('mileage') ?? ''),
    }

    if (mode === 'create') {
      const res = await createDepotAction(payload)
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      router.push(`/depots/${res.data.id}`)
    } else {
      const res = await updateDepotAction(depotId as string, payload)
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      router.push(`/depots/${depotId}`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <section className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? 'entrepot')}>
              <SelectTrigger>
                <SelectValue>{(value) => DEPOT_TYPE_LABELS[value as string] ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DEPOT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DEPOT_TYPE_LABELS[t]}
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
              defaultValue={val('name')}
              placeholder={isVehicle ? 'Ex. Renault Master - AB-123-CD' : 'Ex. Entrepôt principal'}
              required
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label>Responsable</Label>
          <Select value={responsibleId} onValueChange={(v) => setResponsibleId(v ?? NONE)}>
            <SelectTrigger>
              <SelectValue>
                {(value) =>
                  value === NONE ? '— Aucun' : (members.find((m) => m.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Aucun</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {isVehicle && (
        <section className='space-y-4 rounded-lg border p-5'>
          <h2 className='text-sm font-semibold text-muted-foreground'>Informations véhicule</h2>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='registrationNumber'>Immatriculation</Label>
              <Input
                id='registrationNumber'
                name='registrationNumber'
                defaultValue={val('registrationNumber')}
                placeholder='AB-123-CD'
              />
            </div>
            <div className='space-y-2'>
              <Label>Carburant</Label>
              <Select value={fuelType} onValueChange={(v) => setFuelType(v ?? NONE)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value === NONE ? '— Non renseigné' : (FUEL_TYPE_LABELS[value as string] ?? '')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Non renseigné</SelectItem>
                  {vehicleFuelTypeEnum.enumValues.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FUEL_TYPE_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='brand'>Marque</Label>
              <Input id='brand' name='brand' defaultValue={val('brand')} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='model'>Modèle</Label>
              <Input id='model' name='model' defaultValue={val('model')} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='year'>Année</Label>
              <Input
                id='year'
                name='year'
                type='number'
                min='1900'
                max='2100'
                defaultValue={val('year')}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='mileage'>Kilométrage</Label>
              <Input
                id='mileage'
                name='mileage'
                type='number'
                min='0'
                inputMode='numeric'
                defaultValue={val('mileage')}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='vin'>N° de série (VIN)</Label>
              <Input id='vin' name='vin' defaultValue={val('vin')} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='firstRegistrationDate'>1re mise en circulation</Label>
              <Input
                id='firstRegistrationDate'
                name='firstRegistrationDate'
                type='date'
                defaultValue={val('firstRegistrationDate')}
              />
            </div>
          </div>
        </section>
      )}

      <section className='space-y-4'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Adresse</h2>
        <div className='space-y-2'>
          <Label htmlFor='addressLine1'>Adresse</Label>
          <Input id='addressLine1' name='addressLine1' defaultValue={val('addressLine1')} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='addressLine2'>Complément</Label>
          <Input id='addressLine2' name='addressLine2' defaultValue={val('addressLine2')} />
        </div>
        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='postalCode'>Code postal</Label>
            <Input id='postalCode' name='postalCode' defaultValue={val('postalCode')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='city'>Ville</Label>
            <Input id='city' name='city' defaultValue={val('city')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='country'>Pays</Label>
            <Input id='country' name='country' defaultValue={initial?.country ?? 'FR'} />
          </div>
        </div>
      </section>

      <div className='space-y-2'>
        <Label htmlFor='notes'>Notes</Label>
        <Textarea id='notes' name='notes' defaultValue={val('notes')} />
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={submitting}>
          {submitting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            'Créer le dépôt'
          ) : (
            'Enregistrer'
          )}
        </Button>
        <Button type='button' variant='outline' onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
