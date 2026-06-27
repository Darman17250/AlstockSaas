import Link from 'next/link'
import { AlertTriangle, Package } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatCost, formatQuantity } from '@/lib/crm/labels'
import type { ProductListItem } from '@/services/crm/product'

interface ProductListProps {
  items: ProductListItem[]
}

export const ProductList = ({ items }: ProductListProps) => (
  <ul className='divide-y rounded-lg border'>
    {items.map((p) => (
      <li key={p.id}>
        <Link
          href={`/stock/${p.id}`}
          className='flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50'
        >
          <div className='flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground'>
            {p.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/stock/${p.id}/image`}
                alt=''
                loading='lazy'
                className='size-full object-cover'
              />
            ) : (
              <Package className='size-5' />
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='truncate text-sm font-medium'>{p.title}</p>
              {p.belowThreshold && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  <AlertTriangle className='size-3' /> Stock bas
                </Badge>
              )}
            </div>
            <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
              {p.categoryName && <span>{p.categoryName}</span>}
              {p.subcategoryName && <span>· {p.subcategoryName}</span>}
            </div>
          </div>
          <div className='flex shrink-0 flex-col items-end gap-0.5 text-right'>
            <span className='text-sm font-medium'>{formatQuantity(p.globalQuantity, p.unit)}</span>
            <span className='text-xs text-muted-foreground'>
              {formatCost(p.globalValue) ?? '—'}
            </span>
          </div>
        </Link>
      </li>
    ))}
  </ul>
)
