'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Loader2, ScanLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface QrScannerProps {
  /** Appelé avec le texte décodé (URL ou code). */
  onResult: (text: string) => void
  /** Actif uniquement quand le conteneur est visible (ex. dialog ouvert). */
  active: boolean
}

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable'

/**
 * Scanner QR réutilisable : ouvre la caméra (arrière sur mobile) via
 * @zxing/browser et remonte chaque lecture. En repli (permission refusée ou
 * pas de caméra), propose la saisie manuelle d'un code. Le flux est libéré au
 * démontage / à la fermeture.
 */
export const QrScanner = ({ onResult, active }: QrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [state, setState] = useState<CameraState>('starting')
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const reader = new BrowserMultiFormatReader()
    setState('starting')

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current as HTMLVideoElement,
        (result, _err, controls) => {
          controlsRef.current = controls
          if (cancelled) {
            controls.stop()
            return
          }
          setState('scanning')
          if (result) onResult(result.getText())
        }
      )
      .catch((e: unknown) => {
        if (cancelled) return
        const name = e instanceof Error ? e.name : ''
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [active, onResult])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manual.trim()
    if (code) onResult(code)
  }

  const cameraDown = state === 'denied' || state === 'unavailable'

  return (
    <div className='space-y-4'>
      {!cameraDown && (
        <div className='relative aspect-square w-full overflow-hidden rounded-lg bg-black'>
          <video ref={videoRef} className='size-full object-cover' playsInline muted />
          <div className='pointer-events-none absolute inset-8 rounded-lg border-2 border-white/70' />
          {state === 'starting' && (
            <div className='absolute inset-0 flex items-center justify-center text-white'>
              <Loader2 className='size-6 animate-spin' />
            </div>
          )}
        </div>
      )}

      {state === 'scanning' && (
        <p className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
          <ScanLine className='size-4' /> Visez un QR code…
        </p>
      )}

      {cameraDown && (
        <p className='rounded-md bg-muted p-3 text-sm text-muted-foreground'>
          {state === 'denied'
            ? "Accès à la caméra refusé. Autorisez-la dans votre navigateur, ou saisissez un code ci-dessous."
            : "Aucune caméra disponible. Saisissez un code ci-dessous."}
        </p>
      )}

      <form onSubmit={submitManual} className='space-y-2'>
        <Label htmlFor='manual-code' className='text-xs'>
          Saisie manuelle
        </Label>
        <div className='flex gap-2'>
          <Input
            id='manual-code'
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder='Code ou URL'
          />
          <Button type='submit' variant='outline' disabled={!manual.trim()}>
            Ouvrir
          </Button>
        </div>
      </form>
    </div>
  )
}
