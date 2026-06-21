'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'

/** Recherche par intitulé (onglets Gagnées / Perdues). Conserve l'onglet courant. */
export const DealFilters = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const value = search.trim()
    if (value) params.set('search', value)
    else params.delete('search')
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSearch}>
      <Input
        type='search'
        placeholder='Rechercher une affaire…'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label='Rechercher une affaire'
      />
    </form>
  )
}
