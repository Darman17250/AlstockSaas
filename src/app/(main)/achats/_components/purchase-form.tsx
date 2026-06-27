'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

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
import { formatCost } from '@/lib/crm/labels'
import type { ProductOption } from '@/services/crm/product'
import type { SupplierOption } from '@/services/crm/supplier'
import { createPurchaseAction, updatePurchaseAction } from '../actions'

const NONE = '__none__'

interface LineRow {
  key: string
  productId: string
  quantity: string
  unitPrice: string
}

export interface PurchaseFormValues {
  supplierId: string | null
  reference: string | null
  orderDate: string | null
  notes: string | null
  lines: { productId: string; quantity: number; unitPrice: number }[]
}

interface PurchaseFormProps {
  mode: 'create' | 'edit'
  purchaseId?: string
  products: ProductOption[]
  suppliers: SupplierOption[]
  initial?: Partial<PurchaseFormValues>
}

const blankLine = (): LineRow => ({
  key: Math.random().toString(36).slice(2),
  productId: '',
  quantity: '',
  unitPrice: '',
})

export const PurchaseForm = ({
  mode,
  purchaseId,
  products,
  suppliers,
  initial,
}: PurchaseFormProps) => {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? NONE)
  const [lines, setLines] = useState<LineRow[]>(
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          key: Math.random().toString(36).slice(2),
          productId: l.productId,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
        }))
      : [blankLine()]
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const val = (k: keyof PurchaseFormValues) => {
    const v = initial?.[k]
    return v === null || v === undefined || Array.isArray(v) ? '' : String(v)
  }

  const setLine = (key: string, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
    0
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const cleanLines = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
      }))

    if (cleanLines.length === 0) {
      setError('Ajoutez au moins une ligne (produit + quantité)')
      setBusy(false)
      return
    }

    const payload = {
      supplierId: supplierId !== NONE ? supplierId : undefined,
      reference: String(fd.get('reference') ?? ''),
      orderDate: String(fd.get('orderDate') ?? ''),
      notes: String(fd.get('notes') ?? ''),
      lines: cleanLines,
    }

    if (mode === 'create') {
      const res = await createPurchaseAction(payload)
      if (!res.ok) {
        setError(res.error)
        setBusy(false)
        return
      }
      router.push(`/achats/${res.data.id}`)
    } else {
      const res = await updatePurchaseAction(purchaseId as string, payload)
      if (!res.ok) {
        setError(res.error)
        setBusy(false)
        return
      }
      router.push(`/achats/${purchaseId}`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <section className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label>Fournisseur</Label>
          <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? NONE)}>
            <SelectTrigger>
              <SelectValue>
                {(value) =>
                  value === NONE ? '— Aucun' : (suppliers.find((s) => s.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Aucun</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='reference'>Référence</Label>
          <Input
            id='reference'
            name='reference'
            defaultValue={val('reference')}
            placeholder='Ex. BC-2026-014'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='orderDate'>Date de commande</Label>
          <Input id='orderDate' name='orderDate' type='date' defaultValue={val('orderDate')} />
        </div>
      </section>

      <section className='space-y-3 rounded-lg border p-5'>
        <h2 className='text-sm font-semibold text-muted-foreground'>Lignes</h2>
        {products.length === 0 ? (
          <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
            Créez d'abord des produits au catalogue.
          </p>
        ) : (
          <div className='space-y-2'>
            {lines.map((line) => (
              <div key={line.key} className='flex items-end gap-2'>
                <div className='min-w-0 flex-1 space-y-1'>
                  <Label className='text-xs'>Produit</Label>
                  <Select
                    value={line.productId}
                    onValueChange={(v) => setLine(line.key, { productId: v ?? '' })}
                  >
                    <SelectTrigger size='sm'>
                      <SelectValue>
                        {(value) => products.find((p) => p.id === value)?.title ?? 'Produit'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='w-20 space-y-1'>
                  <Label className='text-xs'>Qté</Label>
                  <Input
                    type='number'
                    min='0'
                    step='any'
                    inputMode='decimal'
                    value={line.quantity}
                    onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                  />
                </div>
                <div className='w-24 space-y-1'>
                  <Label className='text-xs'>Prix (€)</Label>
                  <Input
                    type='number'
                    min='0'
                    step='any'
                    inputMode='decimal'
                    value={line.unitPrice}
                    onChange={(e) => setLine(line.key, { unitPrice: e.target.value })}
                  />
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  disabled={lines.length === 1}
                >
                  <X className='size-4' />
                </Button>
              </div>
            ))}
            <div className='flex items-center justify-between'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setLines((prev) => [...prev, blankLine()])}
              >
                <Plus className='size-4' /> Ligne
              </Button>
              <span className='text-sm text-muted-foreground'>
                Total : <span className='font-medium text-foreground'>{formatCost(total)}</span>
              </span>
            </div>
          </div>
        )}
      </section>

      <div className='space-y-2'>
        <Label htmlFor='notes'>Notes</Label>
        <Textarea id='notes' name='notes' defaultValue={val('notes')} />
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex gap-3'>
        <Button type='submit' disabled={busy || products.length === 0}>
          {busy ? (
            <Loader2 className='size-4 animate-spin' />
          ) : mode === 'create' ? (
            "Créer l'achat"
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
