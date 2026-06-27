import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ShoppingCart } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { PURCHASE_STATUS_LABELS, formatCost, formatQuantity } from '@/lib/crm/labels'
import { listDepotOptions } from '@/services/crm/depot'
import { getPurchase } from '@/services/crm/purchase'
import { listSiteOptions } from '@/services/crm/site'
import { PurchaseDetailActions } from './_components/purchase-detail-actions'
import { PurchaseValidateDialog } from './_components/purchase-validate-dialog'

interface PurchasePageProps {
  params: Promise<{ id: string }>
}

const formatDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(`${d}T00:00:00`)
      )
    : null

export default async function PurchaseDetailPage({ params }: PurchasePageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let purchase: Awaited<ReturnType<typeof getPurchase>>
  try {
    purchase = await getPurchase(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const isDraft = purchase.status === 'brouillon'
  const canEdit = can(ctx.role, 'purchase', 'update')
  const canDelete = can(ctx.role, 'purchase', 'delete')
  const canValidate = isDraft && canEdit

  const [depots, sites] = canValidate
    ? await Promise.all([listDepotOptions(ctx), listSiteOptions(ctx)])
    : [[], []]

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/achats' />}>
        <ChevronLeft className='size-4' /> Achats
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <ShoppingCart className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{purchase.reference ?? 'Achat'}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant={purchase.status === 'validee' ? 'secondary' : 'outline'}>
                {PURCHASE_STATUS_LABELS[purchase.status] ?? purchase.status}
              </Badge>
              {purchase.supplierName && <Badge variant='outline'>{purchase.supplierName}</Badge>}
            </div>
          </div>
        </div>
        <PurchaseDetailActions
          purchaseId={id}
          isDraft={isDraft}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 text-sm sm:grid-cols-2'>
          {purchase.orderDate && <p>Commande : {formatDate(purchase.orderDate)}</p>}
          {purchase.validatedAt && (
            <p>
              Réceptionné le{' '}
              {new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              }).format(new Date(purchase.validatedAt))}
            </p>
          )}
          <p className='font-medium'>Total : {formatCost(purchase.total)}</p>
        </section>

        <section className='space-y-3 rounded-lg border p-5'>
          <h2 className='font-semibold'>Lignes</h2>
          <ul className='divide-y'>
            {purchase.lines.map((l) => (
              <li key={l.id} className='flex items-center justify-between gap-3 py-2.5'>
                <div className='min-w-0'>
                  <Link href={`/stock/${l.productId}`} className='truncate text-sm hover:underline'>
                    {l.productTitle}
                  </Link>
                  <p className='text-xs text-muted-foreground'>
                    {formatQuantity(l.quantity, l.unit)} × {formatCost(l.unitPrice)}
                    {l.destinationName ? ` → ${l.destinationName}` : ''}
                  </p>
                </div>
                <span className='shrink-0 text-sm font-medium'>
                  {formatCost(l.quantity * l.unitPrice)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {purchase.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{purchase.notes}</p>
          </section>
        )}

        {canValidate && (
          <section className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-5'>
            <div>
              <h2 className='font-semibold'>Réception</h2>
              <p className='text-sm text-muted-foreground'>
                Validez pour entrer le stock et recalculer le prix moyen pondéré.
              </p>
            </div>
            <PurchaseValidateDialog
              purchaseId={id}
              lines={purchase.lines}
              depots={depots}
              sites={sites}
            />
          </section>
        )}
      </div>
    </div>
  )
}
