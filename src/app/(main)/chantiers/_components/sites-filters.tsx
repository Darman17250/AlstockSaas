'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SITE_STATUSES, SITE_STATUS_LABELS } from '@/lib/crm/labels'
import type { ClientOption } from '@/services/crm/client'

const ALL = '__all__'

interface SitesFiltersProps {
  clients: ClientOption[]
}

type ClientItem = { value: string; label: string }

export const SitesFilters = ({ clients }: SitesFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const clientItems: ClientItem[] = clients.map((c) => ({ value: c.id, label: c.name }))
  const selectedClient =
    clientItems.find((i) => i.value === searchParams.get('clientId')) ?? null

  const pushParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== ALL) params.set(key, value)
    else params.delete(key)
    params.delete('page') // tout changement de filtre revient à la 1re page
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    pushParam('search', search.trim() || null)
  }

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
      <form onSubmit={handleSearch} className='flex-1'>
        <Input
          type='search'
          placeholder='Rechercher (nom, référence, ville)…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label='Rechercher un chantier'
        />
      </form>
      <div className='flex gap-3'>
        <Select
          value={searchParams.get('status') ?? ALL}
          onValueChange={(v) => pushParam('status', v)}
        >
          <SelectTrigger size='sm' className='w-40'>
            <SelectValue>
              {(value) =>
                value === ALL ? 'Tous statuts' : (SITE_STATUS_LABELS[value as string] ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous statuts</SelectItem>
            {SITE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SITE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Combobox
          items={clientItems}
          value={selectedClient}
          onValueChange={(item: ClientItem | null) => pushParam('clientId', item?.value ?? null)}
          isItemEqualToValue={(a, b) => a?.value === b?.value}
        >
          <ComboboxInput placeholder='Tous clients' className='w-44' />
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
    </div>
  )
}
