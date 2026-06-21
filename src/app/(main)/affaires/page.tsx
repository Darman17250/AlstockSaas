import Link from 'next/link'
import { Briefcase, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listDeals, listDealsBoard } from '@/services/crm/deal'
import { dealListParamsSchema } from '@/validation/deal'
import { DealBoard } from './_components/deal-board'
import { DealFilters } from './_components/deal-filters'
import { DealsList } from './_components/deals-list'

interface AffairesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const TABS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'gagnees', label: 'Gagnées' },
  { key: 'perdues', label: 'Perdues' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default async function AffairesPage({ searchParams }: AffairesPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'pipeline'
  const canCreate = can(ctx.role, 'deal', 'create')
  const canCreateSite = can(ctx.role, 'site', 'create')
  const canEdit = can(ctx.role, 'deal', 'update')

  const tabHref = (key: TabKey) => (key === 'pipeline' ? '/affaires' : `/affaires?tab=${key}`)

  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Affaires</h1>
          <p className='text-muted-foreground'>Pipeline commercial et suivi des affaires.</p>
        </div>
        {canCreate && (
          <Button render={<Link href='/affaires/nouveau' />}>
            <Plus className='size-4' /> Nouvelle affaire
          </Button>
        )}
      </div>

      <div className='mb-6 flex gap-1 border-b'>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'pipeline' ? (
        <PipelineTab ctx={ctx} canEdit={canEdit} canCreateSite={canCreateSite} />
      ) : (
        <ClosedTab ctx={ctx} status={tab === 'gagnees' ? 'gagnee' : 'perdue'} sp={sp} />
      )}
    </div>
  )
}

async function PipelineTab({
  ctx,
  canEdit,
  canCreateSite,
}: {
  ctx: Awaited<ReturnType<typeof requireOrgContext>>
  canEdit: boolean
  canCreateSite: boolean
}) {
  const deals = await listDealsBoard(ctx)

  if (deals.length === 0) {
    return (
      <Empty className='border'>
        <EmptyMedia variant='icon'>
          <Briefcase />
        </EmptyMedia>
        <EmptyTitle>Aucune affaire en cours</EmptyTitle>
        <EmptyDescription>
          Créez votre première affaire pour alimenter le pipeline.
        </EmptyDescription>
      </Empty>
    )
  }

  return <DealBoard deals={deals} canEdit={canEdit} canCreateSite={canCreateSite} />
}

async function ClosedTab({
  ctx,
  status,
  sp,
}: {
  ctx: Awaited<ReturnType<typeof requireOrgContext>>
  status: 'gagnee' | 'perdue'
  sp: Record<string, string | string[] | undefined>
}) {
  const params = dealListParamsSchema.parse({ ...sp, status })
  const { items, total, page, pageSize } = await listDeals(ctx, params)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const label = status === 'gagnee' ? 'gagnée' : 'perdue'

  const pageHref = (p: number) => {
    const qs = new URLSearchParams()
    qs.set('tab', status === 'gagnee' ? 'gagnees' : 'perdues')
    if (params.search) qs.set('search', params.search)
    qs.set('page', String(p))
    return `/affaires?${qs.toString()}`
  }

  return (
    <>
      <div className='mb-4'>
        <DealFilters />
      </div>
      {items.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Briefcase />
          </EmptyMedia>
          <EmptyTitle>Aucune affaire {label}</EmptyTitle>
          <EmptyDescription>
            {params.search
              ? 'Aucune affaire ne correspond à votre recherche.'
              : `Les affaires marquées « ${label}s » apparaîtront ici.`}
          </EmptyDescription>
        </Empty>
      ) : (
        <>
          <DealsList items={items} />
          <div className='mt-4 flex items-center justify-between text-sm text-muted-foreground'>
            <span>
              {total} affaire{total > 1 ? 's' : ''}
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
    </>
  )
}
