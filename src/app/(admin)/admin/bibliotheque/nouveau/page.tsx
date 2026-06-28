import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { listLibraryTree } from '@/services/admin/library'
import { LibraryProductForm } from '../_components/library-product-form'

export default async function NouveauLibraryProductPage() {
  const admin = await requirePlatformAdmin()
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
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouveau produit catalogue</h1>
      <LibraryProductForm
        mode='create'
        categories={categories}
        storageConfigured={isStorageConfigured()}
      />
    </div>
  )
}
