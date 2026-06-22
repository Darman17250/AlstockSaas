import Link from 'next/link'
import { CheckSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function TaskNotFound() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-16'>
      <Empty>
        <EmptyMedia variant='icon'>
          <CheckSquare />
        </EmptyMedia>
        <EmptyTitle>Tâche introuvable</EmptyTitle>
        <EmptyDescription>
          Cette tâche n'existe pas ou ne fait pas partie de votre organisation.
        </EmptyDescription>
        <Button render={<Link href='/taches' />}>Retour aux tâches</Button>
      </Empty>
    </div>
  )
}
