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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { markDealWonAction } from '../actions'

interface WonDialogProps {
  dealId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Affiche l'option de conversion en chantier (permission `site:create`). */
  canCreateSite: boolean
}

export const WonDialog = ({ dealId, open, onOpenChange, canCreateSite }: WonDialogProps) => {
  const router = useRouter()
  const [createSite, setCreateSite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setBusy(true)
    setError(null)
    const res = await markDealWonAction(dealId, { createSite: canCreateSite && createSite })
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
          <AlertDialogTitle>Marquer l'affaire gagnée ?</AlertDialogTitle>
          <AlertDialogDescription>
            L'affaire sortira du pipeline et sera classée dans « Gagnées ».
          </AlertDialogDescription>
        </AlertDialogHeader>
        {canCreateSite && (
          <div className='flex items-start gap-3 px-6'>
            <Checkbox
              id='createSite'
              checked={createSite}
              onCheckedChange={(v) => setCreateSite(v === true)}
            />
            <Label htmlFor='createSite' className='text-sm font-normal leading-snug'>
              Créer le chantier lié maintenant
              <span className='block text-muted-foreground'>
                Un chantier pré-rempli (client, adresse) sera créé et rattaché à l'affaire.
              </span>
            </Label>
          </div>
        )}
        {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant='outline' />} disabled={busy}>
            Annuler
          </AlertDialogClose>
          <Button onClick={handleConfirm} disabled={busy}>
            Confirmer
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )
}
