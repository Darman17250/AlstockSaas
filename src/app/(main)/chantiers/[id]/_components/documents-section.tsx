'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  FileIcon,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
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
import type { SiteDocumentItem } from '@/services/crm/site-document'
import { DOCUMENT_ACCEPT } from '@/validation/site-document'
import { deleteSiteDocumentAction } from '../../actions'

interface DocumentsSectionProps {
  siteId: string
  documents: SiteDocumentItem[]
  canEdit: boolean
  storageConfigured: boolean
}

const formatSize = (bytes: number | null): string => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const iconFor = (mime: string | null) => {
  if (!mime) return FileIcon
  if (mime.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf' || mime.startsWith('text/')) return FileText
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv')
    return FileSpreadsheet
  return FileIcon
}

const dateLabel = (d: Date) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export const DocumentsSection = ({
  siteId,
  documents,
  canEdit,
  storageConfigured,
}: DocumentsSectionProps) => {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/chantiers/${siteId}/documents`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? "Échec de l'envoi")
        }
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId)
    setError(null)
    const res = await deleteSiteDocumentAction(documentId, siteId)
    setDeletingId(null)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  return (
    <section className='space-y-3 rounded-lg border p-5'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='font-semibold'>Documents</h2>
        {canEdit && storageConfigured && (
          <>
            <input
              ref={inputRef}
              type='file'
              accept={DOCUMENT_ACCEPT}
              multiple
              className='hidden'
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              variant='outline'
              size='sm'
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Upload className='size-4' />
              )}
              Ajouter
            </Button>
          </>
        )}
      </div>

      {!storageConfigured && (
        <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
          Le stockage de fichiers n'est pas encore configuré.
        </p>
      )}

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      {documents.length === 0 ? (
        storageConfigured && (
          <p className='text-sm text-muted-foreground'>Aucun document. Images, PDF, Office…</p>
        )
      ) : (
        <ul className='divide-y'>
          {documents.map((doc) => {
            const Icon = iconFor(doc.mimeType)
            return (
              <li key={doc.id} className='flex items-center gap-3 py-2'>
                <Icon className='size-5 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{doc.fileName}</p>
                  <p className='text-xs text-muted-foreground'>
                    {[formatSize(doc.size), doc.uploadedByName, dateLabel(doc.createdAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <a
                  href={`/api/chantiers/documents/${doc.id}?download=1`}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent sm:size-7'
                >
                  <Download className='size-4' />
                  <span className='sr-only'>Télécharger {doc.fileName}</span>
                </a>
                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          aria-label='Supprimer'
                          disabled={deletingId === doc.id}
                        />
                      }
                    >
                      <Trash2 className='size-4' />
                    </AlertDialogTrigger>
                    <AlertDialogPopup>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          « {doc.fileName} » sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant='outline' />}>
                          Annuler
                        </AlertDialogClose>
                        <AlertDialogClose
                          render={<Button variant='destructive' />}
                          onClick={() => handleDelete(doc.id)}
                        >
                          Supprimer
                        </AlertDialogClose>
                      </AlertDialogFooter>
                    </AlertDialogPopup>
                  </AlertDialog>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
