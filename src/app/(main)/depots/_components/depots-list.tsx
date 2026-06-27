import Link from 'next/link'
import { Car, MapPin, User, Warehouse, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { DEPOT_TYPE_LABELS } from '@/lib/crm/labels'
import type { DepotListItem } from '@/services/crm/depot'

interface DepotsListProps {
  items: DepotListItem[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Date (YYYY-MM-DD) à n jours d'aujourd'hui. */
const inDaysKey = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const DepotsList = ({ items }: DepotsListProps) => {
  const today = todayKey()
  const soon = inDaysKey(30)

  return (
    <ul className='divide-y rounded-lg border'>
      {items.map((d) => {
        const isVehicle = d.type === 'vehicule'
        const overdue = d.nextMaintenanceDate !== null && d.nextMaintenanceDate < today
        const dueSoon = !overdue && d.nextMaintenanceDate !== null && d.nextMaintenanceDate <= soon
        return (
          <li key={d.id}>
            <Link
              href={`/depots/${d.id}`}
              className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
            >
              <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                {isVehicle ? <Car className='size-4' /> : <Warehouse className='size-4' />}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{d.name}</p>
                <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                  <span>{DEPOT_TYPE_LABELS[d.type] ?? d.type}</span>
                  {isVehicle && d.registrationNumber && (
                    <span className='font-mono uppercase'>{d.registrationNumber}</span>
                  )}
                  {d.city && (
                    <span className='inline-flex items-center gap-1'>
                      <MapPin className='size-3' /> {d.city}
                    </span>
                  )}
                  {d.responsibleName && (
                    <span className='inline-flex items-center gap-1'>
                      <User className='size-3' /> {d.responsibleName}
                    </span>
                  )}
                </div>
              </div>
              {(overdue || dueSoon) && (
                <Badge
                  variant='outline'
                  className={`shrink-0 ${overdue ? 'text-destructive-foreground' : ''}`}
                >
                  <Wrench className='size-3' /> {overdue ? 'En retard' : 'Bientôt'}
                </Badge>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
