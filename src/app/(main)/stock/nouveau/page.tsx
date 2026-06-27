import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDepotOptions } from '@/services/crm/depot'
import { listCategoriesTree } from '@/services/crm/product-category'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { ProductForm } from '../_components/product-form'

export default async function NouveauProduitPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'product', 'create')) redirect('/stock')

  const [tree, depots] = await Promise.all([listCategoriesTree(ctx), listDepotOptions(ctx)])
  const categories = tree.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
  }))

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/stock' />}>
        <ChevronLeft className='size-4' /> Stock
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau produit</h1>
      <ProductForm
        mode='create'
        categories={categories}
        depots={depots}
        storageConfigured={isStorageConfigured()}
      />
    </div>
  )
}
