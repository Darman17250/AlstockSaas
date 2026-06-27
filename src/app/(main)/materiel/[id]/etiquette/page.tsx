import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import QRCode from 'qrcode'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { TOOL_KIND_LABELS } from '@/lib/crm/labels'
import { getTool } from '@/services/crm/tool'
import { PrintButton } from './print-button'

interface EtiquettePageProps {
  params: Promise<{ id: string }>
}

/**
 * Construit l'URL absolue de la page de TRANSFERT mobile (cible du QR) depuis la
 * requête. Convention : tout QR encode l'URL absolue même-origine de la page
 * deep-link de l'entité — ici, scanner ⇒ déplacer le matériel.
 */
const absoluteTransferUrl = async (id: string) => {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}/materiel/${id}/transfert`
}

export default async function MaterielEtiquettePage({ params }: EtiquettePageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let tool: Awaited<ReturnType<typeof getTool>>
  try {
    tool = await getTool(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const url = await absoluteTransferUrl(id)
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
        <Button variant='ghost' size='sm' render={<Link href={`/materiel/${id}`} />}>
          <ChevronLeft className='size-4' /> Matériel
        </Button>
        <PrintButton />
      </div>

      <div
        id='print-label'
        className='mx-auto flex w-72 flex-col items-center gap-3 rounded-lg border bg-white p-4 text-center text-black'
      >
        <div className='size-44' dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className='w-full'>
          <p className='truncate text-base font-bold'>{tool.name}</p>
          <p className='truncate text-sm'>{tool.category ?? TOOL_KIND_LABELS[tool.kind]}</p>
          {tool.reference && (
            <p className='mt-1 truncate text-xs text-gray-600'>Réf. {tool.reference}</p>
          )}
          {tool.serialNumber && (
            <p className='truncate text-xs text-gray-600'>N° {tool.serialNumber}</p>
          )}
        </div>
      </div>

      <p className='mt-4 text-center text-xs text-muted-foreground print:hidden'>
        Scannez le QR pour transférer ce matériel d'un dépôt à un chantier (et inversement).
      </p>
    </div>
  )
}
