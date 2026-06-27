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
import { fuelLevelEnum } from '@/database/schema'
import {
  FUEL_LEVEL_LABELS,
  MACHINE_CATEGORY_SUGGESTIONS,
  TOOL_CATEGORY_SUGGESTIONS,
  TOOL_KINDS,
  TOOL_KIND_LABELS,
} from '@/lib/crm/labels'
import type { DepotOption } from '@/services/crm/depot'
import type { OrgMemberOption } from '@/services/org/members'
import { createToolAction, updateToolAction } from '../actions'

export interface ToolFormValues {
  kind: string
  name: string
  category: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  reference: string | null
  responsibleId: string | null
  purchaseDate: string | null
  purchaseCost: string | null
  maintenanceFrequencyMonths: number | null
  fuelLevel: string | null
  engineHours: number | null
  notes: string | null
}

interface ToolFormProps {
  mode: 'create' | 'edit'
  toolId?: string
  members: OrgMemberOption[]
  /** Dépôts (localisation initiale, requise à la création uniquement). */
  depots?: DepotOption[]
  initial?: Partial<ToolFormValues>
}

const NONE = '__none__'

export const ToolForm = ({ mode, toolId, members, depots, initial }: ToolFormProps) => {
  const router = useRouter()
  const [kind, setKind] = useState<string>(initial?.kind ?? 'outil')
  const [fuelLevel, setFuelLevel] = useState<string>(initial?.fuelLevel ?? NONE)
  const [responsibleId, setResponsibleId] = useState<string>(initial?.responsibleId ?? NONE)
  const [depotId, setDepotId] = useState<string>(depots?.[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMachine = kind === 'machine'
  const val = (k: keyof ToolFormValues) => {
    const v = initial?.[k]
    return v === null || v === undefined ? '' : String(v)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const base = {
      kind,
      name: String(fd.get('name') ?? ''),
      category: String(fd.get('category') ?? ''),
      brand: String(fd.get('brand') ?? ''),
      model: String(fd.get('model') ?? ''),
      serialNumber: String(fd.get('serialNumber') ?? ''),
      reference: String(fd.get('reference') ?? ''),
      responsibleId: responsibleId !== NONE ? responsibleId : undefined,
      purchaseDate: String(fd.get('purchaseDate') ?? ''),
      purchaseCost: String(fd.get('purchaseCost') ?? ''),
      maintenanceFrequencyMonths: String(fd.get('maintenanceFrequencyMonths') ?? ''),
      fuelLevel: isMachine && fuelLevel !== NONE ? fuelLevel : undefined,
      engineHours: isMachine ? String(fd.get('engineHours') ?? '') : '',
      notes: String(fd.get('notes') ?? ''),
    }

    if (mode === 'create') {
      const res = await createToolAction({ ...base, depotId })
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      router.push(`/materiel/${res.data.id}`)
    } else {
      const res = await updateToolAction(toolId as string, base)
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      router.push(`/materiel/${toolId}`)
    }
    router.refresh()
  }

  const categorySuggestions = isMachine ? MACHINE_CATEGORY_SUGGESTIONS : TOOL_CATEGORY_SUGGESTIONS

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <section className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v ?? 'outil')}>
              <SelectTrigger>
                <SelectValue>{(value) => TOOL_KIND_LABELS[value as string] ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TOOL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {TOOL_KIND_LABELS[k]}
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
              placeholder={
                isMachine ? 'Ex. Nacelle Haulotte Compact 12' : 'Ex. Perceuse Makita HP1631'
              }
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='category'>Catégorie</Label>
            <Input
              id='category'
              name='category'
              defaultValue={val('category')}
              list='tool-category-suggestions'
              placeholder={isMachine ? 'Ex. Nacelle' : 'Ex. Perceuse'}
            />
            <datalist id='tool-category-suggestions'>
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
        </div>

        {mode === 'create' && (
          <div className='space-y-2'>
            <Label>Dépôt initial</Label>
            {depots && depots.length > 0 ? (
              <Select value={depotId} onValueChange={(v) => setDepotId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) => depots.find((d) => d.id === value)?.name ?? 'Sélectionner un dépôt'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {depots.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                Créez d'abord un dépôt pour y ranger ce matériel.
              </p>
            )}
            <p className='text-xs text-muted-foreground'>
              La localisation changera ensuite via les transferts.
            </p>
          </div>
        )}
      </section>

      <section className='space-y-4 rounded-lg border p-5'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Identification</h2>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='brand'>Marque</Label>
            <Input id='brand' name='brand' defaultValue={val('brand')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='model'>Modèle</Label>
            <Input id='model' name='model' defaultValue={val('model')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='serialNumber'>N° de série</Label>
            <Input id='serialNumber' name='serialNumber' defaultValue={val('serialNumber')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='reference'>Référence interne</Label>
            <Input id='reference' name='reference' defaultValue={val('reference')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='purchaseDate'>Date d'achat</Label>
            <Input
              id='purchaseDate'
              name='purchaseDate'
              type='date'
              defaultValue={val('purchaseDate')}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='purchaseCost'>Coût d'achat (€)</Label>
            <Input
              id='purchaseCost'
              name='purchaseCost'
              type='number'
              min='0'
              step='any'
              inputMode='decimal'
              defaultValue={val('purchaseCost')}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='maintenanceFrequencyMonths'>Fréquence d'entretien (mois)</Label>
            <Input
              id='maintenanceFrequencyMonths'
              name='maintenanceFrequencyMonths'
              type='number'
              min='0'
              inputMode='numeric'
              defaultValue={val('maintenanceFrequencyMonths')}
            />
          </div>
        </div>
      </section>

      {isMachine && (
        <section className='space-y-4 rounded-lg border p-5'>
          <h2 className='text-sm font-semibold text-muted-foreground'>Machine</h2>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>Niveau de carburant</Label>
              <Select value={fuelLevel} onValueChange={(v) => setFuelLevel(v ?? NONE)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value === NONE
                        ? '— Non renseigné'
                        : (FUEL_LEVEL_LABELS[value as string] ?? '')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Non renseigné</SelectItem>
                  {fuelLevelEnum.enumValues.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FUEL_LEVEL_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='engineHours'>Compteur horaire (h)</Label>
              <Input
                id='engineHours'
                name='engineHours'
                type='number'
                min='0'
                inputMode='numeric'
                defaultValue={val('engineHours')}
              />
            </div>
          </div>
        </section>
      )}

      <div className='space-y-2'>
        <Label htmlFor='notes'>Notes</Label>
        <Textarea id='notes' name='notes' defaultValue={val('notes')} />
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={submitting || (mode === 'create' && !depotId)}>
          {submitting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            'Créer le matériel'
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
