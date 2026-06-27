import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getProduct } from '@/services/crm/product'
import { listCategoriesTree } from '@/services/crm/product-category'
import { ProductForm } from '../../_components/product-form'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'product', 'update')) redirect('/stock')
  const { id } = await params

  let product: Awaited<ReturnType<typeof getProduct>>
  try {
    product = await getProduct(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const tree = await listCategoriesTree(ctx)
  const categories = tree.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
  }))

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/stock/${id}`} />}>
        <ChevronLeft className='size-4' /> {product.title}
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le produit</h1>
      <ProductForm
        mode='edit'
        productId={id}
        categories={categories}
        depots={[]}
        storageConfigured={isStorageConfigured()}
        hasImage={Boolean(product.imagePath)}
        initial={{
          title: product.title,
          categoryId: product.categoryId,
          subcategoryId: product.subcategoryId,
          unit: product.unit,
          description: product.description,
          alertThreshold: product.alertThreshold,
        }}
      />
    </div>
  )
}
