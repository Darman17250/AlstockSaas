'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Mail, Pencil, Plus, Shield, Trash2, UserPlus } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { client } from '@/lib/auth/auth-client'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { HABILITATION_TYPE_LABELS } from '@/lib/crm/labels'
import type { ExpiringHabilitationItem } from '@/services/org/habilitation'
import type { RoleSummary } from '@/services/org/roles'
import { assignMemberRoleAction, deleteRoleAction } from '../equipe/actions'
import { RoleEditorDialog } from './role-editor-dialog'

interface MemberRow {
  memberId: string
  role: string
  roleName: string
  roleColor: string | null
  name: string
  email: string
}
interface InvitationRow {
  id: string
  email: string
  role: string | null
  roleName: string
  expiresAt: string
}

interface TeamTabsProps {
  canManage: boolean
  currentMemberId: string
  members: MemberRow[]
  invitations: InvitationRow[]
  roles: RoleSummary[]
  expiring: ExpiringHabilitationItem[]
}

const initials = (name: string, email: string) => (name?.trim() || email).slice(0, 2).toUpperCase()

const RoleBadge = ({ name, color }: { name: string; color: string | null }) =>
  color ? (
    <Badge style={{ backgroundColor: color, color: '#fff', borderColor: color }}>{name}</Badge>
  ) : (
    <Badge variant='secondary'>{name}</Badge>
  )

