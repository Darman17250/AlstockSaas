import Link from 'next/link'
import { Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function MaterielNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <Wrench />
        </EmptyMedia>
        <EmptyTitle>Matériel introuvable</EmptyTitle>
        <EmptyDescription>
          Ce matériel n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/materiel' />}>Retour au matériel</Button>
      </Empty>
    </div>
  )
}
