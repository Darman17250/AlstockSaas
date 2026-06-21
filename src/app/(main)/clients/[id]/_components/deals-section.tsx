import Link from 'next/link'
import { Briefcase, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEAL_STAGE_LABELS, DEAL_STATUS_LABELS, formatDealAmount } from '@/lib/crm/labels'
import type { DealClientItem } from '@/services/crm/deal'

interface DealsSectionProps {
  clientId: string
  deals: DealClientItem[]
  canCreate: boolean
}

export const DealsSection = ({ clientId, deals, canCreate }: DealsSectionProps) => (
  <section className='space-y-3 rounded-lg border p-5'>
    <div className='flex items-center justify-between gap-3'>
      <h2 className='font-semibold'>Affaires</h2>
      {canCreate && (
        <Button
          variant='outline'
          size='sm'
          render={<Link href={`/affaires/nouveau?clientId=${clientId}`} />}
        >
          <Plus className='size-4' /> Nouvelle
        </Button>
      )}
    </div>

    {deals.length === 0 ? (
      <p className='text-sm text-muted-foreground'>Aucune affaire pour ce client.</p>
    ) : (
      <ul className='divide-y'>
        {deals.map((d) => {
          const amount = formatDealAmount(d.estimatedAmount, d.currency)
          return (
            <li key={d.id}>
              <Link
                href={`/affaires/${d.id}`}
                className='-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50'
              >
                <Briefcase className='size-4 shrink-0 text-muted-foreground' />
                <span className='min-w-0 flex-1 truncate text-sm'>{d.title}</span>
                {amount && (
                  <span className='hidden shrink-0 text-sm font-medium tabular-nums sm:inline'>
                    {amount}
                  </span>
                )}
                <Badge variant={d.status === 'gagnee' ? 'secondary' : 'outline'}>
                  {d.status === 'en_cours'
                    ? (DEAL_STAGE_LABELS[d.stage] ?? d.stage)
                    : (DEAL_STATUS_LABELS[d.status] ?? d.status)}
                </Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    )}
  </section>
)
