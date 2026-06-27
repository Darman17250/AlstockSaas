'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Package, Plus, Printer, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { printListActions } from '../../_components/print-list-store'

export interface LabelData {
  id: string
  title: string
  subtitle: string
  unit: string
  imagePath: string | null
  qrSvg: string
}

interface EtiquettesGridProps {
  labels: LabelData[]
}

const MAX_COPIES = 20

export const EtiquettesGrid = ({ labels }: EtiquettesGridProps) => {
  const router = useRouter()
  const [copies, setCopies] = useState<Record<string, number>>({})

  const copiesOf = (id: string) => copies[id] ?? 1
  const setCopiesOf = (id: string, value: number) =>
    setCopies((prev) => ({ ...prev, [id]: Math.min(MAX_COPIES, Math.max(1, value)) }))

  const navigateTo = (nextIds: string[]) => {
    router.replace(
      nextIds.length ? `/stock/etiquettes?ids=${nextIds.join(',')}` : '/stock/etiquettes'
    )
  }

  const remove = (id: string) => {
    printListActions.remove(id)
    navigateTo(labels.filter((l) => l.id !== id).map((l) => l.id))
  }

  const removeAll = () => {
    printListActions.clear()
    navigateTo([])
  }

  const totalLabels = labels.reduce((sum, l) => sum + copiesOf(l.id), 0)

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@media print { body * { visibility: hidden !important; } #print-sheet, #print-sheet * { visibility: visible !important; } #print-sheet { position: absolute; inset: 0; } #print-sheet .label { break-inside: avoid; } }',
        }}
      />

      <div className='mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden'>
        <p className='text-sm text-muted-foreground'>
          {labels.length} produit{labels.length > 1 ? 's' : ''} · {totalLabels} étiquette
          {totalLabels > 1 ? 's' : ''}
        </p>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={removeAll}>
            <X className='size-4' /> Tout retirer
          </Button>
          <Button size='sm' onClick={() => window.print()}>
            <Printer className='size-4' /> Tout imprimer
          </Button>
        </div>
      </div>

      <div
        id='print-sheet'
        className='grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2'
      >
        {labels.flatMap((label) =>
          Array.from({ length: copiesOf(label.id) }).map((_, copyIndex) => (
            <LabelCard
              key={`${label.id}-${copyIndex}`}
              label={label}
              controls={
                copyIndex === 0 ? (
                  <div className='absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-1 print:hidden'>
                    <div className='flex items-center gap-0.5 rounded-md border bg-background'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-6'
                        onClick={() => setCopiesOf(label.id, copiesOf(label.id) - 1)}
                        disabled={copiesOf(label.id) <= 1}
                        aria-label='Moins de copies'
                      >
                        <Minus className='size-3' />
                      </Button>
                      <span className='min-w-4 text-center text-xs tabular-nums'>
                        {copiesOf(label.id)}
                      </span>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-6'
                        onClick={() => setCopiesOf(label.id, copiesOf(label.id) + 1)}
                        disabled={copiesOf(label.id) >= MAX_COPIES}
                        aria-label='Plus de copies'
                      >
                        <Plus className='size-3' />
                      </Button>
                    </div>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-6 rounded-md border bg-background'
                      onClick={() => remove(label.id)}
                      aria-label="Retirer de l'impression"
                    >
                      <X className='size-3' />
                    </Button>
                  </div>
                ) : null
              }
            />
          ))
        )}
      </div>
    </>
  )
}

interface LabelCardProps {
  label: LabelData
  controls?: React.ReactNode
}

const LabelCard = ({ label, controls }: LabelCardProps) => (
  <div className='label relative flex break-inside-avoid flex-col items-center gap-2 rounded-lg border bg-white p-3 text-center text-black'>
    {controls}
    <div className='flex size-12 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400'>
      {label.imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/stock/${label.id}/image`} alt='' className='size-full object-cover' />
      ) : (
        <Package className='size-6' />
      )}
    </div>
    <div className='size-28' dangerouslySetInnerHTML={{ __html: label.qrSvg }} />
    <div className='w-full'>
      <p className='truncate text-sm font-bold'>{label.title}</p>
      {label.subtitle && <p className='truncate text-xs'>{label.subtitle}</p>}
      <p className='mt-0.5 truncate text-[10px] text-gray-600'>Unité : {label.unit}</p>
    </div>
  </div>
)
