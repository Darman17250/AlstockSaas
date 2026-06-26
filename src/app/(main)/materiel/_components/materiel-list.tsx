import Link from 'next/link'
import { AlertTriangle, Forklift, Fuel, MapPin, User, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  FUEL_LEVEL_LABELS,
  TOOL_KIND_LABELS,
  TOOL_STATUS_LABELS,
} from '@/lib/crm/labels'
import type { ToolListItem } from '@/services/crm/tool'

interface MaterielListProps {
  items: ToolListItem[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const inDaysKey = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Couleur de badge selon le statut (sobre, hors disponible/en service). */
const statusClass = (status: string): string =>
  status === 'disponible'
    ? ''
    : status === 'en_service'
      ? ''
      : 'text-destructive-foreground'

export const MaterielList = ({ items }: MaterielListProps) => {
  const today = todayKey()
  const soon = inDaysKey(30)

  return (
    <ul className='divide-y rounded-lg border'>
      {items.map((t) => {
        const isMachine = t.kind === 'machine'
        const location = t.currentDepotName ?? t.currentSiteName
        const overdue = t.nextMaintenanceDate !== null && t.nextMaintenanceDate < today
        const dueSoon = !overdue && t.nextMaintenanceDate !== null && t.nextMaintenanceDate <= soon
        return (
          <li key={t.id}>
            <Link
              href={`/materiel/${t.id}`}
              className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
            >
              <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                {isMachine ? <Forklift className='size-4' /> : <Wrench className='size-4' />}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{t.name}</p>
                <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                  <span>{t.category ?? TOOL_KIND_LABELS[t.kind]}</span>
                  {location && (
                    <span className='inline-flex items-center gap-1'>
                      <MapPin className='size-3' /> {location}
                    </span>
                  )}
                  {t.responsibleName && (
                    <span className='inline-flex items-center gap-1'>
                      <User className='size-3' /> {t.responsibleName}
                    </span>
                  )}
                  {isMachine && t.fuelLevel && (
                    <span className='inline-flex items-center gap-1'>
                      <Fuel className='size-3' /> {FUEL_LEVEL_LABELS[t.fuelLevel] ?? t.fuelLevel}
                    </span>
                  )}
                </div>
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <Badge variant='outline' className={statusClass(t.status)}>
                  {TOOL_STATUS_LABELS[t.status] ?? t.status}
                </Badge>
                <div className='flex gap-1'>
                  {t.hasOpenIssue && (
                    <Badge variant='outline' className='text-destructive-foreground'>
                      <AlertTriangle className='size-3' /> Problème
                    </Badge>
                  )}
                  {(overdue || dueSoon) && (
                    <Badge variant='outline' className={overdue ? 'text-destructive-foreground' : ''}>
                      <Wrench className='size-3' /> {overdue ? 'En retard' : 'Bientôt'}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
