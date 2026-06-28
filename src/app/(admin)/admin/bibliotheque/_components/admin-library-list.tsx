'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Package, Pencil, Trash2 } from 'lucide-react'

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
import { PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import type { LibraryProductListItem } from '@/services/admin/library'
import { deleteLibraryProductAction } from '../actions'

interface AdminLibraryListProps {
  items: LibraryProductListItem[]
}

export const AdminLibraryList = ({ items }: AdminLibraryListProps) => {
  const router = useRouter()
  const [target, setTarget] = useState<LibraryProductListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!target) return
    setDeleting(true)
    setError(null)
    const res = await deleteLibraryProductAction(target.id)
    setDeleting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTarget(null)
    router.refresh()
  }

  return (
    <>
      <ul className='divide-y rounded-lg border'>
        {items.map((p) => (
          <li key={p.id} className='flex items-center gap-3 px-3 py-3'>
            <div className='flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground'>
              {p.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/biblio/${p.id}/image`}
                  alt=''
                  loading='lazy'
                  className='size-full object-cover'
                />
              ) : (
                <Package className='size-5' />
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{p.title}</p>
              <div className='mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground'>
                {p.categoryName && <span>{p.categoryName}</span>}
                {p.subcategoryName && <span>· {p.subcategoryName}</span>}
                <span>· {PRODUCT_UNIT_LABELS[p.unit] ?? p.unit}</span>
              </div>
            </div>
            <Button
              variant='ghost'
              size='icon'
              render={<Link href={`/admin/bibliotheque/${p.id}/modifier`} />}
              aria-label='Modifier'
            >
              <Pencil className='size-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setTarget(p)}
              aria-label='Supprimer'
            >
              <Trash2 className='size-4' />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => !open && !deleting && setTarget(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {target?.title} » sera retiré du catalogue. Les produits déjà copiés dans les
              organisations ne sont pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant='outline' />} disabled={deleting}>
              Annuler
            </AlertDialogClose>
            <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className='size-4 animate-spin' /> : 'Supprimer'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  )
}
