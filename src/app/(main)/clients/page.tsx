import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listClients } from '@/services/crm/client'
import { clientListParamsSchema } from '@/validation/client'
import { ClientsFilters } from './_components/clients-filters'
import { ClientsList } from './_components/clients-list'

interface ClientsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const params = clientListParamsSchema.parse(sp)
  const { items, total, page, pageSize } = await listClients(ctx, params)
  const canCreate = can(ctx.role, 'client', 'create')

  const hasFilters = Boolean(params.search || params.type || params.relationType)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.type) qs.set('type', params.type)
    if (params.relationType) qs.set('relationType', params.relationType)
    qs.set('page', String(p))
    return `/clients?${qs.toString()}`
  }

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Clients</h1>
          <p className='text-muted-foreground'>
            Sociétés et particuliers, clients et prestataires.
          </p>
        </div>
        {canCreate && (
          <Button render={<Link href='/clients/nouveau' />}>
            <Plus className='size-4' /> Nouveau
          </Button>
        )}
      </div>

      <div className='mb-4'>
        <ClientsFilters />
      </div>

      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Users />
          </EmptyMedia>
          <EmptyTitle>{hasFilters ? 'Aucun résultat' : 'Aucun client pour le moment'}</EmptyTitle>
          <EmptyDescription>
            {hasFilters
              ? 'Aucun client ne correspond à votre recherche.'
              : 'Créez votre premier client pour commencer.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <ClientsList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} client{total > 1 ? 's' : ''}
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