export const TeamTabs = ({
  canManage,
  currentMemberId,
  members,
  invitations,
  roles,
  expiring,
}: TeamTabsProps) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const inviteRoles = roles.filter((r) => r.assignable && r.isSystem)
  const assignRoles = roles.filter((r) => r.assignable)
  const [inviteRole, setInviteRole] = useState<string>(inviteRoles[0]?.slug ?? 'commercial')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<RoleSummary | null>(null)

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const target = email.trim().toLowerCase()
    if (!target) {
      setError('Adresse email requise.')
      return
    }
    setInviting(true)
    setError(null)
    // `inviteRoles` ne contient que des rôles intégrés (le plugin valide contre sa config).
    const res = await client.organization.inviteMember({
      email: target,
      role: inviteRole as 'admin' | 'commercial' | 'conducteur' | 'terrain',
    })
    if (res.error) {
      setError(res.error.message ?? 'Échec de l’invitation.')
      setInviting(false)
      return
    }
    setEmail('')
    setInviting(false)
    router.refresh()
  }

  const handleRoleChange = async (memberId: string, slug: string) => {
    setBusyId(memberId)
    setError(null)
    const res = await assignMemberRoleAction({ memberId, slug })
    setBusyId(null)
    if (res.ok) router.refresh()
    else setError(res.error)
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

  const handleDeleteRole = async (slug: string) => {
    setBusyId(slug)
    setError(null)
    const res = await deleteRoleAction(slug)
    setBusyId(null)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  const openCreateRole = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEditRole = (role: RoleSummary) => {
    setEditing(role)
    setEditorOpen(true)
  }

  return (
    <div className='space-y-6'>
      {/* Bannière habilitations à renouveler */}
      {expiring.length > 0 && (
        <section className='rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30'>
          <h2 className='mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200'>
            <AlertTriangle className='size-4' /> Habilitations à renouveler ({expiring.length})
          </h2>
          <ul className='space-y-1 text-sm'>
            {expiring.slice(0, 6).map((h) => (
              <li key={h.id} className='flex flex-wrap items-center gap-x-2'>
                <Link href={`/equipe/${h.memberId}`} className='font-medium hover:underline'>
                  {h.memberName ?? 'Membre'}
                </Link>
                <span className='text-muted-foreground'>
                  · {HABILITATION_TYPE_LABELS[h.type] ?? h.type} — {h.name}
                </span>
                <Badge
                  variant='outline'
                  size='sm'
                  className={h.status === 'expiree' ? 'text-red-600' : 'text-amber-700'}
                >
                  {h.status === 'expiree' ? 'Expirée le ' : 'Expire le '}
                  {h.expiresAt}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <Tabs defaultValue='membres'>
        <TabsList>
          <TabsTab value='membres'>Membres ({members.length})</TabsTab>
          {canManage && <TabsTab value='roles'>Rôles</TabsTab>}
        </TabsList>

        {/* ── Membres ──────────────────────────────────────────────────── */}
        <TabsPanel value='membres' className='space-y-6 pt-4'>
          {canManage && (
            <section className='rounded-lg border p-5'>
              <h2 className='mb-4 flex items-center gap-2 font-semibold'>
                <UserPlus className='size-4' /> Inviter un membre
              </h2>
              <form
                onSubmit={handleInvite}
                className='flex flex-col gap-3 sm:flex-row sm:items-end'
              >
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
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v ?? 'commercial')}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          inviteRoles.find((r) => r.slug === value)?.name ??
                          ROLE_LABELS[value as string] ??
                          ''
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {inviteRoles.map((r) => (
                        <SelectItem key={r.slug} value={r.slug}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type='submit' disabled={inviting}>
                  {inviting ? <Loader2 className='size-4 animate-spin' /> : 'Inviter'}
                </Button>
              </form>
            </section>
          )}

          <section className='rounded-lg border'>
            <h2 className='border-b px-5 py-3 font-semibold'>Membres ({members.length})</h2>
            <ul className='divide-y'>
              {members.map((m) => {
                const isSelf = m.memberId === currentMemberId
                const isOwner = m.role === 'owner'
                const editable = canManage && !isSelf && !isOwner
                return (
                  <li key={m.memberId} className='flex flex-wrap items-center gap-3 px-5 py-3'>
                    <Link
                      href={`/equipe/${m.memberId}`}
                      className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'
                    >
                      {initials(m.name, m.email)}
                    </Link>
                    <div className='min-w-0 flex-1'>
                      <Link
                        href={`/equipe/${m.memberId}`}
                        className='block truncate text-sm font-medium hover:underline'
                      >
                        {m.name || m.email}{' '}
                        {isSelf && <span className='text-muted-foreground'>(vous)</span>}
                      </Link>
                      <p className='truncate text-xs text-muted-foreground'>{m.email}</p>
                    </div>

                    {editable ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) => v && handleRoleChange(m.memberId, v)}
                      >
                        <SelectTrigger size='sm' className='w-48'>
                          <SelectValue>
                            {(value) =>
                              assignRoles.find((r) => r.slug === value)?.name ??
                              ROLE_LABELS[value as string] ??
                              (value as string)
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {assignRoles.map((r) => (
                            <SelectItem key={r.slug} value={r.slug}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <RoleBadge name={m.roleName} color={m.roleColor} />
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
                      <p className='text-xs text-muted-foreground'>{inv.roleName} · en attente</p>
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
        </TabsPanel>

        {/* ── Rôles ────────────────────────────────────────────────────── */}
        {canManage && (
          <TabsPanel value='roles' className='space-y-4 pt-4'>
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                Les rôles intégrés sont en lecture seule. Créez des rôles sur mesure pour votre
                organisation.
              </p>
              <Button size='sm' onClick={openCreateRole}>
                <Plus className='size-4' /> Nouveau rôle
              </Button>
            </div>

            <ul className='space-y-2'>
              {roles.map((r) => {
                const grantedCount = Object.values(r.permissions).filter(
                  (a) => a && a.length > 0
                ).length
                return (
                  <li
                    key={r.slug}
                    className='flex flex-wrap items-center gap-3 rounded-lg border p-4'
                  >
                    <Shield className='size-4 shrink-0 text-muted-foreground' />
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <RoleBadge name={r.name} color={r.color} />
                        {r.isSystem && (
                          <Badge variant='outline' size='sm'>
                            Intégré
                          </Badge>
                        )}
                      </div>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        {grantedCount} ressource{grantedCount > 1 ? 's' : ''} · {r.memberCount}{' '}
                        membre{r.memberCount > 1 ? 's' : ''}
                      </p>
                    </div>
                    {!r.isSystem && (
                      <>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          aria-label='Modifier le rôle'
                          onClick={() => openEditRole(r)}
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon-sm'
                                aria-label='Supprimer le rôle'
                                disabled={busyId === r.slug}
                              />
                            }
                          >
                            <Trash2 className='size-4 text-red-500' />
                          </AlertDialogTrigger>
                          <AlertDialogPopup>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce rôle ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                « {r.name} » sera définitivement supprimé. Impossible s’il est
                                attribué à des membres.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogClose render={<Button variant='outline' />}>
                                Annuler
                              </AlertDialogClose>
                              <AlertDialogClose
                                render={<Button variant='destructive' />}
                                onClick={() => handleDeleteRole(r.slug)}
                              >
                                Supprimer
                              </AlertDialogClose>
                            </AlertDialogFooter>
                          </AlertDialogPopup>
                        </AlertDialog>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </TabsPanel>
        )}
      </Tabs>

      <RoleEditorDialog open={editorOpen} onOpenChange={setEditorOpen} role={editing} />
    </div>
  )
}
