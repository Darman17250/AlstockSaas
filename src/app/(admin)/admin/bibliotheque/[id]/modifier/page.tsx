import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError } from '@/lib/auth/org-context'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getLibraryProductAdmin, listLibraryTree } from '@/services/admin/library'
import { LibraryProductForm } from '../../_components/library-product-form'

interface ModifierLibraryProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ModifierLibraryProductPage({
  params,
}: ModifierLibraryProductPageProps) {
  const admin = await requirePlatformAdmin()
  const { id } = await params

  const product = await getLibraryProductAdmin(admin, id).catch((e) => {
    if (e instanceof NotFoundError) notFound()
    throw e
  })

  const tree = await listLibraryTree(admin)
  const categories = tree.map((c) => ({
    id: c.id,
    name: c.name,
    subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
  }))

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/admin/bibliotheque' />}>
        <ChevronLeft className='size-4' /> Bibliothèque
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier le produit</h1>
      <LibraryProductForm
        mode='edit'
        productId={product.id}
        categories={categories}
        storageConfigured={isStorageConfigured()}
        hasImage={Boolean(product.imagePath)}
        initial={{
          title: product.title,
          categoryId: product.categoryId,
          subcategoryId: product.subcategoryId,
          unit: product.unit,
          description: product.description,
        }}
      />
    </div>
  )
}
