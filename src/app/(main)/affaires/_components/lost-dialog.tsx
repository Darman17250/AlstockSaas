'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { markDealLostAction } from '../actions'

interface LostDialogProps {
  dealId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const LostDialog = ({ dealId, open, onOpenChange }: LostDialogProps) => {
  const router = useRouter()
  const [lostReason, setLostReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    const res = await markDealLostAction(dealId, { lostReason })
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    setBusy(false)
    onOpenChange(false)
    router.refresh()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Marquer l'affaire perdue ?</AlertDialogTitle>
          <AlertDialogDescription>
            L'affaire sortira du pipeline et sera classée dans « Perdues ».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className='space-y-2 px-6'>
          <Label htmlFor='lostReason'>Motif de la perte</Label>
          <Textarea
            id='lostReason'
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder='Prix, délai, concurrent…'
          />
        </div>
        {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant='outline' />} disabled={busy}>
            Annuler
          </AlertDialogClose>
          <Button variant='destructive' onClick={handleConfirm} disabled={busy}>
            Confirmer
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
