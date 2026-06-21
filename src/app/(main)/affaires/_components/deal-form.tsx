'use client'

import { useEffect, useState } from 'react'
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
import { DEAL_SOURCE_LABELS, DEAL_STAGE_LABELS, DEAL_STAGES } from '@/lib/crm/labels'
import type { ClientOption } from '@/services/crm/client'
import type { ContactOption } from '@/services/crm/contact'
import { dealSourceEnum } from '@/database/schema'
import type { OrgMemberOption } from '@/services/org/members'
import { clientContactsAction, createDealAction, updateDealAction } from '../actions'

export interface DealFormValues {
  title: string
  clientId: string
  primaryContactId: string | null
  stage: string
  estimatedAmount: string | null
  probability: string | null
  expectedCloseDate: string | null
  source: string | null
  ownerId: string | null
  notes: string | null
}

interface DealFormProps {
  mode: 'create' | 'edit'
  dealId?: string
  clients: ClientOption[]
  owners: OrgMemberOption[]
  initial?: Partial<DealFormValues>
  /** Contacts déjà connus (édition) pour pré-remplir le sélecteur. */
  initialContacts?: ContactOption[]
}

const NONE = '__none__'
type ClientItem = { value: string; label: string }

const contactLabel = (c: ContactOption) => [c.firstName, c.lastName].filter(Boolean).join(' ')

export const DealForm = ({
  mode,
  dealId,
  clients,
  owners,
  initial,
  initialContacts = [],
}: DealFormProps) => {
  const router = useRouter()
  const clientItems: ClientItem[] = clients.map((c) => ({ value: c.id, label: c.name }))

  const [clientId, setClientId] = useState<string | null>(initial?.clientId ?? null)
  const [contacts, setContacts] = useState<ContactOption[]>(initialContacts)
  const [contactId, setContactId] = useState<string>(initial?.primaryContactId ?? NONE)
  const [stage, setStage] = useState<string>(initial?.stage ?? 'nouveau')
  const [source, setSource] = useState<string>(initial?.source ?? NONE)
  const [ownerId, setOwnerId] = useState<string>(initial?.ownerId ?? NONE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedClient = clientItems.find((i) => i.value === clientId) ?? null
  const val = (k: keyof DealFormValues) => (initial?.[k] as string | null) ?? ''

  // Charge les interlocuteurs du client sélectionné.
  useEffect(() => {
    if (!clientId) {
      setContacts([])
      return
    }
    let active = true
    clientContactsAction(clientId).then((res) => {
      if (active && res.ok) setContacts(res.data)
    })
    return () => {
      active = false
    }
  }, [clientId])

  const handleClientChange = (item: ClientItem | null) => {
    const next = item?.value ?? null
    setClientId(next)
    if (next !== clientId) setContactId(NONE) // un contact appartient à un seul client
  }

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
      title: String(fd.get('title') ?? ''),
      clientId,
      primaryContactId: contactId !== NONE ? contactId : undefined,
      stage,
      estimatedAmount: String(fd.get('estimatedAmount') ?? ''),
      probability: String(fd.get('probability') ?? ''),
      expectedCloseDate: String(fd.get('expectedCloseDate') ?? ''),
      source: source !== NONE ? source : undefined,
      ownerId: ownerId !== NONE ? ownerId : undefined,
      notes: String(fd.get('notes') ?? ''),
    }

    const res =
      mode === 'create'
        ? await createDealAction(payload)
        : await updateDealAction(dealId as string, payload)

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    const id = mode === 'create' ? res.data.id : (dealId as string)
    router.push(`/affaires/${id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <section className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='title'>Intitulé</Label>
          <Input id='title' name='title' defaultValue={val('title')} required />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>Client</Label>
            <Combobox
              items={clientItems}
              value={selectedClient}
              onValueChange={handleClientChange}
              isItemEqualToValue={(a, b) => a.value === b.value}
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
            <Label>Interlocuteur</Label>
            <Select
              value={contactId}
              onValueChange={(v) => setContactId(v ?? NONE)}
              disabled={!clientId || contacts.length === 0}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) =>
                    value === NONE
                      ? '— Aucun'
                      : (() => {
                          const c = contacts.find((x) => x.id === value)
                          return c ? contactLabel(c) : '—'
                        })()
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Aucun</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {contactLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label>Étape</Label>
          <Select value={stage} onValueChange={(v) => setStage(v ?? 'nouveau')}>
            <SelectTrigger>
              <SelectValue>{(value) => DEAL_STAGE_LABELS[value as string] ?? ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DEAL_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DEAL_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label>Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v ?? NONE)}>
            <SelectTrigger>
              <SelectValue>
                {(value) =>
                  value === NONE ? '— Aucune' : (DEAL_SOURCE_LABELS[value as string] ?? '—')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Aucune</SelectItem>
              {dealSourceEnum.enumValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {DEAL_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='estimatedAmount'>Montant estimé (€)</Label>
          <Input
            id='estimatedAmount'
            name='estimatedAmount'
            type='number'
            min='0'
            step='any'
            inputMode='decimal'
            defaultValue={val('estimatedAmount')}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='probability'>Probabilité (%)</Label>
          <Input
            id='probability'
            name='probability'
            type='number'
            min='0'
            max='100'
            inputMode='numeric'
            defaultValue={val('probability')}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='expectedCloseDate'>Date de clôture prévue</Label>
          <Input
            id='expectedCloseDate'
            name='expectedCloseDate'
            type='date'
            defaultValue={val('expectedCloseDate')}
          />
        </div>
        <div className='space-y-2'>
          <Label>Commercial</Label>
          <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? NONE)}>
            <SelectTrigger>
              <SelectValue>
                {(value) =>
                  value === NONE ? '— Aucun' : (owners.find((o) => o.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Aucun</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            "Créer l'affaire"
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
