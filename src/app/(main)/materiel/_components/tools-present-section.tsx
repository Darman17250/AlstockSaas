import Link from 'next/link'
import { ArrowLeftRight, Forklift, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TOOL_STATUS_LABELS } from '@/lib/crm/labels'
import type { ToolPresenceItem } from '@/services/crm/tool'

interface ToolsPresentSectionProps {
  items: ToolPresenceItem[]
  /** Affiche le bouton rapide « Transférer » (perm toolTransfer create). */
  canTransfer: boolean
}

/** Section « Matériel présent » réutilisable sur les fiches dépôt et chantier. */
export const ToolsPresentSection = ({ items, canTransfer }: ToolsPresentSectionProps) => (
  <section className='rounded-lg border'>
    <div className='border-b px-5 py-3'>
      <h2 className='flex items-center gap-2 font-semibold'>
        <Wrench className='size-4' /> Matériel présent ({items.length})
      </h2>
    </div>
    {items.length === 0 ? (
      <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun matériel ici actuellement.</p>
    ) : (
      <ul className='divide-y'>
        {items.map((t) => (
          <li key={t.id} className='flex items-center gap-3 px-5 py-3'>
            {t.kind === 'machine' ? (
              <Forklift className='size-4 shrink-0 text-muted-foreground' />
            ) : (
              <Wrench className='size-4 shrink-0 text-muted-foreground' />
            )}
            <Link href={`/materiel/${t.id}`} className='min-w-0 flex-1 hover:underline'>
              <span className='truncate text-sm font-medium'>{t.name}</span>
              {t.category && (
                <span className='ml-2 text-xs text-muted-foreground'>{t.category}</span>
              )}
            </Link>
            <Badge variant='outline'>{TOOL_STATUS_LABELS[t.status] ?? t.status}</Badge>
            {canTransfer && (
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label='Transférer'
                render={<Link href={`/materiel/${t.id}/transfert`} />}
              >
                <ArrowLeftRight className='size-4' />
              </Button>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
)
