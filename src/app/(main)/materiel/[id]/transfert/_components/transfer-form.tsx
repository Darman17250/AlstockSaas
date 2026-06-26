'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HardHat, Loader2, Warehouse } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DepotOption } from '@/services/crm/depot'
import type { SiteOption } from '@/services/crm/site'
import { createTransferAction } from '../../../actions'

interface TransferFormProps {
  toolId: string
  depots: DepotOption[]
  sites: SiteOption[]
  currentDepotId: string | null
  currentSiteId: string | null
}

type Destination = { kind: 'depot' | 'site'; id: string }

export const TransferForm = ({
  toolId,
  depots,
  sites,
  currentDepotId,
  currentSiteId,
}: TransferFormProps) => {
  const router = useRouter()
  const [destination, setDestination] = useState<Destination | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCurrent = (kind: 'depot' | 'site', id: string) =>
    (kind === 'depot' && id === currentDepotId) || (kind === 'site' && id === currentSiteId)

  const isSelected = (kind: 'depot' | 'site', id: string) =>
    destination?.kind === kind && destination.id === id

  const handleSubmit = async () => {
    if (!destination) return
    setSubmitting(true)
    setError(null)
    const res = await createTransferAction(toolId, {
      destinationKind: destination.kind,
      destinationId: destination.id,
      note: note.trim() || undefined,
    })
    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    router.push(`/materiel/${toolId}`)
    router.refresh()
  }

  const TargetButton = ({
    kind,
    id,
    name,
  }: {
    kind: 'depot' | 'site'
    id: string
    name: string
  }) => {
    const current = isCurrent(kind, id)
    const selected = isSelected(kind, id)
    return (
      <button
        type='button'
        disabled={current}
        onClick={() => setDestination({ kind, id })}
        className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm transition-colors ${
          selected
            ? 'border-primary bg-primary/10'
            : current
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-accent/50'
        }`}
      >
        {kind === 'depot' ? (
          <Warehouse className='size-5 shrink-0 text-muted-foreground' />
        ) : (
          <HardHat className='size-5 shrink-0 text-muted-foreground' />
        )}
        <span className='min-w-0 flex-1 truncate font-medium'>{name}</span>
        {current && <span className='shrink-0 text-xs text-muted-foreground'>Ici</span>}
      </button>
    )
  }

  return (
    <div className='space-y-5'>
      {depots.length > 0 && (
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase text-muted-foreground'>Dépôts</p>
          <div className='space-y-2'>
            {depots.map((d) => (
              <TargetButton key={d.id} kind='depot' id={d.id} name={d.name} />
            ))}
          </div>
        </div>
      )}

      {sites.length > 0 && (
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase text-muted-foreground'>Chantiers</p>
          <div className='space-y-2'>
            {sites.map((s) => (
              <TargetButton key={s.id} kind='site' id={s.id} name={s.name} />
            ))}
          </div>
        </div>
      )}

      <div className='space-y-2'>
        <Label htmlFor='note'>Note (optionnel)</Label>
        <Textarea
          id='note'
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Précision sur le transfert…'
        />
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <Button
        size='lg'
        className='w-full'
        disabled={!destination || submitting}
        onClick={handleSubmit}
      >
        {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Confirmer le transfert'}
      </Button>
    </div>
  )
}
