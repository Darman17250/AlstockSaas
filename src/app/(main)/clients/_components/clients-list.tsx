import Link from 'next/link'
import { Building2, Mail, MapPin, Phone, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CLIENT_TYPE_LABELS, RELATION_TYPE_LABELS } from '@/lib/crm/labels'
import type { ClientListItem } from '@/services/crm/client'

interface ClientsListProps {
  items: ClientListItem[]
}

export const ClientsList = ({ items }: ClientsListProps) => (
  <ul className='divide-y rounded-lg border'>
    {items.map((c) => (
      <li key={c.id}>
        <Link
          href={`/clients/${c.id}`}
          className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
        >
          <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            {c.type === 'societe' ? <Building2 className='size-4' /> : <User className='size-4' />}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{c.name}</p>
            <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
              {c.city && (
                <span className='inline-flex items-center gap-1'>
                  <MapPin className='size-3' /> {c.city}
                </span>
              )}
              {c.email && (
                <span className='inline-flex items-center gap-1'>
                  <Mail className='size-3' /> {c.email}
                </span>
              )}
              {c.phone && (
                <span className='inline-flex items-center gap-1'>
                  <Phone className='size-3' /> {c.phone}
                </span>
              )}
            </div>
          </div>
          <div className='hidden shrink-0 gap-2 sm:flex'>
            <Badge variant='outline'>{CLIENT_TYPE_LABELS[c.type] ?? c.type}</Badge>
            <Badge variant='secondary'>
              {RELATION_TYPE_LABELS[c.relationType] ?? c.relationType}
            </Badge>
          </div>
        </Link>
      </li>
    ))}
  </ul>
)
