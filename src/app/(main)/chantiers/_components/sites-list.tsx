import Link from 'next/link'
import { Building2, HardHat, Hash, MapPin, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { SITE_STATUS_LABELS } from '@/lib/crm/labels'
import type { SiteListItem } from '@/services/crm/site'

interface SitesListProps {
  items: SiteListItem[]
}

const statusVariant = (status: string): 'default' | 'secondary' | 'outline' =>
  status === 'en_cours' ? 'default' : status === 'termine' ? 'secondary' : 'outline'

export const SitesList = ({ items }: SitesListProps) => (
  <ul className='divide-y rounded-lg border'>
    {items.map((s) => (
      <li key={s.id}>
        <Link
          href={`/chantiers/${s.id}`}
          className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
        >
          <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <HardHat className='size-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{s.name}</p>
            <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1'>
                <Building2 className='size-3' /> {s.clientName}
              </span>
              {s.city && (
                <span className='inline-flex items-center gap-1'>
                  <MapPin className='size-3' /> {s.city}
                </span>
              )}
              {s.reference && (
                <span className='inline-flex items-center gap-1'>
                  <Hash className='size-3' /> {s.reference}
                </span>
              )}
              {s.conducteurName && (
                <span className='inline-flex items-center gap-1'>
                  <User className='size-3' /> {s.conducteurName}
                </span>
              )}
            </div>
          </div>
          <div className='shrink-0'>
            <Badge variant={statusVariant(s.status)}>
              {SITE_STATUS_LABELS[s.status] ?? s.status}
            </Badge>
          </div>
        </Link>
      </li>
    ))}
  </ul>
)
