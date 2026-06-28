import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listCategoriesTree } from '@/services/crm/product-category'
import { CategoriesManager } from './_components/categories-manager'

export default async function CategoriesPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'productCategory', 'read')) redirect('/stock')

  const categories = await listCategoriesTree(ctx)
  const canManage = can(ctx, 'productCategory', 'create')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/stock' />}>
        <ChevronLeft className='size-4' /> Stock
      </Button>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Catégories</h1>
        <p className='text-muted-foreground'>
          Organisez vos produits par catégorie et sous-catégorie.
        </p>
      </div>
      <CategoriesManager categories={categories} canManage={canManage} />
    </div>
  )
}
