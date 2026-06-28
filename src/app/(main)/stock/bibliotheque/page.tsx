import Link from 'next/link'
import { ChevronLeft, Library } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listLibraryCatalog } from '@/services/crm/library'
import { LibraryCatalog } from './_components/library-catalog'

export default async function BibliothequePage() {
  const ctx = await requireOrgContext()
  const tree = await listLibraryCatalog(ctx)
  const canAdd = can(ctx, 'product', 'create')

  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/stock' />}>
        <ChevronLeft className='size-4' /> Stock
      </Button>

      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Bibliothèque</h1>
        <p className='text-muted-foreground'>
          Catalogue de référence par catégories. Cochez des catégories, sous-catégories ou produits,
          puis ajoutez la sélection à votre stock.
        </p>
      </div>

      {tree.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Library />
          </EmptyMedia>
          <EmptyTitle>Catalogue vide</EmptyTitle>
          <EmptyDescription>Le catalogue n'a pas encore été alimenté.</EmptyDescription>
        </Empty>
      ) : (
        <LibraryCatalog tree={tree} canAdd={canAdd} />
      )}
    </div>
  )
}
