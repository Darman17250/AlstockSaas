'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLIENT_TYPE_LABELS, RELATION_TYPE_LABELS } from '@/lib/crm/labels'

const ALL = '__all__'

export const ClientsFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

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
          placeholder='Rechercher (nom, email, ville)…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label='Rechercher un client'
        />
      </form>
      <div className='flex gap-3'>
        <Select value={searchParams.get('type') ?? ALL} onValueChange={(v) => pushParam('type', v)}>
          <SelectTrigger size='sm' className='w-40'>
            <Search className='size-4 sm:hidden' />
            <SelectValue>
              {(value) =>
                value === ALL ? 'Tous types' : (CLIENT_TYPE_LABELS[value as string] ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous types</SelectItem>
            <SelectItem value='societe'>{CLIENT_TYPE_LABELS.societe}</SelectItem>
            <SelectItem value='particulier'>{CLIENT_TYPE_LABELS.particulier}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={searchParams.get('relationType') ?? ALL}
          onValueChange={(v) => pushParam('relationType', v)}
        >
          <SelectTrigger size='sm' className='w-40'>
            <SelectValue>
              {(value) =>
                value === ALL ? 'Toutes relations' : (RELATION_TYPE_LABELS[value as string] ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes relations</SelectItem>
            <SelectItem value='client'>{RELATION_TYPE_LABELS.client}</SelectItem>
            <SelectItem value='prestataire'>{RELATION_TYPE_LABELS.prestataire}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
