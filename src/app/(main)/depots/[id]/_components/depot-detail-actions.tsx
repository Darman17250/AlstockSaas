'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'

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
import { deleteDepotAction } from '../../actions'

interface DepotDetailActionsProps {
  depotId: string
  depotName: string
  canEdit: boolean
  canDelete: boolean
}

export const DepotDetailActions = ({
  depotId,
  depotName,
  canEdit,
  canDelete,
}: DepotDetailActionsProps) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteDepotAction(depotId)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.push('/depots')
    router.refresh()
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {canEdit && (
        <Button variant='outline' size='sm' render={<Link href={`/depots/${depotId}/modifier`} />}>
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
              <AlertDialogTitle>Supprimer ce dépôt ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {depotName} » et son historique d'entretien seront archivés.
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
