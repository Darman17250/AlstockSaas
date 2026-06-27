'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryTreeOption } from './product-form'

const ALL = '__all__'

interface ProductFiltersProps {
  categories: CategoryTreeOption[]
}

export const ProductFilters = ({ categories }: ProductFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const categoryId = searchParams.get('categoryId') ?? ALL
  const subcategories = useMemo(
    () => categories.find((c) => c.id === categoryId)?.subcategories ?? [],
    [categories, categoryId]
  )

  const pushParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== ALL) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const onCategoryChange = (v: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v && v !== ALL) params.set('categoryId', v)
    else params.delete('categoryId')
    params.delete('subcategoryId') // dépend de la catégorie
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    pushParam('search', search.trim() || null)
  }

  return (
    <div className='flex flex-col gap-3'>
      <form onSubmit={handleSearch}>
        <Input
          type='search'
          placeholder='Rechercher un produit…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label='Rechercher un produit'
        />
      </form>
      <div className='flex flex-wrap gap-2'>
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger size='sm' className='w-44'>
            <SelectValue>
              {(value) =>
                value === ALL
                  ? 'Toutes catégories'
                  : (categories.find((c) => c.id === value)?.name ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categoryId !== ALL && subcategories.length > 0 && (
          <Select
            value={searchParams.get('subcategoryId') ?? ALL}
            onValueChange={(v) => pushParam('subcategoryId', v)}
          >
            <SelectTrigger size='sm' className='w-44'>
              <SelectValue>
                {(value) =>
                  value === ALL
                    ? 'Toutes sous-catégories'
                    : (subcategories.find((s) => s.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes sous-catégories</SelectItem>
              {subcategories.map((s) => (
                <SelectItem key={s.id} value={s.id}>
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
