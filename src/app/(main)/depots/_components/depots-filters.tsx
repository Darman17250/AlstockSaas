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
import { DEPOT_TYPES, DEPOT_TYPE_LABELS } from '@/lib/crm/labels'

const ALL = '__all__'

export const DepotsFilters = () => {
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

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
      <form onSubmit={handleSearch} className='flex-1'>
        <Input
          type='search'
          placeholder='Rechercher (nom, ville, immatriculation)…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label='Rechercher un dépôt'
        />
      </form>
      <Select value={searchParams.get('type') ?? ALL} onValueChange={(v) => pushParam('type', v)}>
        <SelectTrigger size='sm' className='w-40'>
          <SelectValue>
            {(value) => (value === ALL ? 'Tous types' : (DEPOT_TYPE_LABELS[value as string] ?? ''))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tous types</SelectItem>
          {DEPOT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {DEPOT_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
