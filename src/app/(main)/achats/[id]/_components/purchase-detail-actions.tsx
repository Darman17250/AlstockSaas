'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deletePurchaseAction } from '../../actions'

interface PurchaseDetailActionsProps {
  purchaseId: string
  isDraft: boolean
  canEdit: boolean
  canDelete: boolean
}

export const PurchaseDetailActions = ({
  purchaseId,
  isDraft,
  canEdit,
  canDelete,
}: PurchaseDetailActionsProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    const res = await deletePurchaseAction(purchaseId)
    if (!res.ok) {
      setError(res.error)
      setDeleting(false)
      return
    }
    router.push('/achats')
    router.refresh()
  }

  return (
    <div className='flex gap-2'>
      {canEdit && isDraft && (
        <Button
          variant='outline'
          size='sm'
          render={<Link href={`/achats/${purchaseId}/modifier`} />}
        >
          <Pencil className='size-4' /> Modifier
        </Button>
      )}
      {canDelete && (
        <>
          <Button variant='outline' size='sm' onClick={() => setOpen(true)}>
            <Trash2 className='size-4' />
          </Button>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogPopup>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet achat ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Un achat validé (réceptionné) ne peut pas être supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant='outline' />}>Annuler</AlertDialogClose>
                <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className='size-4 animate-spin' /> : 'Supprimer'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogPopup>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
