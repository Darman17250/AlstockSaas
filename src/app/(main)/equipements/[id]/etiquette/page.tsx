import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import QRCode from 'qrcode'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { getEquipment } from '@/services/crm/equipment'
import { PrintButton } from './print-button'

interface EtiquettePageProps {
  params: Promise<{ id: string }>
}

/** Construit l'URL absolue de la page équipement (cible du QR) depuis la requête. */
const absoluteEquipmentUrl = async (id: string) => {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}/equipements/${id}`
}

export default async function EtiquettePage({ params }: EtiquettePageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let eq: Awaited<ReturnType<typeof getEquipment>>
  try {
    eq = await getEquipment(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const url = await absoluteEquipmentUrl(id)
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })

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
        <Button variant='ghost' size='sm' render={<Link href={`/equipements/${id}`} />}>
          <ChevronLeft className='size-4' /> Équipement
        </Button>
        <PrintButton />
      </div>

      <div
        id='print-label'
        className='mx-auto flex w-72 flex-col items-center gap-3 rounded-lg border bg-white p-4 text-center text-black'
      >
        <div className='size-44' dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className='w-full'>
          <p className='truncate text-base font-bold'>{eq.name}</p>
          {eq.category && <p className='truncate text-sm'>{eq.category}</p>}
          <p className='mt-1 truncate text-xs text-gray-600'>
            {eq.clientName} · {eq.locationName}
          </p>
          {eq.serialNumber && (
            <p className='truncate text-xs text-gray-600'>N° {eq.serialNumber}</p>
          )}
        </div>
      </div>

      <p className='mt-4 text-center text-xs text-muted-foreground print:hidden'>
        Scannez le QR pour ouvrir la fiche de l'équipement.
      </p>
    </div>
  )
}
