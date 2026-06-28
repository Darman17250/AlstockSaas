'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'

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
import { habilitationTypeEnum } from '@/database/schema'
import { HABILITATION_STATUS_LABELS, HABILITATION_TYPE_LABELS } from '@/lib/crm/labels'
import type { HabilitationItem } from '@/services/org/habilitation'
import { DOCUMENT_ACCEPT } from '@/validation/deal-document'
import { deleteHabilitationAction } from '../../actions'

interface SectionProps {
  memberId: string
  habilitations: HabilitationItem[]
  canWrite: boolean
  storageConfigured: boolean
}

const STATUS_DOT: Record<string, string> = {
  valide: 'bg-green-500',
  expire_bientot: 'bg-amber-500',
  expiree: 'bg-red-500',
}

const STATUS_TEXT: Record<string, string> = {
  valide: 'text-green-700',
  expire_bientot: 'text-amber-700',
  expiree: 'text-red-600',
}

const dateLabel = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(`${d}T00:00:00`)
      )
    : null

export const MemberHabilitationsSection = ({
  memberId,
  habilitations,
  canWrite,
  storageConfigured,
}: SectionProps) => {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<HabilitationItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (h: HabilitationItem) => {
    setEditing(h)
    setDialogOpen(true)
  }

  const handleDelete = async (habId: string) => {
    setDeletingId(habId)
    setError(null)
    const res = await deleteHabilitationAction(habId, memberId)
    setDeletingId(null)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  return (
    <section className='space-y-3 rounded-lg border p-5'>
      <div className='flex items-center justify-between'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <ShieldCheck className='size-4' /> Habilitations
        </h2>
        {canWrite && (
          <Button size='sm' onClick={openCreate}>
            <Plus className='size-4' /> Ajouter
          </Button>
        )}
      </div>

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      {habilitations.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Aucune habilitation. CACES, travail en hauteur, habilitation électrique…
        </p>
      ) : (
        <ul className='divide-y'>
          {habilitations.map((h) => (
            <li key={h.id} className='flex flex-wrap items-center gap-3 py-3'>
              <span
                className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[h.status]}`}
                aria-hidden
              />
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='truncate text-sm font-medium'>{h.name}</p>
                  <Badge variant='secondary' size='sm'>
                    {HABILITATION_TYPE_LABELS[h.type] ?? h.type}
                  </Badge>
                  <span className={`text-xs font-medium ${STATUS_TEXT[h.status]}`}>
                    {HABILITATION_STATUS_LABELS[h.status]}
                  </span>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {[
                    h.issuer,
                    h.reference && `n° ${h.reference}`,
                    h.expiresAt && `expire le ${dateLabel(h.expiresAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {h.hasDocument && (
                <a
                  href={`/api/members/habilitations/${h.id}/document?download=1`}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent'
                >
                  <Download className='size-4' />
                  <span className='sr-only'>Télécharger {h.name}</span>
                </a>
              )}
              {canWrite && (
                <>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Modifier'
                    onClick={() => openEdit(h)}
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
                          aria-label='Supprimer'
                          disabled={deletingId === h.id}
                        />
                      }
                    >
                      <Trash2 className='size-4 text-red-500' />
                    </AlertDialogTrigger>
                    <AlertDialogPopup>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette habilitation ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          « {h.name} » et son document seront définitivement supprimés.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant='outline' />}>
                          Annuler
                        </AlertDialogClose>
                        <AlertDialogClose
                          render={<Button variant='destructive' />}
                          onClick={() => handleDelete(h.id)}
                        >
                          Supprimer
                        </AlertDialogClose>
                      </AlertDialogFooter>
                    </AlertDialogPopup>
                  </AlertDialog>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <HabilitationFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          memberId={memberId}
          habilitation={editing}
          storageConfigured={storageConfigured}
        />
      )}
    </section>
  )
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  habilitation: HabilitationItem | null
  storageConfigured: boolean
}

const HabilitationFormDialog = ({
  open,
  onOpenChange,
  memberId,
  habilitation,
  storageConfigured,
}: FormDialogProps) => {
  const router = useRouter()
  const [type, setType] = useState<string>(habilitation?.type ?? 'caces')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setType(habilitation?.type ?? 'caces')
      setError(null)
    }
  }, [open, habilitation])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    // Champ fichier vide → ne pas envoyer.
    const file = fd.get('file')
    if (file instanceof File && file.size === 0) fd.delete('file')

    const url = habilitation
      ? `/api/members/${memberId}/habilitations/${habilitation.id}`
      : `/api/members/${memberId}/habilitations`
    try {
      const res = await fetch(url, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Échec de l'enregistrement")
      }
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {habilitation ? "Modifier l'habilitation" : 'Nouvelle habilitation'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
          <DialogPanel className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? 'caces')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => HABILITATION_TYPE_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {habilitationTypeEnum.enumValues.map((t) => (
                      <SelectItem key={t} value={t}>
                        {HABILITATION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='hab-name'>Libellé</Label>
                <Input
                  id='hab-name'
                  name='name'
                  defaultValue={habilitation?.name ?? ''}
                  placeholder='CACES R489 cat. 3'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='hab-issuer'>Organisme</Label>
                <Input
                  id='hab-issuer'
                  name='issuer'
                  defaultValue={habilitation?.issuer ?? ''}
                  placeholder='AFTRAL, APAVE…'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='hab-reference'>N° de certificat</Label>
                <Input
                  id='hab-reference'
                  name='reference'
                  defaultValue={habilitation?.reference ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='hab-issuedAt'>Date d'obtention</Label>
                <Input
                  id='hab-issuedAt'
                  name='issuedAt'
                  type='date'
                  defaultValue={habilitation?.issuedAt ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='hab-expiresAt'>Date d'expiration</Label>
                <Input
                  id='hab-expiresAt'
                  name='expiresAt'
                  type='date'
                  defaultValue={habilitation?.expiresAt ?? ''}
                />
              </div>
            </div>

            {storageConfigured ? (
              <div className='space-y-2'>
                <Label htmlFor='hab-file'>
                  Document {habilitation?.hasDocument && '(remplace le fichier actuel)'}
                </Label>
                <Input id='hab-file' name='file' type='file' accept={DOCUMENT_ACCEPT} />
              </div>
            ) : (
              <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
                Le stockage de fichiers n'est pas configuré : seules les métadonnées seront
                enregistrées.
              </p>
            )}

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
  )
}
