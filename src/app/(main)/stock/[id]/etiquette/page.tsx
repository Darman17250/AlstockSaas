import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Package } from 'lucide-react'
import QRCode from 'qrcode'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import { getProduct } from '@/services/crm/product'
import { PrintButton } from './print-button'

interface EtiquettePageProps {
  params: Promise<{ id: string }>
}

/** URL absolue même-origine de la fiche produit (cible du QR). */
const absoluteProductUrl = async (id: string) => {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}/stock/${id}`
}

export default async function ProductEtiquettePage({ params }: EtiquettePageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let product: Awaited<ReturnType<typeof getProduct>>
  try {
    product = await getProduct(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const url = await absoluteProductUrl(id)
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  const subtitle = [product.categoryName, product.subcategoryName].filter(Boolean).join(' · ')

  return (
    <div className='mx-auto max-w-md px-4 py-8'>
      {/* N'imprime que l'étiquette (#print-label), pas le shell de l'app. */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@media print { body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: absolute; inset: 0; margin: 0 auto; } }',
        }}
      />

      <div className='mb-4 flex items-center justify-between gap-2 print:hidden'>
        <Button variant='ghost' size='sm' render={<Link href={`/stock/${id}`} />}>
          <ChevronLeft className='size-4' /> Produit
        </Button>
        <PrintButton />
      </div>

      <div
        id='print-label'
        className='mx-auto flex w-72 flex-col items-center gap-3 rounded-lg border bg-white p-4 text-center text-black'
      >
        <div className='flex size-20 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400'>
          {product.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/stock/${id}/image`} alt='' className='size-full object-cover' />
          ) : (
            <Package className='size-8' />
          )}
        </div>
        <div className='size-44' dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className='w-full'>
          <p className='truncate text-base font-bold'>{product.title}</p>
          {subtitle && <p className='truncate text-sm'>{subtitle}</p>}
          <p className='mt-1 truncate text-xs text-gray-600'>
            Unité : {PRODUCT_UNIT_LABELS[product.unit] ?? product.unit}
          </p>
        </div>
      </div>

      <p className='mt-4 text-center text-xs text-muted-foreground print:hidden'>
        Scannez le QR pour ouvrir la fiche de ce produit.
      </p>
    </div>
  )
}
