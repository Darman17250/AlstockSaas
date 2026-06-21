import Link from 'next/link'
import { HardHat } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function SiteNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <HardHat />
        </EmptyMedia>
        <EmptyTitle>Chantier introuvable</EmptyTitle>
        <EmptyDescription>
          Ce chantier n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/chantiers' />}>Retour aux chantiers</Button>
      </Empty>
    </div>
  )
}
