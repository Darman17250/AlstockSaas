'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const PrintButton = () => (
  <Button size='sm' onClick={() => window.print()}>
    <Printer className='size-4' /> Imprimer l'étiquette
  </Button>
)
