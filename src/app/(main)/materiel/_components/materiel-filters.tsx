'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TOOL_KIND_LABELS, TOOL_KINDS, TOOL_STATUSES, TOOL_STATUS_LABELS } from '@/lib/crm/labels'
import type { DepotOption } from '@/services/crm/depot'
import type { SiteOption } from '@/services/crm/site'

const ALL = '__all__'
// Préfixes pour distinguer dépôt/chantier dans le sélecteur de localisation.
const DEPOT = 'd:'
const SITE = 's:'

interface MaterielFiltersProps {
  depots: DepotOption[]
  sites: SiteOption[]
}

export const MaterielFilters = ({ depots, sites }: MaterielFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const pushParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== ALL) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    pushParam('search', search.trim() || null)
  }

  const currentLocation = searchParams.get('depotId')
    ? `${DEPOT}${searchParams.get('depotId')}`
    : searchParams.get('siteId')
      ? `${SITE}${searchParams.get('siteId')}`
      : ALL

  const onLocationChange = (v: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('depotId')
    params.delete('siteId')
    if (v?.startsWith(DEPOT)) params.set('depotId', v.slice(DEPOT.length))
    else if (v?.startsWith(SITE)) params.set('siteId', v.slice(SITE.length))
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const locationLabel = (value: string): string => {
    if (value === ALL) return 'Toute localisation'
    if (value.startsWith(DEPOT)) return depots.find((d) => d.id === value.slice(DEPOT.length))?.name ?? ''
    if (value.startsWith(SITE)) return sites.find((s) => s.id === value.slice(SITE.length))?.name ?? ''
    return ''
  }

  return (
    <div className='flex flex-col gap-3'>
      <form onSubmit={handleSearch}>
        <Input
          type='search'
          placeholder='Rechercher (nom, marque, n° de série, référence)…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label='Rechercher un matériel'
        />
      </form>
      <div className='flex flex-wrap gap-2'>
        <Select value={searchParams.get('kind') ?? ALL} onValueChange={(v) => pushParam('kind', v)}>
          <SelectTrigger size='sm' className='w-36'>
            <SelectValue>
              {(value) => (value === ALL ? 'Tous types' : (TOOL_KIND_LABELS[value as string] ?? ''))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous types</SelectItem>
            {TOOL_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {TOOL_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('status') ?? ALL}
          onValueChange={(v) => pushParam('status', v)}
        >
          <SelectTrigger size='sm' className='w-40'>
            <SelectValue>
              {(value) =>
                value === ALL ? 'Tous statuts' : (TOOL_STATUS_LABELS[value as string] ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous statuts</SelectItem>
            {TOOL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TOOL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(depots.length > 0 || sites.length > 0) && (
          <Select value={currentLocation} onValueChange={onLocationChange}>
            <SelectTrigger size='sm' className='w-48'>
              <SelectValue>{(value) => locationLabel(value as string)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toute localisation</SelectItem>
              {depots.map((d) => (
                <SelectItem key={d.id} value={`${DEPOT}${d.id}`}>
                  {d.name}
                </SelectItem>
              ))}
              {sites.map((s) => (
                <SelectItem key={s.id} value={`${SITE}${s.id}`}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
