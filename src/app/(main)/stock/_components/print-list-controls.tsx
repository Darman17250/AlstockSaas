'use client'

import Link from 'next/link'
import { Check, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { printListActions, usePrintList, usePrintListHas } from './print-list-store'

/** Case à cocher « ajouter à l'impression » pour une ligne de la liste produits. */
export const PrintListCheckbox = ({ id }: { id: string }) => {
  const checked = usePrintListHas(id)
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => printListActions.toggle(id)}
      aria-label="Ajouter ce produit à la liste d'impression"
    />
  )
}

/** Bouton bascule « ajouter à l'impression » pour la fiche produit. */
export const AddToPrintButton = ({ id }: { id: string }) => {
  const inList = usePrintListHas(id)
  return (
    <Button variant='outline' size='sm' onClick={() => printListActions.toggle(id)}>
      {inList ? <Check className='size-4' /> : <Printer className='size-4' />}
      {inList ? "Dans l'impression" : "Ajouter à l'impression"}
    </Button>
  )
}

/** Indicateur global « Impression (n) » menant à la planche d'étiquettes. */
export const PrintListBar = () => {
  const ids = usePrintList()
  if (ids.length === 0) return null
  return (
    <Button variant='outline' render={<Link href={`/stock/etiquettes?ids=${ids.join(',')}`} />}>
      <Printer className='size-4' /> Impression ({ids.length})
    </Button>
  )
}
