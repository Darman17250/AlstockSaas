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
import { CIVILITY_LABELS, CLIENT_TYPE_LABELS, RELATION_TYPE_LABELS } from '@/lib/crm/labels'
import type { OrgMemberOption } from '@/services/org/members'
import { createClientAction, updateClientAction } from '../actions'

type ClientType = 'societe' | 'particulier'
type RelationType = 'client' | 'prestataire'
type Civility = 'monsieur' | 'madame'

export interface ClientFormValues {
  type: ClientType
  relationType: RelationType
  name: string
  civility: Civility | null
  siret: string | null
  sector: string | null
  email: string | null
  phone: string | null
  website: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  ownerId: string | null
  notes: string | null
}

interface ClientFormProps {
  mode: 'create' | 'edit'
  clientId?: string
  owners: OrgMemberOption[]
  initial?: Partial<ClientFormValues>
}

const NONE = '__none__'

export const ClientForm = ({ mode, clientId, owners, initial }: ClientFormProps) => {
  const router = useRouter()
  const [type, setType] = useState<ClientType>(initial?.type ?? 'societe')
  const [relationType, setRelationType] = useState<RelationType>(initial?.relationType ?? 'client')
  const [civility, setCivility] = useState<string>(initial?.civility ?? NONE)
  const [ownerId, setOwnerId] = useState<string>(initial?.ownerId ?? NONE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const val = (k: keyof ClientFormValues) => (initial?.[k] as string | null) ?? ''

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      type,
      relationType,
      name: String(fd.get('name') ?? ''),
      civility: type === 'particulier' && civility !== NONE ? civility : undefined,
      siret: type === 'societe' ? String(fd.get('siret') ?? '') : undefined,
      sector: String(fd.get('sector') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      website: String(fd.get('website') ?? ''),
      addressLine1: String(fd.get('addressLine1') ?? ''),
      addressLine2: String(fd.get('addressLine2') ?? ''),
      postalCode: String(fd.get('postalCode') ?? ''),
      city: String(fd.get('city') ?? ''),
      country: String(fd.get('country') ?? '') || 'FR',
      ownerId: ownerId !== NONE ? ownerId : undefined,
      notes: String(fd.get('notes') ?? ''),
    }

    const res =
      mode === 'create'
        ? await createClientAction(payload)
        : await updateClientAction(clientId as string, payload)

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    const id = mode === 'create' ? res.data.id : (clientId as string)
    router.push(`/clients/${id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* Nature du client */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ClientType)}>
            <SelectTrigger>
              <SelectValue>{(value) => CLIENT_TYPE_LABELS[value as string] ?? ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='societe'>{CLIENT_TYPE_LABELS.societe}</SelectItem>
              <SelectItem value='particulier'>{CLIENT_TYPE_LABELS.particulier}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label>Relation</Label>
          <Select value={relationType} onValueChange={(v) => setRelationType(v as RelationType)}>
            <SelectTrigger>
              <SelectValue>{(value) => RELATION_TYPE_LABELS[value as string] ?? ''}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='client'>{RELATION_TYPE_LABELS.client}</SelectItem>
              <SelectItem value='prestataire'>{RELATION_TYPE_LABELS.prestataire}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Identité */}
      <section className='space-y-4'>
        {type === 'particulier' && (
          <div className='space-y-2 sm:max-w-xs'>
            <Label>Civilité</Label>
            <Select value={civility} onValueChange={(v) => setCivility(v ?? NONE)}>
              <SelectTrigger>
                <SelectValue>
                  {(value) => (value === NONE ? '—' : (CIVILITY_LABELS[value as string] ?? '—'))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                <SelectItem value='monsieur'>{CIVILITY_LABELS.monsieur}</SelectItem>
                <SelectItem value='madame'>{CIVILITY_LABELS.madame}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className='space-y-2'>
          <Label htmlFor='name'>{type === 'societe' ? 'Raison sociale' : 'Nom complet'}</Label>
          <Input id='name' name='name' defaultValue={val('name')} required />
        </div>

        {type === 'societe' && (
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='siret'>SIRET</Label>
              <Input id='siret' name='siret' defaultValue={val('siret')} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='sector'>Secteur / corps de métier</Label>
              <Input id='sector' name='sector' defaultValue={val('sector')} />
            </div>
          </div>
        )}
        {type === 'particulier' && (
          <div className='space-y-2'>
            <Label htmlFor='sector'>Secteur / corps de métier</Label>
            <Input id='sector' name='sector' defaultValue={val('sector')} />
          </div>
        )}
      </section>

      {/* Coordonnées */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' name='email' type='email' defaultValue={val('email')} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='phone'>Téléphone</Label>
          <Input id='phone' name='phone' defaultValue={val('phone')} />
        </div>
        <div className='space-y-2 sm:col-span-2'>
          <Label htmlFor='website'>Site web</Label>
          <Input id='website' name='website' defaultValue={val('website')} />
        </div>
      </section>

      {/* Adresse */}
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2 sm:col-span-2'>
          <Label htmlFor='addressLine1'>Adresse</Label>
          <Input id='addressLine1' name='addressLine1' defaultValue={val('addressLine1')} />
        </div>
        <div className='space-y-2 sm:col-span-2'>
          <Label htmlFor='addressLine2'>Complément d'adresse</Label>
          <Input id='addressLine2' name='addressLine2' defaultValue={val('addressLine2')} />
        </div>
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
      </section>

      {/* Suivi */}
      <section className='space-y-4'>
        <div className='space-y-2 sm:max-w-sm'>
          <Label>Commercial en charge</Label>
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
        <div className='space-y-2'>
          <Label htmlFor='notes'>Notes</Label>
          <Textarea id='notes' name='notes' defaultValue={val('notes')} />
        </div>
      </section>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={submitting}>
          {submitting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            'Créer le client'
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
