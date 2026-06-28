import Link from 'next/link'
import { FolderTree, Library, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { listLibraryProductsAdmin, listLibraryTree } from '@/services/admin/library'
import { libraryListParamsSchema } from '@/validation/library'
import { ProductFilters } from '../../../(main)/stock/_components/product-filters'
import { AdminLibraryList } from './_components/admin-library-list'

interface AdminLibraryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminLibraryPage({ searchParams }: AdminLibraryPageProps) {
  const admin = await requirePlatformAdmin()
  const sp = await searchParams
  const params = libraryListParamsSchema.parse(sp)

  const [{ items, total, page, pageSize }, tree] = await Promise.all([
    listLibraryProductsAdmin(admin, params),
    listLibraryTree(admin),
  ])

  const filterTree = tree.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
  }))

  const hasFilters = Boolean(params.search || params.categoryId || params.subcategoryId)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    if (params.subcategoryId) qs.set('subcategoryId', params.subcategoryId)
    qs.set('page', String(p))
    return `/admin/bibliotheque?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Bibliothèque catalogue</h1>
          <p className='text-muted-foreground'>
            Catalogue de référence partagé avec toutes les organisations.
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' render={<Link href='/admin/bibliotheque/categories' />}>
            <FolderTree className='size-4' /> Catégories
          </Button>
          <Button render={<Link href='/admin/bibliotheque/nouveau' />}>
            <Plus className='size-4' /> Nouveau
          </Button>
        </div>
      </div>

      <div className='mb-4'>
        <ProductFilters categories={filterTree} />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Library />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Catalogue vide'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun produit ne correspond à votre recherche.'
              : 'Ajoutez le premier produit du catalogue, ou importez la bibliothèque.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <AdminLibraryList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} produit{total > 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  render={page > 1 ? <Link href={pageHref(page - 1)} /> : <button />}
                >
                  Précédent
                </Button>
                <span>
                  {page} / {totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  render={page < totalPages ? <Link href={pageHref(page + 1)} /> : <button />}
                >
                  Suivant
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
