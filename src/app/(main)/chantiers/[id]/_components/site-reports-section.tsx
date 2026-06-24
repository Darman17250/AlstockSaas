'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudSun, ImagePlus, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'

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
import { WEATHER_LABELS, WEATHER_VALUES } from '@/lib/crm/labels'
import type { SiteReportItem } from '@/services/crm/site-report'
import {
  createSiteReportAction,
  deleteSiteReportAction,
  deleteSiteReportPhotoAction,
  updateSiteReportAction,
} from '../../actions'

interface SiteReportsSectionProps {
  siteId: string
  reports: SiteReportItem[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  storageConfigured: boolean
}

const NONE = '__none__'
const todayKey = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const formatDate = (key: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }).format(
    new Date(`${key}T00:00:00`)
  )

export const SiteReportsSection = ({
  siteId,
  reports,
  canCreate,
  canUpdate,
  canDelete,
  storageConfigured,
}: SiteReportsSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SiteReportItem | null>(null)
  const [weather, setWeather] = useState<string>(NONE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const uploadReportId = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setWeather(editing?.weather ?? NONE)
    setError(null)
  }, [open, editing])

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (r: SiteReportItem) => {
    setEditing(r)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      reportDate: String(fd.get('reportDate') ?? ''),
      weather: weather !== NONE ? weather : undefined,
      temperature: String(fd.get('temperature') ?? ''),
      workforceCount: String(fd.get('workforceCount') ?? ''),
      progressNotes: String(fd.get('progressNotes') ?? ''),
      issues: String(fd.get('issues') ?? ''),
    }
    const res = editing
      ? await updateSiteReportAction(editing.id, siteId, payload)
      : await createSiteReportAction({ ...payload, siteId })

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setOpen(false)
    router.refresh()
  }

  const handleDeleteReport = async (id: string) => {
    await deleteSiteReportAction(id, siteId)
    router.refresh()
  }

  const triggerUpload = (reportId: string) => {
    uploadReportId.current = reportId
    fileRef.current?.click()
  }

  const handlePhotos = async (files: FileList | null) => {
    const reportId = uploadReportId.current
    if (!files || files.length === 0 || !reportId) return
    setUploadingId(reportId)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/chantiers/reports/${reportId}/photos`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          const b = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(b?.error ?? "Échec de l'envoi")
        }
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi")
    } finally {
      setUploadingId(null)
      uploadReportId.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    await deleteSiteReportPhotoAction(photoId, siteId)
    router.refresh()
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-5 py-3'>
        <h2 className='font-semibold'>Rapports de chantier ({reports.length})</h2>
        {canCreate && (
          <Button size='sm' variant='outline' onClick={openCreate}>
            <Plus className='size-4' /> Rapport du jour
          </Button>
        )}
      </div>

      {canUpdate && storageConfigured && (
        <input
          ref={fileRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={(e) => handlePhotos(e.target.files)}
        />
      )}

      {error && <p className='px-5 pt-3 text-sm text-destructive-foreground'>{error}</p>}

      {reports.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun rapport pour ce chantier.</p>
      ) : (
        <ul className='divide-y'>
          {reports.map((r) => (
            <li key={r.id} className='space-y-2 px-5 py-4'>
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <div>
                  <p className='font-medium capitalize'>{formatDate(r.reportDate)}</p>
                  <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                    {r.weather && (
                      <span className='inline-flex items-center gap-1'>
                        <CloudSun className='size-3' /> {WEATHER_LABELS[r.weather] ?? r.weather}
                        {r.temperature !== null ? ` · ${r.temperature}°C` : ''}
                      </span>
                    )}
                    {r.workforceCount !== null && (
                      <span className='inline-flex items-center gap-1'>
                        <Users className='size-3' /> {r.workforceCount}
                      </span>
                    )}
                    {r.authorName && <span>par {r.authorName}</span>}
                  </div>
                </div>
                <div className='flex shrink-0 gap-1'>
                  {canUpdate && storageConfigured && (
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label='Ajouter une photo'
                      disabled={uploadingId === r.id}
                      onClick={() => triggerUpload(r.id)}
                    >
                      {uploadingId === r.id ? (
                        <Loader2 className='size-4 animate-spin' />
                      ) : (
                        <ImagePlus className='size-4' />
                      )}
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      aria-label='Modifier le rapport'
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className='size-4' />
                    </Button>
                  )}
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button size='icon-sm' variant='ghost' aria-label='Supprimer le rapport' />
                        }
                      >
                        <Trash2 className='size-4 text-destructive-foreground' />
                      </AlertDialogTrigger>
                      <AlertDialogPopup>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Le rapport du {formatDate(r.reportDate)} sera archivé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogClose render={<Button variant='outline' />}>
                            Annuler
                          </AlertDialogClose>
                          <AlertDialogClose
                            render={<Button variant='destructive' />}
                            onClick={() => handleDeleteReport(r.id)}
                          >
                            Supprimer
                          </AlertDialogClose>
                        </AlertDialogFooter>
                      </AlertDialogPopup>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {r.progressNotes && (
                <p className='whitespace-pre-wrap text-sm'>{r.progressNotes}</p>
              )}
              {r.issues && (
                <p className='whitespace-pre-wrap text-sm text-destructive-foreground'>
                  <span className='font-medium'>Aléas : </span>
                  {r.issues}
                </p>
              )}

              {r.photos.length > 0 && (
                <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                  {r.photos.map((p) => (
                    <div key={p.id} className='group relative overflow-hidden rounded-md border'>
                      {/* photo privée servie via URL signée */}
                      <img
                        src={`/api/chantiers/reports/photos/${p.id}`}
                        alt={p.caption ?? 'Photo de chantier'}
                        loading='lazy'
                        className='aspect-square w-full object-cover'
                      />
                      {canUpdate && (
                        <Button
                          variant='destructive'
                          size='icon-sm'
                          aria-label='Supprimer la photo'
                          className='absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100'
                          onClick={() => handleDeletePhoto(p.id)}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier le rapport' : 'Rapport du jour'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
            <DialogPanel className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='reportDate'>Date</Label>
                  <Input
                    id='reportDate'
                    name='reportDate'
                    type='date'
                    defaultValue={editing?.reportDate ?? todayKey()}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label>Météo</Label>
                  <Select value={weather} onValueChange={(v) => setWeather(v ?? NONE)}>
                    <SelectTrigger>
                      <SelectValue>
                        {(value) =>
                          value === NONE ? '— Non précisée' : (WEATHER_LABELS[value as string] ?? '')
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— Non précisée</SelectItem>
                      {WEATHER_VALUES.map((w) => (
                        <SelectItem key={w} value={w}>
                          {WEATHER_LABELS[w]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='temperature'>Température (°C)</Label>
                  <Input
                    id='temperature'
                    name='temperature'
                    type='number'
                    inputMode='numeric'
                    defaultValue={editing?.temperature ?? ''}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='workforceCount'>Effectif présent</Label>
                  <Input
                    id='workforceCount'
                    name='workforceCount'
                    type='number'
                    min='0'
                    inputMode='numeric'
                    defaultValue={editing?.workforceCount ?? ''}
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='progressNotes'>Travaux réalisés / avancement</Label>
                <Textarea
                  id='progressNotes'
                  name='progressNotes'
                  defaultValue={editing?.progressNotes ?? ''}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='issues'>Aléas / problèmes</Label>
                <Textarea id='issues' name='issues' defaultValue={editing?.issues ?? ''} />
              </div>
              {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
              {!editing && (
                <p className='text-xs text-muted-foreground'>
                  Les photos s'ajoutent depuis le rapport une fois créé.
                </p>
              )}
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
