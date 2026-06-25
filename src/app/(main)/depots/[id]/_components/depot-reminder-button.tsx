'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellPlus, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createDepotMaintenanceReminderTaskAction } from '../../actions'

interface DepotReminderButtonProps {
  depotId: string
  subject: string
  dueDate: string
}

/** Crée une tâche de rappel d'entretien (assignée à l'utilisateur courant). */
export const DepotReminderButton = ({ depotId, subject, dueDate }: DepotReminderButtonProps) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    const res = await createDepotMaintenanceReminderTaskAction({ depotId, subject, dueDate })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  return (
    <div className='flex flex-col items-start gap-1'>
      <Button size='sm' variant='outline' onClick={handleClick} disabled={busy || done}>
        {busy ? (
          <Loader2 className='size-4 animate-spin' />
        ) : done ? (
          <Check className='size-4' />
        ) : (
          <BellPlus className='size-4' />
        )}
        {done ? 'Tâche créée' : 'Créer une tâche de rappel'}
      </Button>
      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
    </div>
  )
}
