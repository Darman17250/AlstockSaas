'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from '@/components/ui/combobox'
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
import { SITE_STATUSES, SITE_STATUS_LABELS } from '@/lib/crm/labels'
import type { ClientOption } from '@/services/crm/client'
import type { OrgMemberOption } from '@/services/org/members'
import { createSiteAction, updateSiteAction } from '../actions'

export interface SiteFormValues {
  name: string
  clientId: string
  reference: string | null
  status: string
  addressLine1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  startDate: string | null
  endDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  conducteurId: string | null
  description: string | null
}

interface SiteFormProps {
  mode: 'create' | 'edit'
  siteId?: string
  clients: ClientOption[]
  members: OrgMemberOption[]
  initial?: Partial<SiteFormValues>
}

const NONE = '__none__'
type ClientItem = { value: string; label: string }

export const SiteForm = ({ mode, siteId, clients, members, initial }: SiteFormProps) => {
  const router = useRouter()
  const clientItems: ClientItem[] = clients.map((c) => ({ value: c.id, label: c.name }))

  const [clientId, setClientId] = useState<string | null>(initial?.clientId ?? null)
  const [status, setStatus] = useState<string>(initial?.status ?? 'prepa')
  const [conducteurId, setConducteurId] = useState<string>(initial?.conducteurId ?? NONE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedClient = clientItems.find((i) => i.value === clientId) ?? null
  const val = (k: keyof SiteFormValues) => (initial?.[k] as string | null) ?? ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!clientId) {
      setError('Sélectionnez un client.')
      return
    }
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') ?? ''),
      clientId,
      reference: String(fd.get('reference') ?? ''),
      status,
      addressLine1: String(fd.get('addressLine1') ?? ''),
      postalCode: String(fd.get('postalCode') ?? ''),
      city: String(fd.get('city') ?? ''),
      country: String(fd.get('country') ?? ''),
      startDate: String(fd.get('startDate') ?? ''),
      endDate: String(fd.get('endDate') ?? ''),
      actualStartDate: String(fd.get('actualStartDate') ?? ''),
      actualEndDate: String(fd.get('actualEndDate') ?? ''),
      conducteurId: conducteurId !== NONE ? conducteurId : undefined,
      description: String(fd.get('description') ?? ''),
    }

    const res =
      mode === 'create'
        ? await createSiteAction(payload)
        : await updateSiteAction(siteId as string, payload)

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    const id = mode === 'create' ? res.data.id : (siteId as string)
    router.push(`/chantiers/${id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <section className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='name'>Nom du chantier</Label>
          <Input id='name' name='name' defaultValue={val('name')} required />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Client</Label>
            <Combobox
              items={clientItems}
              value={selectedClient}
              onValueChange={(item: ClientItem | null) => setClientId(item?.value ?? null)}
              isItemEqualToValue={(a, b) => a?.value === b?.value}
            >
              <ComboboxInput placeholder='Rechercher un client…' />
              <ComboboxPopup>
                <ComboboxEmpty>Aucun client trouvé.</ComboboxEmpty>
                <ComboboxList>
                  {(item: ClientItem) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxPopup>
            </Combobox>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reference'>Référence</Label>
            <Input id='reference' name='reference' defaultValue={val('reference')} />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? 'prepa')}>
              <SelectTrigger>
                <SelectValue>{(value) => SITE_STATUS_LABELS[value as string] ?? ''}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SITE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SITE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Conducteur de travaux</Label>
            <Select value={conducteurId} onValueChange={(v) => setConducteurId(v ?? NONE)}>
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
      </section>

      <section className='space-y-4'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Lieu du chantier</h2>
        <div className='space-y-2'>
          <Label htmlFor='addressLine1'>Adresse</Label>
          <Input id='addressLine1' name='addressLine1' defaultValue={val('addressLine1')} />
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

      <section className='space-y-4'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Planning</h2>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='startDate'>Début planifié</Label>
            <Input id='startDate' name='startDate' type='date' defaultValue={val('startDate')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='endDate'>Fin planifiée</Label>
            <Input id='endDate' name='endDate' type='date' defaultValue={val('endDate')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='actualStartDate'>Début réel</Label>
            <Input
              id='actualStartDate'
              name='actualStartDate'
              type='date'
              defaultValue={val('actualStartDate')}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='actualEndDate'>Fin réelle</Label>
            <Input
              id='actualEndDate'
              name='actualEndDate'
              type='date'
              defaultValue={val('actualEndDate')}
            />
          </div>
        </div>
      </section>

      <div className='space-y-2'>
        <Label htmlFor='description'>Description</Label>
        <Textarea id='description' name='description' defaultValue={val('description')} />
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={submitting}>
          {submitting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            'Créer le chantier'
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
