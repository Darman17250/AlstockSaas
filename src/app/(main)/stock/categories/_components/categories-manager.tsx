'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, FolderTree, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'

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
import type { CategoryWithSubcategories } from '@/services/crm/product-category'
import {
  createCategoryAction,
  createSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from '../actions'

interface CategoriesManagerProps {
  categories: CategoryWithSubcategories[]
  canManage: boolean
}

type DialogState =
  | { kind: 'category'; id?: string; name: string }
  | { kind: 'subcategory'; id?: string; categoryId: string; name: string }
  | null

export const CategoriesManager = ({ categories, canManage }: CategoriesManagerProps) => {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = (state: NonNullable<DialogState>) => {
    setError(null)
    setName(state.name)
    setDialog(state)
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!dialog) return
    setBusy(true)
    setError(null)
    const trimmed = name.trim()

    let res: { ok: boolean; error?: string }
    if (dialog.kind === 'category') {
      res = dialog.id
        ? await updateCategoryAction(dialog.id, { name: trimmed })
        : await createCategoryAction({ name: trimmed })
    } else {
      res = dialog.id
        ? await updateSubcategoryAction(dialog.id, { name: trimmed })
        : await createSubcategoryAction({ categoryId: dialog.categoryId, name: trimmed })
    }

    if (!res.ok) {
      setError(res.error ?? 'Erreur')
      setBusy(false)
      return
    }
    setBusy(false)
    setDialog(null)
    router.refresh()
  }

  const remove = async (kind: 'category' | 'subcategory', id: string) => {
    const res =
      kind === 'category' ? await deleteCategoryAction(id) : await deleteSubcategoryAction(id)
    if (!res.ok) {
      window.alert(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className='space-y-4'>
      {canManage && (
        <Button onClick={() => open({ kind: 'category', name: '' })}>
          <Plus className='size-4' /> Nouvelle catégorie
        </Button>
      )}

      {categories.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground'>
          <FolderTree className='size-6' />
          <p className='text-sm'>Aucune catégorie. Créez-en une pour organiser vos produits.</p>
        </div>
      ) : (
        <ul className='space-y-3'>
          {categories.map((cat) => (
            <li key={cat.id} className='rounded-lg border'>
              <div className='flex items-center justify-between gap-2 border-b p-3'>
                <div className='min-w-0'>
                  <p className='truncate font-medium'>{cat.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {cat.subcategories.length} sous-catégorie
                    {cat.subcategories.length > 1 ? 's' : ''} · {cat.productCount} produit
                    {cat.productCount > 1 ? 's' : ''}
                  </p>
                </div>
                {canManage && (
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => open({ kind: 'category', id: cat.id, name: cat.name })}
                    >
                      <Pencil className='size-4' />
                    </Button>
                    <Button variant='ghost' size='icon' onClick={() => remove('category', cat.id)}>
                      <Trash2 className='size-4' />
                    </Button>
                  </div>
                )}
              </div>

              <ul className='divide-y'>
                {cat.subcategories.map((sub) => (
                  <li key={sub.id} className='flex items-center justify-between gap-2 px-3 py-2'>
                    <span className='inline-flex min-w-0 items-center gap-1.5 text-sm'>
                      <ChevronRight className='size-3.5 shrink-0 text-muted-foreground' />
                      <span className='truncate'>{sub.name}</span>
                      <span className='shrink-0 text-xs text-muted-foreground'>
                        ({sub.productCount})
                      </span>
                    </span>
                    {canManage && (
                      <div className='flex shrink-0 gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() =>
                            open({
                              kind: 'subcategory',
                              id: sub.id,
                              categoryId: cat.id,
                              name: sub.name,
                            })
                          }
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => remove('subcategory', sub.id)}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
                {canManage && (
                  <li className='px-3 py-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => open({ kind: 'subcategory', categoryId: cat.id, name: '' })}
                    >
                      <Plus className='size-4' /> Sous-catégorie
                    </Button>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {dialog?.id ? 'Renommer' : 'Nouvelle'}{' '}
              {dialog?.kind === 'subcategory' ? 'sous-catégorie' : 'catégorie'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit}>
            <DialogPanel className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='cat-name'>Nom</Label>
                <Input
                  id='cat-name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
              <Button type='submit' disabled={busy || !name.trim()}>
                {busy ? <Loader2 className='size-4 animate-spin' /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
