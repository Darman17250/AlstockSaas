'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TASK_STATUS_LABELS } from '@/lib/crm/labels'
import { taskStatusEnum } from '@/database/schema'
import type { OrgMemberOption } from '@/services/org/members'

const ALL = '__all__'

interface TaskFiltersProps {
  members: OrgMemberOption[]
  /** Paramètres d'URL à toujours conserver (ex. tab/scope courants). */
  preserve?: Record<string, string>
  /** Afficher le filtre de statut (caché dans la vue calendrier). */
  showStatus?: boolean
}

/** Filtres de tâches (assigné + statut) poussés dans l'URL. Réutilisable. */
export const TaskFilters = ({
  members,
  preserve = { tab: 'team' },
  showStatus = true,
}: TaskFiltersProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const pushParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== ALL) params.set(key, value)
    else params.delete(key)
    for (const [k, v] of Object.entries(preserve)) params.set(k, v)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className='flex flex-wrap gap-3'>
      <Select
        value={searchParams.get('assigneeId') ?? ALL}
        onValueChange={(v) => pushParam('assigneeId', v)}
      >
        <SelectTrigger size='sm' className='w-48'>
          <SelectValue>
            {(value) =>
              value === ALL
                ? 'Tous les salariés'
                : (members.find((m) => m.id === value)?.name ?? '')
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tous les salariés</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showStatus && (
        <Select
          value={searchParams.get('status') ?? ALL}
          onValueChange={(v) => pushParam('status', v)}
        >
          <SelectTrigger size='sm' className='w-40'>
            <SelectValue>
              {(value) =>
                value === ALL ? 'Tous statuts' : (TASK_STATUS_LABELS[value as string] ?? '')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous statuts</SelectItem>
            {taskStatusEnum.enumValues.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
