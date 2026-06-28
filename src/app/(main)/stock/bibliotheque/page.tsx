import Link from 'next/link'
import { ChevronLeft, Library } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDepotOptions } from '@/services/crm/depot'
import { browseLibrary, listLibraryTreeForOrg } from '@/services/crm/library'
import { libraryListParamsSchema } from '@/validation/library'
import { ProductFilters } from '../_components/product-filters'
import { LibraryBrowser } from './_components/library-browser'

interface BibliothequePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BibliothequePage({ searchParams }: BibliothequePageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = libraryListParamsSchema.parse(sp)

  const [{ items, total, page, pageSize }, tree, depots] = await Promise.all([
    browseLibrary(ctx, params),
    listLibraryTreeForOrg(ctx),
    listDepotOptions(ctx),
  ])

  const canAdd = can(ctx, 'product', 'create')
  const hasFilters = Boolean(params.search || params.categoryId || params.subcategoryId)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    if (params.subcategoryId) qs.set('subcategoryId', params.subcategoryId)
    qs.set('page', String(p))
    return `/stock/bibliotheque?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/stock' />}>
        <ChevronLeft className='size-4' /> Stock
      </Button>

      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Bibliothèque</h1>
        <p className='text-muted-foreground'>
          Catalogue de référence — ajoutez des produits à votre stock en un clic.
        </p>
      </div>

      <div className='mb-4'>
        <ProductFilters categories={tree} />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Library />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Catalogue vide'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun produit du catalogue ne correspond à votre recherche.'
              : "Le catalogue n'a pas encore été alimenté."}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <LibraryBrowser items={items} depots={depots} canAdd={canAdd} />
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
