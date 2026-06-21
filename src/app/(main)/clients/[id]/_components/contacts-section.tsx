'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'

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
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { createContactAction, deleteContactAction, updateContactAction } from '../../actions'

export interface ContactItem {
  id: string
  firstName: string
  lastName: string | null
  jobTitle: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  isPrimary: boolean
  notes: string | null
}

interface ContactsSectionProps {
  clientId: string
  contacts: ContactItem[]
  canEdit: boolean
}

const fullName = (c: ContactItem) => [c.firstName, c.lastName].filter(Boolean).join(' ')

export const ContactsSection = ({ clientId, contacts, canEdit }: ContactsSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContactItem | null>(null)
  const [isPrimary, setIsPrimary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setIsPrimary(false)
    setError(null)
    setOpen(true)
  }
  const openEdit = (c: ContactItem) => {
    setEditing(c)
    setIsPrimary(c.isPrimary)
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      firstName: String(fd.get('firstName') ?? ''),
      lastName: String(fd.get('lastName') ?? ''),
      jobTitle: String(fd.get('jobTitle') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      mobile: String(fd.get('mobile') ?? ''),
      isPrimary,
      notes: String(fd.get('notes') ?? ''),
    }
    const res = editing
      ? await updateContactAction(editing.id, clientId, payload)
      : await createContactAction({ ...payload, clientId })

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
    await deleteContactAction(id, clientId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-5 py-3'>
        <h2 className='font-semibold'>Contacts ({contacts.length})</h2>
        {canEdit && (
          <Button size='sm' variant='outline' onClick={openCreate}>
            <Plus className='size-4' /> Ajouter
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun contact enregistré.</p>
      ) : (
        <ul className='divide-y'>
          {contacts.map((c) => (
            <li key={c.id} className='flex flex-wrap items-center gap-3 px-5 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='flex items-center gap-2 truncate text-sm font-medium'>
                  {fullName(c)}
                  {c.isPrimary && (
                    <Badge variant='secondary' size='sm'>
                      <Star className='size-3' /> Principal
                    </Badge>
                  )}
                </p>
                <p className='truncate text-xs text-muted-foreground'>
                  {[c.jobTitle, c.email, c.phone || c.mobile].filter(Boolean).join(' · ')}
                </p>
              </div>
              {canEdit && (
                <div className='flex shrink-0 gap-1'>
                  <Button
                    size='icon'
                    variant='ghost'
                    aria-label='Modifier le contact'
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
                          aria-label='Supprimer le contact'
                          disabled={busyId === c.id}
                        />
                      }
                    >
                      <Trash2 className='size-4 text-destructive-foreground' />
                    </AlertDialogTrigger>
                    <AlertDialogPopup>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {fullName(c)} sera retiré de ce client. Cette action est irréversible.
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
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le contact' : 'Nouveau contact'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogPanel className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='firstName'>Prénom</Label>
                  <Input
                    id='firstName'
                    name='firstName'
                    defaultValue={editing?.firstName ?? ''}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='lastName'>Nom</Label>
                  <Input id='lastName' name='lastName' defaultValue={editing?.lastName ?? ''} />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='jobTitle'>Fonction</Label>
                <Input id='jobTitle' name='jobTitle' defaultValue={editing?.jobTitle ?? ''} />
              </div>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input id='email' name='email' type='email' defaultValue={editing?.email ?? ''} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Téléphone</Label>
                  <Input id='phone' name='phone' defaultValue={editing?.phone ?? ''} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='mobile'>Mobile</Label>
                  <Input id='mobile' name='mobile' defaultValue={editing?.mobile ?? ''} />
                </div>
              </div>
              <Label className='flex items-center gap-2'>
                <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(Boolean(v))} />
                Contact principal
              </Label>
              <div className='space-y-2'>
                <Label htmlFor='contact-notes'>Notes</Label>
                <Textarea id='contact-notes' name='notes' defaultValue={editing?.notes ?? ''} />
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
