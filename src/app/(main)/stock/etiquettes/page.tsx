import { headers } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft, Printer } from 'lucide-react'
import QRCode from 'qrcode'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { requireOrgContext } from '@/lib/auth/org-context'
import { PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import { listProductsByIds } from '@/services/crm/product'
import { EtiquettesGrid, type LabelData } from './_components/etiquettes-grid'

interface EtiquettesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Parse `?ids=a,b,c` (ou répété) en ids uniques, ordre préservé. */
const parseIds = (raw: string | string[] | undefined): string[] => {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const out: string[] = []
  for (const value of values) {
    for (const id of value.split(',')) {
      const trimmed = id.trim()
      if (trimmed && !out.includes(trimmed)) out.push(trimmed)
    }
  }
  return out
}

/** Base URL absolue même-origine (cible des QR). */
const absoluteBaseUrl = async () => {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export default async function EtiquettesPage({ searchParams }: EtiquettesPageProps) {
  const ctx = await requireOrgContext()
  const sp = await searchParams
  const ids = parseIds(sp.ids)

  const products = await listProductsByIds(ctx, ids)
  const base = await absoluteBaseUrl()

  const labels: LabelData[] = await Promise.all(
    products.map(async (p) => ({
      id: p.id,
      title: p.title,
      subtitle: [p.categoryName, p.subcategoryName].filter(Boolean).join(' · '),
      unit: PRODUCT_UNIT_LABELS[p.unit] ?? p.unit,
      imagePath: p.imagePath,
      qrSvg: await QRCode.toString(`${base}/stock/${p.id}`, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    }))
  )

  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <div className='mb-4 flex items-center justify-between gap-2 print:hidden'>
        <Button variant='ghost' size='sm' render={<Link href='/stock' />}>
          <ChevronLeft className='size-4' /> Stock
        </Button>
        <h1 className='text-lg font-semibold'>Planche d'étiquettes</h1>
      </div>

      {labels.length === 0 ? (
        <Empty className='border'>
          <EmptyMedia variant='icon'>
            <Printer />
          </EmptyMedia>
          <EmptyTitle>Aucune étiquette à imprimer</EmptyTitle>
          <EmptyDescription>
            Sélectionnez des produits depuis le catalogue pour constituer votre planche.
          </EmptyDescription>
          <Button variant='outline' size='sm' render={<Link href='/stock' />}>
            Retour au stock
          </Button>
        </Empty>
      ) : (
        <EtiquettesGrid labels={labels} />
      )}
    </div>
  )
}
