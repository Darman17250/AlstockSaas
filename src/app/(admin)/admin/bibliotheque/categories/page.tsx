import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { listLibraryTree } from '@/services/admin/library'
import { LibraryCategoriesManager } from '../_components/library-categories-manager'

export default async function AdminLibraryCategoriesPage() {
  const admin = await requirePlatformAdmin()
  const categories = await listLibraryTree(admin)

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/admin/bibliotheque' />}>
        <ChevronLeft className='size-4' /> Bibliothèque
      </Button>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Catégories du catalogue</h1>
        <p className='text-muted-foreground'>
          Organisation des produits de la bibliothèque partagée.
        </p>
      </div>
      <LibraryCategoriesManager categories={categories} />
    </div>
  )
}
