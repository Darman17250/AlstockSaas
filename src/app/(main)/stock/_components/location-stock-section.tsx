import Link from 'next/link'
import { Boxes, Package } from 'lucide-react'

import { formatCost, formatQuantity } from '@/lib/crm/labels'
import type { LocationStockItem } from '@/services/crm/stock'

interface LocationStockSectionProps {
  items: LocationStockItem[]
  totalValue: number
}

/** Section « Stock » affichée sur la fiche d'un dépôt ou d'un chantier. */
export const LocationStockSection = ({ items, totalValue }: LocationStockSectionProps) => (
  <section className='space-y-3 rounded-lg border p-5'>
    <div className='flex items-center justify-between gap-3'>
      <h2 className='inline-flex items-center gap-2 font-semibold'>
        <Boxes className='size-4 text-muted-foreground' /> Stock
      </h2>
      <span className='text-sm text-muted-foreground'>
        Valeur :{' '}
        <span className='font-medium text-foreground'>{formatCost(totalValue) ?? '—'}</span>
      </span>
    </div>

    {items.length === 0 ? (
      <p className='text-sm text-muted-foreground'>Aucun produit en stock ici.</p>
    ) : (
      <ul className='divide-y'>
        {items.map((item) => (
          <li key={item.productId}>
            <Link
              href={`/stock/${item.productId}`}
              className='flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/50'
            >
              <div className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground'>
                {item.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/stock/${item.productId}/image`}
                    alt=''
                    loading='lazy'
                    className='size-full object-cover'
                  />
                ) : (
                  <Package className='size-4' />
                )}
              </div>
              <span className='min-w-0 flex-1 truncate text-sm'>{item.title}</span>
              <span className='flex shrink-0 flex-col items-end text-right'>
                <span className='text-sm font-medium'>
                  {formatQuantity(item.quantity, item.unit)}
                </span>
                <span className='text-xs text-muted-foreground'>
                  {formatCost(item.value) ?? '—'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
)
