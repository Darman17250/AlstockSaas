import Link from 'next/link'
import { UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function ClientNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <UserX />
        </EmptyMedia>
        <EmptyTitle>Client introuvable</EmptyTitle>
        <EmptyDescription>
          Ce client n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/clients' />}>Retour aux clients</Button>
      </Empty>
    </div>
  )
}
