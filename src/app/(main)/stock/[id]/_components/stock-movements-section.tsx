import { ArrowRight, PackagePlus, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { STOCK_MOVEMENT_TYPE_LABELS, formatQuantity } from '@/lib/crm/labels'
import type { StockMovementItem } from '@/services/crm/stock-transfer'

interface StockMovementsSectionProps {
  movements: StockMovementItem[]
  unit: string
}

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))

const typeIcon = (type: string) => {
  if (type === 'reception') return PackagePlus
  if (type === 'return') return RotateCcw
  return ArrowRight
}

export const StockMovementsSection = ({ movements, unit }: StockMovementsSectionProps) => (
  <section className='space-y-3 rounded-lg border p-5'>
    <h2 className='font-semibold'>Mouvements</h2>
    {movements.length === 0 ? (
      <p className='text-sm text-muted-foreground'>Aucun mouvement enregistré.</p>
    ) : (
      <ul className='divide-y'>
        {movements.map((m) => {
          const Icon = typeIcon(m.type)
          return (
            <li key={m.id} className='flex items-start gap-3 py-2.5'>
              <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{STOCK_MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</Badge>
                  <span className='text-sm font-medium'>{formatQuantity(m.quantity, unit)}</span>
                </div>
                <p className='mt-0.5 text-xs text-muted-foreground'>
                  {m.fromName ?? '—'} → {m.toName ?? '—'}
                  {m.movedByName ? ` · ${m.movedByName}` : ''}
                </p>
                {m.note && <p className='mt-0.5 text-xs text-muted-foreground'>{m.note}</p>}
              </div>
              <span className='shrink-0 text-xs text-muted-foreground'>
                {formatDateTime(m.createdAt)}
              </span>
            </li>
          )
        })}
      </ul>
    )}
  </section>
)
