import Link from 'next/link'
import { Plus, ShoppingCart, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { PURCHASE_STATUS_LABELS, formatCost } from '@/lib/crm/labels'
import { listPurchases } from '@/services/crm/purchase'

const formatDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(`${d}T00:00:00`)
      )
    : null

export default async function AchatsPage() {
  const ctx = await requireOrgContext()
  const purchases = await listPurchases(ctx)
  const canCreate = can(ctx.role, 'purchase', 'create')
  const canManageSuppliers = can(ctx.role, 'supplier', 'read')

  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Achats</h1>
          <p className='text-muted-foreground'>Commandes fournisseurs et réceptions de stock.</p>
        </div>
        <div className='flex gap-2'>
          {canManageSuppliers && (
            <Button variant='outline' render={<Link href='/achats/fournisseurs' />}>
              <Users className='size-4' /> Fournisseurs
            </Button>
          )}
          {canCreate && (
            <Button render={<Link href='/achats/nouveau' />}>
              <Plus className='size-4' /> Nouvel achat
            </Button>
          )}
        </div>
      </div>

      {purchases.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <ShoppingCart />
          </EmptyMedia>
          <EmptyTitle>Aucun achat pour le moment</EmptyTitle>
          <EmptyDescription>
            Créez un achat, puis validez-le pour réceptionner le stock.
          </EmptyDescription>
        </Empty>
      ) : (
        <ul className='divide-y rounded-lg border'>
          {purchases.map((p) => (
            <li key={p.id}>
              <Link
                href={`/achats/${p.id}`}
                className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
              >
                <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  <ShoppingCart className='size-4' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {p.reference ?? 'Achat sans référence'}
                  </p>
                  <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                    {p.supplierName && <span>{p.supplierName}</span>}
                    {p.orderDate && <span>{formatDate(p.orderDate)}</span>}
                    <span>
                      {p.lineCount} ligne{p.lineCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className='flex shrink-0 flex-col items-end gap-1'>
                  <Badge variant={p.status === 'validee' ? 'secondary' : 'outline'}>
                    {PURCHASE_STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                  <span className='text-sm font-medium'>{formatCost(p.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
