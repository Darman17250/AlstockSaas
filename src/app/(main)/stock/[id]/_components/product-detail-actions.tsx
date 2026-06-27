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
import { deleteProductAction } from '../../actions'

interface ProductDetailActionsProps {
  productId: string
  productTitle: string
  canEdit: boolean
  canDelete: boolean
}

export const ProductDetailActions = ({
  productId,
  productTitle,
  canEdit,
  canDelete,
}: ProductDetailActionsProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    const res = await deleteProductAction(productId)
    if (!res.ok) {
      setError(res.error)
      setDeleting(false)
      return
    }
    router.push('/stock')
    router.refresh()
  }

  return (
    <div className='flex gap-2'>
      {canEdit && (
        <Button variant='outline' size='sm' render={<Link href={`/stock/${productId}/modifier`} />}>
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
                <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
                <AlertDialogDescription>
                  « {productTitle} » sera supprimé du catalogue. Cette action est possible
                  uniquement s'il ne reste aucun stock.
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
