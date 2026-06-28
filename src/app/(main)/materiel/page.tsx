import Link from 'next/link'
import { Plus, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDepotOptions } from '@/services/crm/depot'
import { listSiteOptions } from '@/services/crm/site'
import { listTools } from '@/services/crm/tool'
import { toolListParamsSchema } from '@/validation/tool'
import { MaterielFilters } from './_components/materiel-filters'
import { MaterielList } from './_components/materiel-list'

interface MaterielPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MaterielPage({ searchParams }: MaterielPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = toolListParamsSchema.parse(sp)
  const { items, total, page, pageSize } = await listTools(ctx, params)
  const canCreate = can(ctx, 'tool', 'create')

  const [depots, sites] = await Promise.all([listDepotOptions(ctx), listSiteOptions(ctx)])

  const hasFilters = Boolean(
    params.search ||
      params.kind ||
      params.status ||
      params.category ||
      params.depotId ||
      params.siteId
  )
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.kind) qs.set('kind', params.kind)
    if (params.status) qs.set('status', params.status)
    if (params.category) qs.set('category', params.category)
    if (params.depotId) qs.set('depotId', params.depotId)
    if (params.siteId) qs.set('siteId', params.siteId)
    qs.set('page', String(p))
    return `/materiel?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Matériel</h1>
          <p className='text-muted-foreground'>Outillage et machines de l'entreprise.</p>
        </div>
        {canCreate && (
          <Button render={<Link href='/materiel/nouveau' />}>
            <Plus className='size-4' /> Nouveau
          </Button>
        )}
      </div>

      <div className='mb-4'>
        <MaterielFilters depots={depots} sites={sites} />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Wrench />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Aucun matériel pour le moment'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun matériel ne correspond à votre recherche.'
              : 'Ajoutez une perceuse, une nacelle, une pelleteuse…'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <MaterielList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} matériel{total > 1 ? 's' : ''}
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
