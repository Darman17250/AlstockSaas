'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, UserMinus, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { OrgMemberOption } from '@/services/org/members'
import type { SiteTeamMember } from '@/services/crm/site-member'
import { assignSiteMemberAction, removeSiteMemberAction } from '../../actions'

interface SiteTeamSectionProps {
  siteId: string
  team: SiteTeamMember[]
  /** Tous les membres de l'org (pour le sélecteur d'ajout). Vide si lecture seule. */
  members: OrgMemberOption[]
  canEdit: boolean
}

const NONE = '__none__'

export const SiteTeamSection = ({ siteId, team, members, canEdit }: SiteTeamSectionProps) => {
  const router = useRouter()
  const [selected, setSelected] = useState<string>(NONE)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignedIds = new Set(team.map((t) => t.memberId))
  const available = members.filter((m) => !assignedIds.has(m.id))

  const handleAdd = async () => {
    if (selected === NONE) return
    setAdding(true)
    setError(null)
    const res = await assignSiteMemberAction(siteId, selected)
    setAdding(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSelected(NONE)
    router.refresh()
  }

  const handleRemove = async (memberId: string) => {
    setBusyId(memberId)
    setError(null)
    const res = await removeSiteMemberAction(siteId, memberId)
    setBusyId(null)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <Users className='size-4' /> Équipe ({team.length})
        </h2>
      </div>

      {canEdit && (
        <div className='flex flex-col gap-2 border-b px-5 py-3 sm:flex-row sm:items-center'>
          <Select value={selected} onValueChange={(v) => setSelected(v ?? NONE)}>
            <SelectTrigger size='sm' className='flex-1'>
              <SelectValue>
                {(value) =>
                  value === NONE
                    ? 'Choisir un salarié…'
                    : (available.find((m) => m.id === value)?.name ?? '')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Choisir un salarié…</SelectItem>
              {available.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size='sm'
            variant='outline'
            disabled={selected === NONE || adding}
            onClick={handleAdd}
          >
            {adding ? <Loader2 className='size-4 animate-spin' /> : <Plus className='size-4' />}
            Ajouter
          </Button>
        </div>
      )}

      {error && <p className='px-5 pt-3 text-sm text-destructive-foreground'>{error}</p>}

      {team.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun salarié assigné.</p>
      ) : (
        <ul className='divide-y'>
          {team.map((m) => (
            <li key={m.memberId} className='flex items-center gap-3 px-5 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='flex items-center gap-2 truncate text-sm font-medium'>
                  {m.name}
                  <Badge variant='secondary' size='sm'>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                </p>
              </div>
              {canEdit && (
                <Button
                  size='icon'
                  variant='ghost'
                  aria-label={`Retirer ${m.name}`}
                  disabled={busyId === m.memberId}
                  onClick={() => handleRemove(m.memberId)}
                >
                  <UserMinus className='size-4 text-destructive-foreground' />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
