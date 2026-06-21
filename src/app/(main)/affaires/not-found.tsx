import Link from 'next/link'
import { Briefcase } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function DealNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <Briefcase />
        </EmptyMedia>
        <EmptyTitle>Affaire introuvable</EmptyTitle>
        <EmptyDescription>
          Cette affaire n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/affaires' />}>Retour aux affaires</Button>
      </Empty>
    </div>
  )
}
