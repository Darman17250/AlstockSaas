import Link from 'next/link'
import { Plus, Warehouse } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDepots } from '@/services/crm/depot'
import { depotListParamsSchema } from '@/validation/depot'
import { DepotsFilters } from './_components/depots-filters'
import { DepotsList } from './_components/depots-list'

interface DepotsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DepotsPage({ searchParams }: DepotsPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = depotListParamsSchema.parse(sp)
  const { items, total, page, pageSize } = await listDepots(ctx, params)
  const canCreate = can(ctx, 'depot', 'create')

  const hasFilters = Boolean(params.search || params.type)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.type) qs.set('type', params.type)
    qs.set('page', String(p))
    return `/depots?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Dépôts</h1>
          <p className='text-muted-foreground'>Entrepôts, ateliers et véhicules de l'entreprise.</p>
        </div>
        {canCreate && (
          <Button render={<Link href='/depots/nouveau' />}>
            <Plus className='size-4' /> Nouveau
          </Button>
        )}
      </div>

      <div className='mb-4'>
        <DepotsFilters />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Warehouse />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Aucun dépôt pour le moment'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun dépôt ne correspond à votre recherche.'
              : 'Créez un entrepôt, un atelier ou un véhicule.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <DepotsList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} dépôt{total > 1 ? 's' : ''}
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
