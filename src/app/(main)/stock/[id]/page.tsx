import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ChevronLeft, HardHat, Package, QrCode, Warehouse } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { PRODUCT_UNIT_LABELS, formatCost, formatQuantity } from '@/lib/crm/labels'
import { listDepotOptions } from '@/services/crm/depot'
import { getProduct } from '@/services/crm/product'
import { listSiteOptions } from '@/services/crm/site'
import { getProductStockSummary, listProductDistribution } from '@/services/crm/stock'
import { listMovementsForProduct } from '@/services/crm/stock-transfer'
import { AddToPrintButton } from '../_components/print-list-controls'
import { ProductDetailActions } from './_components/product-detail-actions'
import { StockMovementsSection } from './_components/stock-movements-section'
import { StockTransferDialog } from './_components/stock-transfer-dialog'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let product: Awaited<ReturnType<typeof getProduct>>
  try {
    product = await getProduct(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx, 'product', 'update')
  const canDelete = can(ctx, 'product', 'delete')
  const canTransfer = can(ctx, 'stockMovement', 'create')
  const canReadMovements = can(ctx, 'stockMovement', 'read')

  const unitPrice = Number(product.weightedAvgPrice)
  const summary = await getProductStockSummary(ctx, id)
  const distribution = await listProductDistribution(ctx, id, unitPrice)
  const globalValue = summary.globalQuantity * unitPrice

  const alertThreshold = product.alertThreshold != null ? Number(product.alertThreshold) : null
  const belowThreshold = alertThreshold != null && summary.globalQuantity <= alertThreshold

  const [depots, sites, movements] = await Promise.all([
    canTransfer ? listDepotOptions(ctx) : Promise.resolve([]),
    canTransfer ? listSiteOptions(ctx) : Promise.resolve([]),
    canReadMovements ? listMovementsForProduct(ctx, id) : Promise.resolve([]),
  ])

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/stock' />}>
        <ChevronLeft className='size-4' /> Stock
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground'>
            {product.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/stock/${id}/image`} alt='' className='size-full object-cover' />
            ) : (
              <Package className='size-7' />
            )}
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{product.title}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              {product.categoryName && <Badge variant='secondary'>{product.categoryName}</Badge>}
              {product.subcategoryName && (
                <Badge variant='outline'>{product.subcategoryName}</Badge>
              )}
              <Badge variant='outline'>{PRODUCT_UNIT_LABELS[product.unit] ?? product.unit}</Badge>
              {belowThreshold && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  <AlertTriangle className='size-3' /> Stock bas
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' render={<Link href={`/stock/${id}/etiquette`} />}>
            <QrCode className='size-4' /> Étiquette
          </Button>
          <AddToPrintButton id={id} />
          {canTransfer && (
            <StockTransferDialog
              productId={id}
              unit={product.unit}
              depots={depots}
              sites={sites}
              distribution={distribution}
            />
          )}
          <ProductDetailActions
            productId={id}
            productTitle={product.title}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>

      <div className='space-y-6'>
        {/* Résumé stock */}
        <section className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <div
            className={`rounded-lg border p-4 ${belowThreshold ? 'border-destructive/40 bg-destructive/5' : ''}`}
          >
            <p className='text-xs text-muted-foreground'>Stock global (dépôts)</p>
            <p className='mt-1 text-lg font-semibold'>
              {formatQuantity(summary.globalQuantity, product.unit)}
            </p>
            {alertThreshold != null && (
              <p className='mt-0.5 text-xs text-muted-foreground'>
                Seuil : {formatQuantity(alertThreshold, product.unit)}
              </p>
            )}
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>Sur chantiers actifs</p>
            <p className='mt-1 text-lg font-semibold'>
              {formatQuantity(summary.activeSiteQuantity, product.unit)}
            </p>
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>Prix moyen pondéré</p>
            <p className='mt-1 text-lg font-semibold'>{formatCost(unitPrice) ?? '—'}</p>
          </div>
          <div className='rounded-lg border p-4'>
            <p className='text-xs text-muted-foreground'>Valeur (dépôts)</p>
            <p className='mt-1 text-lg font-semibold'>{formatCost(globalValue) ?? '—'}</p>
          </div>
        </section>

        {product.description && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Description</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
              {product.description}
            </p>
          </section>
        )}

        {/* Répartition par localisation */}
        <section className='space-y-3 rounded-lg border p-5'>
          <h2 className='font-semibold'>Répartition</h2>
          {distribution.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Aucun stock pour ce produit.</p>
          ) : (
            <ul className='divide-y'>
              {distribution.map((d) => (
                <li
                  key={`${d.locationType}-${d.locationId}`}
                  className='flex items-center justify-between gap-3 py-2.5'
                >
                  <span className='inline-flex items-center gap-2 text-sm'>
                    {d.locationType === 'depot' ? (
                      <Warehouse className='size-4 text-muted-foreground' />
                    ) : (
                      <HardHat className='size-4 text-muted-foreground' />
                    )}
                    {d.locationType === 'depot' ? (
                      <Link href={`/depots/${d.locationId}`} className='hover:underline'>
                        {d.locationName}
                      </Link>
                    ) : (
                      <Link href={`/chantiers/${d.locationId}`} className='hover:underline'>
                        {d.locationName}
                      </Link>
                    )}
                  </span>
                  <span className='flex shrink-0 flex-col items-end text-right'>
                    <span className='text-sm font-medium'>
                      {formatQuantity(d.quantity, product.unit)}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {formatCost(d.value) ?? '—'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canReadMovements && <StockMovementsSection movements={movements} unit={product.unit} />}
      </div>
    </div>
  )
}
