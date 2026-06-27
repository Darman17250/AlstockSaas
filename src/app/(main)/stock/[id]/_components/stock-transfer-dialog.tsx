'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
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
import { formatQuantity } from '@/lib/crm/labels'
import type { DepotOption } from '@/services/crm/depot'
import type { SiteOption } from '@/services/crm/site'
import type { ProductDistributionItem } from '@/services/crm/stock'
import type { StockTransferDirection } from '@/validation/stock-transfer'
import { createStockTransferAction } from '../../actions'

interface StockTransferDialogProps {
  productId: string
  unit: string
  depots: DepotOption[]
  sites: SiteOption[]
  distribution: ProductDistributionItem[]
}

const DIRECTIONS: { value: StockTransferDirection; label: string }[] = [
  { value: 'depot_depot', label: 'Dépôt → Dépôt' },
  { value: 'depot_site', label: 'Dépôt → Chantier' },
  { value: 'site_depot', label: 'Retour chantier → Dépôt' },
]

export const StockTransferDialog = ({
  productId,
  unit,
  depots,
  sites,
  distribution,
}: StockTransferDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<StockTransferDirection>('depot_depot')
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceIsDepot = direction !== 'site_depot'
  const destIsDepot = direction !== 'depot_site'

  // Sources possibles = localisations où le produit a du stock (> 0), du bon type.
  const availableByLocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of distribution) map.set(`${d.locationType}:${d.locationId}`, d.quantity)
    return map
  }, [distribution])

  const sourceOptions = useMemo(() => {
    const type = sourceIsDepot ? 'depot' : 'site'
    return distribution.filter((d) => d.locationType === type)
  }, [distribution, sourceIsDepot])

  const destOptions = useMemo(() => {
    if (destIsDepot) return depots.filter((d) => d.id !== sourceId)
    return sites
  }, [destIsDepot, depots, sites, sourceId])

  const available = availableByLocation.get(`${sourceIsDepot ? 'depot' : 'site'}:${sourceId}`) ?? 0

  const reset = () => {
    setDirection('depot_depot')
    setSourceId('')
    setDestinationId('')
    setQuantity('')
    setNote('')
    setError(null)
  }

  const onDirectionChange = (v: string | null) => {
    setDirection((v as StockTransferDirection) ?? 'depot_depot')
    setSourceId('')
    setDestinationId('')
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const qty = Number(quantity)
    if (qty > available) {
      setError(`Stock insuffisant (${formatQuantity(available, unit)} disponible)`)
      setBusy(false)
      return
    }
    const res = await createStockTransferAction(productId, {
      direction,
      sourceId,
      destinationId,
      quantity: qty,
      note,
    })
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    setBusy(false)
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger render={<Button variant='outline' size='sm' />}>
        <ArrowLeftRight className='size-4' /> Transférer
      </DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Transférer du stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit}>
          <DialogPanel className='space-y-4'>
            <div className='space-y-2'>
              <Label>Sens du transfert</Label>
              <Select value={direction} onValueChange={onDirectionChange}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) => DIRECTIONS.find((d) => d.value === value)?.label ?? ''}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Source ({sourceIsDepot ? 'dépôt' : 'chantier'})</Label>
              {sourceOptions.length === 0 ? (
                <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                  Aucun stock dans {sourceIsDepot ? 'un dépôt' : 'un chantier'} pour ce produit.
                </p>
              ) : (
                <Select value={sourceId} onValueChange={(v) => setSourceId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        sourceOptions.find((s) => s.locationId === value)?.locationName ??
                        'Sélectionner'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((s) => (
                      <SelectItem key={s.locationId} value={s.locationId}>
                        {s.locationName} — {formatQuantity(s.quantity, unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className='space-y-2'>
              <Label>Destination ({destIsDepot ? 'dépôt' : 'chantier'})</Label>
              <Select value={destinationId} onValueChange={(v) => setDestinationId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) => destOptions.find((d) => d.id === value)?.name ?? 'Sélectionner'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='transfer-qty'>Quantité</Label>
              <Input
                id='transfer-qty'
                type='number'
                min='0'
                step='any'
                inputMode='decimal'
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              {sourceId && (
                <p className='text-xs text-muted-foreground'>
                  Disponible : {formatQuantity(available, unit)}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='transfer-note'>Note (optionnel)</Label>
              <Input id='transfer-note' value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
            <Button
              type='submit'
              disabled={busy || !sourceId || !destinationId || !(Number(quantity) > 0)}
            >
              {busy ? <Loader2 className='size-4 animate-spin' /> : 'Transférer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
