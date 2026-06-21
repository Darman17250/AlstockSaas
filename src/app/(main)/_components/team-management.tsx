'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Trash2, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { client } from '@/lib/auth/auth-client'
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/auth/permissions'

type RoleValue = 'admin' | 'commercial' | 'conducteur' | 'terrain'

interface MemberRow {
  memberId: string
  role: string
  name: string
  email: string
}
interface InvitationRow {
  id: string
  email: string
  role: string | null
  expiresAt: string
}

interface TeamManagementProps {
  canManage: boolean
  currentMemberId: string
  members: MemberRow[]
  invitations: InvitationRow[]
}

const initials = (name: string, email: string) => (name?.trim() || email).slice(0, 2).toUpperCase()

export const TeamManagement = ({
  canManage,
  currentMemberId,
  members,
  invitations,
}: TeamManagementProps) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<RoleValue>('commercial')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const target = email.trim().toLowerCase()
    if (!target) {
      setError('Adresse email requise.')
      return
    }
    setInviting(true)
    setError(null)
    const res = await client.organization.inviteMember({ email: target, role })
    if (res.error) {
      setError(res.error.message ?? 'Échec de l’invitation.')
      setInviting(false)
      return
    }
    setEmail('')
    setInviting(false)
    router.refresh()
  }

  const handleRoleChange = async (memberId: string, newRole: RoleValue) => {
    setBusyId(memberId)
    await client.organization.updateMemberRole({ memberId, role: newRole })
    setBusyId(null)
    router.refresh()
  }

  const handleRemove = async (memberId: string) => {
    setBusyId(memberId)
    await client.organization.removeMember({ memberIdOrEmail: memberId })
    setBusyId(null)
    router.refresh()
  }

  const handleCancelInvite = async (invitationId: string) => {
    setBusyId(invitationId)
    await client.organization.cancelInvitation({ invitationId })
    setBusyId(null)
    router.refresh()
  }

  return (
    <div className='space-y-8'>
      {/* Invitation */}
      {canManage && (
        <section className='rounded-lg border p-5'>
          <h2 className='mb-4 flex items-center gap-2 font-semibold'>
            <UserPlus className='size-4' /> Inviter un membre
          </h2>
          <form onSubmit={handleInvite} className='flex flex-col gap-3 sm:flex-row sm:items-end'>
            <div className='flex-1 space-y-2'>
              <Label htmlFor='invite-email'>Email</Label>
              <Input
                id='invite-email'
                type='email'
                placeholder='collegue@entreprise.fr'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className='space-y-2 sm:w-56'>
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type='submit' disabled={inviting}>
              {inviting ? <Loader2 className='size-4 animate-spin' /> : 'Inviter'}
            </Button>
          </form>
          {error && <p className='mt-2 text-sm text-red-500'>{error}</p>}
        </section>
      )}

      {/* Membres */}
      <section className='rounded-lg border'>
        <h2 className='border-b px-5 py-3 font-semibold'>Membres ({members.length})</h2>
        <ul className='divide-y'>
          {members.map((m) => {
            const isSelf = m.memberId === currentMemberId
            const isOwner = m.role === 'owner'
            const editable = canManage && !isSelf && !isOwner
            return (
              <li key={m.memberId} className='flex flex-wrap items-center gap-3 px-5 py-3'>
                <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'>
                  {initials(m.name, m.email)}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {m.name || m.email}{' '}
                    {isSelf && <span className='text-muted-foreground'>(vous)</span>}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>{m.email}</p>
                </div>

                {editable ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleRoleChange(m.memberId, v as RoleValue)}
                  >
                    <SelectTrigger size='sm' className='w-48'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant='secondary'>{ROLE_LABELS[m.role] ?? m.role}</Badge>
                )}

                {editable && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label='Retirer le membre'
                    disabled={busyId === m.memberId}
                    onClick={() => handleRemove(m.memberId)}
                  >
                    <Trash2 className='size-4 text-red-500' />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* Invitations en attente */}
      {invitations.length > 0 && (
        <section className='rounded-lg border'>
          <h2 className='border-b px-5 py-3 font-semibold'>
            Invitations en attente ({invitations.length})
          </h2>
          <ul className='divide-y'>
            {invitations.map((inv) => (
              <li key={inv.id} className='flex flex-wrap items-center gap-3 px-5 py-3'>
                <Mail className='size-4 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{inv.email}</p>
                  <p className='text-xs text-muted-foreground'>
                    {ROLE_LABELS[inv.role ?? 'member'] ?? inv.role} · en attente
                  </p>
                </div>
                {canManage && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    disabled={busyId === inv.id}
                    onClick={() => handleCancelInvite(inv.id)}
                  >
                    Annuler
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
