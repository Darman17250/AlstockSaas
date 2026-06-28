import Link from 'next/link'
import { Boxes, FolderTree, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listProducts } from '@/services/crm/product'
import { listCategoriesTree } from '@/services/crm/product-category'
import { productListParamsSchema } from '@/validation/product'
import { PrintListBar } from './_components/print-list-controls'
import { ProductFilters } from './_components/product-filters'
import { ProductList } from './_components/product-list'

interface StockPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StockPage({ searchParams }: StockPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = productListParamsSchema.parse(sp)
  const { items, total, page, pageSize } = await listProducts(ctx, params)
  const categories = await listCategoriesTree(ctx)
  const canCreate = can(ctx, 'product', 'create')
  const canManageCategories = can(ctx, 'productCategory', 'read')

  const hasFilters = Boolean(params.search || params.categoryId || params.subcategoryId)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    if (params.subcategoryId) qs.set('subcategoryId', params.subcategoryId)
    qs.set('page', String(p))
    return `/stock?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Stock</h1>
          <p className='text-muted-foreground'>Produits consommables, dépôts et chantiers.</p>
        </div>
        <div className='flex gap-2'>
          <PrintListBar />
          {canManageCategories && (
            <Button variant='outline' render={<Link href='/stock/categories' />}>
              <FolderTree className='size-4' /> Catégories
            </Button>
          )}
          {canCreate && (
            <Button render={<Link href='/stock/nouveau' />}>
              <Plus className='size-4' /> Nouveau
            </Button>
          )}
        </div>
      </div>

      <div className='mb-4'>
        <ProductFilters categories={categories} />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Boxes />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Aucun produit pour le moment'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun produit ne correspond à votre recherche.'
              : 'Ajoutez votre premier produit au catalogue.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <ProductList items={items} />
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
