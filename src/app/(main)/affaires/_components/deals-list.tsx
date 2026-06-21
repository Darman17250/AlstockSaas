import Link from 'next/link'
import { Briefcase } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { DEAL_STATUS_LABELS, formatDealAmount } from '@/lib/crm/labels'
import type { DealListItem } from '@/services/crm/deal'

interface DealsListProps {
  items: DealListItem[]
}

const dateLabel = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

export const DealsList = ({ items }: DealsListProps) => (
  <ul className='divide-y rounded-lg border'>
    {items.map((d) => {
      const amount = formatDealAmount(d.estimatedAmount, d.currency)
      const closed = dateLabel(d.wonAt ?? d.lostAt)
      return (
        <li key={d.id}>
          <Link
            href={`/affaires/${d.id}`}
            className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
          >
            <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <Briefcase className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{d.title}</p>
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>
                {d.clientName}
                {closed && ` · ${closed}`}
              </p>
            </div>
            {amount && (
              <span className='hidden shrink-0 text-sm font-semibold tabular-nums sm:inline'>
                {amount}
              </span>
            )}
            <Badge variant={d.status === 'gagnee' ? 'secondary' : 'outline'}>
              {DEAL_STATUS_LABELS[d.status] ?? d.status}
            </Badge>
          </Link>
        </li>
      )
    })}
  </ul>
)
