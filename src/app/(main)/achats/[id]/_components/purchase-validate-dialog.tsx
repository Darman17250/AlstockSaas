'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

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
import type { PurchaseLineDetail } from '@/services/crm/purchase'
import type { SiteOption } from '@/services/crm/site'
import { validatePurchaseAction } from '../../actions'

const DEPOT = 'd:'
const SITE = 's:'

interface PurchaseValidateDialogProps {
  purchaseId: string
  lines: PurchaseLineDetail[]
  depots: DepotOption[]
  sites: SiteOption[]
}

export const PurchaseValidateDialog = ({
  purchaseId,
  lines,
  depots,
  sites,
}: PurchaseValidateDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dest, setDest] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allChosen = lines.every((l) => dest[l.id])

  const labelFor = (value: string): string => {
    if (value.startsWith(DEPOT)) return depots.find((d) => d.id === value.slice(2))?.name ?? ''
    if (value.startsWith(SITE)) return sites.find((s) => s.id === value.slice(2))?.name ?? ''
    return 'Sélectionner'
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const destinations = lines.map((l) => {
      const v = dest[l.id]
      return {
        lineId: l.id,
        destinationKind: v.startsWith(DEPOT) ? ('depot' as const) : ('site' as const),
        destinationId: v.slice(2),
      }
    })
    const res = await validatePurchaseAction(purchaseId, { destinations })
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    setBusy(false)
    setOpen(false)
    router.refresh()
  }

  const noDestinations = depots.length === 0 && sites.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm' />}>
        <CheckCircle2 className='size-4' /> Valider la réception
      </DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Valider la réception</DialogTitle>
        </DialogHeader>
        <DialogPanel className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            Choisissez la destination (dépôt ou chantier) de chaque ligne. Le stock sera incrémenté
            et le prix moyen pondéré recalculé. Action définitive.
          </p>
          {noDestinations ? (
            <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
              Créez d'abord un dépôt ou un chantier pour réceptionner le stock.
            </p>
          ) : (
            <ul className='space-y-3'>
              {lines.map((l) => (
                <li key={l.id} className='space-y-1'>
                  <Label>
                    {l.productTitle} — {formatQuantity(l.quantity, l.unit)}
                  </Label>
                  <Select
                    value={dest[l.id] ?? ''}
                    onValueChange={(v) => setDest((prev) => ({ ...prev, [l.id]: v ?? '' }))}
                  >
                    <SelectTrigger size='sm'>
                      <SelectValue>{(value) => labelFor(value as string)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {depots.map((d) => (
                        <SelectItem key={`d-${d.id}`} value={`${DEPOT}${d.id}`}>
                          Dépôt · {d.name}
                        </SelectItem>
                      ))}
                      {sites.map((s) => (
                        <SelectItem key={`s-${s.id}`} value={`${SITE}${s.id}`}>
                          Chantier · {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
          {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
          <Button onClick={submit} disabled={busy || noDestinations || !allChosen}>
            {busy ? <Loader2 className='size-4 animate-spin' /> : 'Réceptionner'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
