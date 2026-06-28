'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Package, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import type { DepotOption } from '@/services/crm/depot'
import type { LibraryBrowseItem } from '@/services/crm/library'
import { addLibraryProductAction } from '../actions'

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

interface LibraryBrowserProps {
  items: LibraryBrowseItem[]
  depots: DepotOption[]
  canAdd: boolean
}

export const LibraryBrowser = ({ items, depots, canAdd }: LibraryBrowserProps) => {
  const router = useRouter()
  const [active, setActive] = useState<LibraryBrowseItem | null>(null)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [alertThreshold, setAlertThreshold] = useState('')
  const [stockLines, setStockLines] = useState<StockLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const openDialog = (item: LibraryBrowseItem) => {
    setActive(item)
    setPurchasePrice('')
    setAlertThreshold('')
    setStockLines([])
    setError(null)
  }

  const closeDialog = () => {
    if (submitting) return
    setActive(null)
  }

  const handleAdd = async () => {
    if (!active) return
    setSubmitting(true)
    setError(null)
    const initialStock = stockLines
      .filter((l) => l.depotId && Number(l.quantity) > 0)
      .map((l) => ({ depotId: l.depotId, quantity: Number(l.quantity) }))
    const res = await addLibraryProductAction({
      libraryProductId: active.id,
      initialPurchasePrice: purchasePrice,
      alertThreshold,
      initialStock,
    })
    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setAddedIds((prev) => new Set(prev).add(active.id))
    setSubmitting(false)
    setActive(null)
    router.refresh()
  }

  return (
    <>
      <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {items.map((p) => {
          const added = addedIds.has(p.id)
          return (
            <li key={p.id} className='flex flex-col rounded-lg border p-3'>
              <div className='flex gap-3'>
                <div className='flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground'>
                  {p.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/biblio/${p.id}/image`}
                      alt=''
                      loading='lazy'
                      className='size-full object-cover'
                    />
                  ) : (
                    <Package className='size-6' />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium leading-snug'>{p.title}</p>
                  <div className='mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground'>
                    {p.categoryName && <span>{p.categoryName}</span>}
                    {p.subcategoryName && <span>· {p.subcategoryName}</span>}
                  </div>
                </div>
              </div>
              {p.description && (
                <p className='mt-2 line-clamp-2 text-xs text-muted-foreground'>{p.description}</p>
              )}
              <div className='mt-3 flex items-center justify-between gap-2'>
                <span className='text-xs text-muted-foreground'>
                  {PRODUCT_UNIT_LABELS[p.unit] ?? p.unit}
                </span>
                {canAdd &&
                  (added ? (
                    <Button size='sm' variant='outline' disabled>
                      <Check className='size-4' /> Ajouté
                    </Button>
                  ) : (
                    <Button size='sm' variant='outline' onClick={() => openDialog(p)}>
                      <Plus className='size-4' /> Ajouter
                    </Button>
                  ))}
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={active !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter à mes produits</DialogTitle>
            <DialogDescription>{active?.title}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <p className='rounded-md bg-muted p-3 text-xs text-muted-foreground'>
              Le produit est copié dans votre stock. Sa catégorie et sa sous-catégorie sont créées
              dans votre organisation si elles n'existent pas déjà.
            </p>

            <div className='space-y-2'>
              <Label htmlFor='lib-price'>Prix d'achat unitaire (€)</Label>
              <Input
                id='lib-price'
                type='number'
                min='0'
                step='any'
                inputMode='decimal'
                className='sm:max-w-48'
                placeholder='0,00'
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='lib-threshold'>Seuil d'alerte (stock bas)</Label>
              <Input
                id='lib-threshold'
                type='number'
                min='0'
                step='any'
                inputMode='decimal'
                className='sm:max-w-48'
                placeholder='Ex. 10'
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label className='text-xs text-muted-foreground'>Stock initial (optionnel)</Label>
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
                        onClick={() =>
                          setStockLines((prev) => prev.filter((l) => l.key !== line.key))
                        }
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
            </div>

            {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={closeDialog} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Ajouter au stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
