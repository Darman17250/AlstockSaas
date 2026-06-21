'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ACTIVITY_TYPE_LABELS, COMMUNICATION_TYPES } from '@/lib/crm/labels'
import type { OrgMemberOption } from '@/services/org/members'
import {
  createCommunicationAction,
  deleteCommunicationAction,
  updateCommunicationAction,
} from '../../actions'

export interface CommunicationItem {
  id: string
  type: string
  subject: string
  description: string | null
  occurredAt: string | null
  authorId: string | null
  authorName: string | null
}

interface CommunicationsSectionProps {
  clientId: string
  communications: CommunicationItem[]
  members: OrgMemberOption[]
  currentMemberId: string
  canEdit: boolean
}

const TYPE_ICONS: Record<string, typeof Phone> = {
  appel: Phone,
  email: Mail,
  reunion: Users,
  visite: MapPin,
  note: StickyNote,
}

const formatDate = (iso: string | null) => {
  if (!iso) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

const today = () => new Date().toISOString().slice(0, 10)

export const CommunicationsSection = ({
  clientId,
  communications,
  members,
  currentMemberId,
  canEdit,
}: CommunicationsSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CommunicationItem | null>(null)
  const [type, setType] = useState<string>('appel')
  const [authorId, setAuthorId] = useState<string>(currentMemberId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setType('appel')
    setAuthorId(currentMemberId)
    setError(null)
    setOpen(true)
  }
  const openEdit = (c: CommunicationItem) => {
    setEditing(c)
    setType(c.type)
    setAuthorId(c.authorId ?? currentMemberId)
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      type,
      subject: String(fd.get('subject') ?? ''),
      description: String(fd.get('description') ?? ''),
      occurredAt: String(fd.get('occurredAt') ?? ''),
      assigneeId: authorId,
    }
    const res = editing
      ? await updateCommunicationAction(editing.id, clientId, payload)
      : await createCommunicationAction({ ...payload, clientId })

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setOpen(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    await deleteCommunicationAction(id, clientId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <MessageSquare className='size-4' /> Communications ({communications.length})
        </h2>
        {canEdit && (
          <Button size='sm' variant='outline' onClick={openCreate}>
            <Plus className='size-4' /> Ajouter
          </Button>
        )}
      </div>

      {communications.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucune communication enregistrée.</p>
      ) : (
        <ul className='divide-y'>
          {communications.map((c) => {
            const Icon = TYPE_ICONS[c.type] ?? StickyNote
            return (
              <li key={c.id} className='flex gap-3 px-5 py-3'>
                <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  <Icon className='size-4' />
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-baseline gap-x-2'>
                    <p className='text-sm font-medium'>{c.subject}</p>
                    <span className='text-xs text-muted-foreground'>
                      {ACTIVITY_TYPE_LABELS[c.type] ?? c.type}
                      {c.occurredAt && ` · ${formatDate(c.occurredAt)}`}
                      {c.authorName && ` · ${c.authorName}`}
                    </span>
                  </div>
                  {c.description && (
                    <p className='mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground'>
                      {c.description}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      size='icon'
                      variant='ghost'
                      aria-label='Modifier la communication'
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className='size-4' />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            size='icon'
                            variant='ghost'
                            aria-label='Supprimer la communication'
                            disabled={busyId === c.id}
                          />
                        }
                      >
                        <Trash2 className='size-4 text-destructive-foreground' />
                      </AlertDialogTrigger>
                      <AlertDialogPopup>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette communication ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            « {c.subject} » sera définitivement supprimée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogClose render={<Button variant='outline' />}>
                            Annuler
                          </AlertDialogClose>
                          <AlertDialogClose
                            render={<Button variant='destructive' />}
                            onClick={() => handleDelete(c.id)}
                          >
                            Supprimer
                          </AlertDialogClose>
                        </AlertDialogFooter>
                      </AlertDialogPopup>
                    </AlertDialog>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifier la communication' : 'Nouvelle communication'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogPanel className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v ?? 'appel')}>
                    <SelectTrigger>
                      <SelectValue>
                        {(value) => ACTIVITY_TYPE_LABELS[value as string] ?? ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNICATION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACTIVITY_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='occurredAt'>Date</Label>
                  <Input
                    id='occurredAt'
                    name='occurredAt'
                    type='date'
                    defaultValue={editing?.occurredAt ? editing.occurredAt.slice(0, 10) : today()}
                    required
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='subject'>Sujet</Label>
                <Input
                  id='subject'
                  name='subject'
                  defaultValue={editing?.subject ?? ''}
                  placeholder='Ex. Relance devis, point téléphonique…'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='description'>Détails</Label>
                <Textarea
                  id='description'
                  name='description'
                  defaultValue={editing?.description ?? ''}
                />
              </div>
              <div className='space-y-2 sm:max-w-sm'>
                <Label>Réalisé par</Label>
                <Select value={authorId} onValueChange={(v) => setAuthorId(v ?? currentMemberId)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => members.find((m) => m.id === value)?.name ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
              <Button type='submit' disabled={submitting}>
                {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
