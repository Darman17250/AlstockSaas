import Link from 'next/link'
import { Warehouse } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function DepotNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <Warehouse />
        </EmptyMedia>
        <EmptyTitle>Dépôt introuvable</EmptyTitle>
        <EmptyDescription>
          Ce dépôt n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/depots' />}>Retour aux dépôts</Button>
      </Empty>
    </div>
  )
}
