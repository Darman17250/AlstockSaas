import Link from 'next/link'
import { HardHat, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClientOptions } from '@/services/crm/client'
import { listSites } from '@/services/crm/site'
import { siteListParamsSchema } from '@/validation/site'
import { SitesFilters } from './_components/sites-filters'
import { SitesList } from './_components/sites-list'

interface ChantiersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ChantiersPage({ searchParams }: ChantiersPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = siteListParamsSchema.parse(sp)
  const [{ items, total, page, pageSize }, clients] = await Promise.all([
    listSites(ctx, params),
    listClientOptions(ctx),
  ])
  const canCreate = can(ctx.role, 'site', 'create')

  const hasFilters = Boolean(params.search || params.status || params.clientId)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    if (params.clientId) qs.set('clientId', params.clientId)
    qs.set('page', String(p))
    return `/chantiers?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Chantiers</h1>
          <p className='text-muted-foreground'>Suivi des chantiers par statut.</p>
        </div>
        {canCreate && (
          <Button render={<Link href='/chantiers/nouveau' />}>
            <Plus className='size-4' /> Nouveau
          </Button>
        )}
      </div>

      <div className='mb-4'>
        <SitesFilters clients={clients} />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <HardHat />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilters ? 'Aucun résultat' : 'Aucun chantier pour le moment'}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun chantier ne correspond à votre recherche.'
              : 'Créez un chantier ou convertissez une affaire gagnée.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <SitesList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} chantier{total > 1 ? 's' : ''}
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
