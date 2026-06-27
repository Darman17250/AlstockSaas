'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Pencil, QrCode, Trash2 } from 'lucide-react'

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
import { deleteToolAction } from '../../actions'

interface ToolDetailActionsProps {
  toolId: string
  toolName: string
  canEdit: boolean
  canDelete: boolean
  canTransfer: boolean
}

export const ToolDetailActions = ({
  toolId,
  toolName,
  canEdit,
  canDelete,
  canTransfer,
}: ToolDetailActionsProps) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteToolAction(toolId)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.push('/materiel')
    router.refresh()
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {canTransfer && (
        <Button
          variant='outline'
          size='sm'
          render={<Link href={`/materiel/${toolId}/transfert`} />}
        >
          <ArrowLeftRight className='size-4' /> Transférer
        </Button>
      )}
      <Button variant='outline' size='sm' render={<Link href={`/materiel/${toolId}/etiquette`} />}>
        <QrCode className='size-4' /> Étiquette QR
      </Button>
      {canEdit && (
        <Button variant='outline' size='sm' render={<Link href={`/materiel/${toolId}/modifier`} />}>
          <Pencil className='size-4' /> Modifier
        </Button>
      )}
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant='destructive-outline' size='sm' disabled={busy} />}
          >
            <Trash2 className='size-4' /> Supprimer
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce matériel ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {toolName} » et son historique (entretiens, transferts, problèmes) seront
                archivés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant='outline' />}>Annuler</AlertDialogClose>
              <AlertDialogClose render={<Button variant='destructive' />} onClick={handleDelete}>
                Supprimer
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      )}
    </div>
  )
}
