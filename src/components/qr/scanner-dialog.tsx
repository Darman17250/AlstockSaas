'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { QrScanner } from './qr-scanner'

interface ScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog plein écran (mobile-first) encapsulant le scanner QR global. Sur lecture
 * d'une URL de la MÊME origine, navigue vers son chemin (deep-link de l'entité) ;
 * sinon affiche le texte décodé. Réutilisable pour toute entité disposant d'une
 * page deep-link encodée dans un QR.
 */
export const ScannerDialog = ({ open, onOpenChange }: ScannerDialogProps) => {
  const router = useRouter()
  const [decoded, setDecoded] = useState<string | null>(null)

  const handleResult = (text: string) => {
    // URL même origine → on ne navigue QUE vers un chemin interne de l'app.
    try {
      const url = new URL(text, window.location.origin)
      if (url.origin === window.location.origin) {
        onOpenChange(false)
        setDecoded(null)
        router.push(`${url.pathname}${url.search}`)
        return
      }
    } catch {
      // Pas une URL : on retombe sur l'affichage du texte brut.
    }
    setDecoded(text)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setDecoded(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Scanner un QR code</DialogTitle>
        </DialogHeader>
        <DialogPanel className='space-y-4'>
          <QrScanner active={open} onResult={handleResult} />
          {decoded && (
            <div className='space-y-1 rounded-md bg-muted p-3 text-sm'>
              <p className='font-medium'>Code lu</p>
              <p className='break-words text-muted-foreground'>{decoded}</p>
              <p className='text-xs text-muted-foreground'>
                Ce code ne correspond pas à une page de l'application.
              </p>
            </div>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' type='button' />}>Fermer</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
