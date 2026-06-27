'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Plus, X } from 'lucide-react'

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
import { PRODUCT_UNITS, PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import type { DepotOption } from '@/services/crm/depot'
import { createProductAction, updateProductAction } from '../actions'

export interface CategoryTreeOption {
  id: string
  name: string
  subcategories: { id: string; name: string }[]
}

export interface ProductFormValues {
  title: string
  categoryId: string
  subcategoryId: string
  unit: string
  description: string | null
  initialPurchasePrice: string | null
  alertThreshold: string | null
}

interface ProductFormProps {
  mode: 'create' | 'edit'
  productId?: string
  categories: CategoryTreeOption[]
  depots: DepotOption[]
  storageConfigured: boolean
  hasImage?: boolean
  initial?: Partial<ProductFormValues>
}

interface StockLine {
  key: string
  depotId: string
  quantity: string
}

const newLine = (depotId: string): StockLine => ({
  key: Math.random().toString(36).slice(2),
  depotId,
  quantity: '',
})

export const ProductForm = ({
  mode,
  productId,
  categories,
  depots,
  storageConfigured,
  hasImage,
  initial,
}: ProductFormProps) => {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'u')
  const [stockLines, setStockLines] = useState<StockLine[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subcategories = useMemo(
    () => categories.find((c) => c.id === categoryId)?.subcategories ?? [],
    [categories, categoryId]
  )

  const val = (k: keyof ProductFormValues) => {
    const v = initial?.[k]
    return v === null || v === undefined ? '' : String(v)
  }

  const onCategoryChange = (v: string | null) => {
    setCategoryId(v ?? '')
    setSubcategoryId('') // réinitialiser : la sous-catégorie dépend de la catégorie
  }

  const onPickImage = (file: File | null) => {
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  const uploadImage = async (id: string): Promise<boolean> => {
    if (!imageFile) return true
    const fd = new FormData()
    fd.append('file', imageFile)
    const res = await fetch(`/api/stock/${id}/image`, { method: 'POST', body: fd })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? "Échec de l'envoi de l'image")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const base = {
      title: String(fd.get('title') ?? ''),
      categoryId,
      subcategoryId,
      unit,
      description: String(fd.get('description') ?? ''),
      alertThreshold: String(fd.get('alertThreshold') ?? ''),
    }

    if (mode === 'create') {
      const initialStock = stockLines
        .filter((l) => l.depotId && Number(l.quantity) > 0)
        .map((l) => ({ depotId: l.depotId, quantity: Number(l.quantity) }))
      const res = await createProductAction({
        ...base,
        initialPurchasePrice: String(fd.get('initialPurchasePrice') ?? ''),
        initialStock,
      })
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      const ok = await uploadImage(res.data.id)
      if (!ok) {
        setSubmitting(false)
        return
      }
      router.push(`/stock/${res.data.id}`)
    } else {
      const res = await updateProductAction(productId as string, base)
      if (!res.ok) {
        setError(res.error)
        setSubmitting(false)
        return
      }
      const ok = await uploadImage(productId as string)
      if (!ok) {
        setSubmitting(false)
        return
      }
      router.push(`/stock/${productId}`)
    }
    router.refresh()
  }

  const noCategory = categories.length === 0

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {noCategory && (
        <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
          Créez d'abord au moins une catégorie et une sous-catégorie dans l'espace{' '}
          <a href='/stock/categories' className='underline'>
            Catégories
          </a>
          .
        </p>
      )}

      <section className='space-y-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start'>
          {/* Image */}
          <div className='space-y-2'>
            <Label>Image</Label>
            <button
              type='button'
              onClick={() => fileRef.current?.click()}
              disabled={!storageConfigured}
              className='flex size-28 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50'
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt='' className='size-full object-cover' />
              ) : mode === 'edit' && hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/stock/${productId}/image`}
                  alt=''
                  className='size-full object-cover'
                />
              ) : (
                <ImagePlus className='size-6' />
              )}
            </button>
            <input
              ref={fileRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
            {!storageConfigured && (
              <p className='max-w-28 text-xs text-muted-foreground'>Stockage non configuré.</p>
            )}
          </div>

          <div className='grid flex-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2 sm:col-span-2'>
              <Label htmlFor='title'>Titre</Label>
              <Input
                id='title'
                name='title'
                defaultValue={val('title')}
                placeholder='Ex. Vis à bois 4×40 inox'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label>Catégorie</Label>
              <Select value={categoryId} onValueChange={onCategoryChange}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) => categories.find((c) => c.id === value)?.name ?? 'Sélectionner'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Sous-catégorie</Label>
              <Select
                value={subcategoryId}
                onValueChange={(v) => setSubcategoryId(v ?? '')}
                disabled={!categoryId || subcategories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      subcategories.find((s) => s.id === value)?.name ??
                      (categoryId ? 'Sélectionner' : '—')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label>Unité</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v ?? 'u')}>
                <SelectTrigger>
                  <SelectValue>{(value) => PRODUCT_UNIT_LABELS[value as string] ?? ''}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {PRODUCT_UNIT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='description'>Description</Label>
            <Textarea id='description' name='description' defaultValue={val('description')} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='alertThreshold'>Seuil d'alerte (stock bas)</Label>
            <Input
              id='alertThreshold'
              name='alertThreshold'
              type='number'
              min='0'
              step='any'
              inputMode='decimal'
              defaultValue={val('alertThreshold')}
              placeholder='Ex. 10'
            />
            <p className='text-xs text-muted-foreground'>
              Alerte quand le stock global (dépôts) descend à ce niveau. Vide = aucune alerte.
            </p>
          </div>
        </div>
      </section>

      {mode === 'create' && (
        <section className='space-y-4 rounded-lg border p-5'>
          <div>
            <h2 className='text-sm font-semibold text-muted-foreground'>Stock initial</h2>
            <p className='text-xs text-muted-foreground'>
              Optionnel. Répartissez la quantité de départ sur un ou plusieurs dépôts.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='initialPurchasePrice'>Prix d'achat unitaire (€)</Label>
            <Input
              id='initialPurchasePrice'
              name='initialPurchasePrice'
              type='number'
              min='0'
              step='any'
              inputMode='decimal'
              className='sm:max-w-48'
              placeholder='0,00'
            />
          </div>

          {depots.length === 0 ? (
            <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
              Aucun dépôt : créez un dépôt pour y placer du stock initial.
            </p>
          ) : (
            <div className='space-y-2'>
              {stockLines.map((line) => (
                <div key={line.key} className='flex items-end gap-2'>
                  <div className='flex-1 space-y-1'>
                    <Label className='text-xs'>Dépôt</Label>
                    <Select
                      value={line.depotId}
                      onValueChange={(v) =>
                        setStockLines((prev) =>
                          prev.map((l) => (l.key === line.key ? { ...l, depotId: v ?? '' } : l))
                        )
                      }
                    >
                      <SelectTrigger size='sm'>
                        <SelectValue>
                          {(value) => depots.find((d) => d.id === value)?.name ?? 'Dépôt'}
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
                  </div>
                  <div className='w-28 space-y-1'>
                    <Label className='text-xs'>Quantité</Label>
                    <Input
                      type='number'
                      min='0'
                      step='any'
                      inputMode='decimal'
                      value={line.quantity}
                      onChange={(e) =>
                        setStockLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, quantity: e.target.value } : l
                          )
                        )
                      }
                    />
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => setStockLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <X className='size-4' />
                  </Button>
                </div>
              ))}
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setStockLines((prev) => [...prev, newLine(depots[0].id)])}
              >
                <Plus className='size-4' /> Ajouter un dépôt
              </Button>
            </div>
          )}
        </section>
      )}

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={submitting || noCategory || !categoryId || !subcategoryId}>
          {submitting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            'Créer le produit'
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
