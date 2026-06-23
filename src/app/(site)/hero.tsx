'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const chain = ['Contact', 'Affaire', 'Chantier', 'Suivi terrain']

export default function Hero() {
  return (
    <main
      id='hero'
      className='flex min-h-screen flex-col bg-[#F4F4F5] items-center justify-start pt-40 pb-24'
    >
      <div className='mx-auto w-full max-w-6xl px-4 sm:px-6'>
        <div className='mx-auto max-w-4xl text-center'>
          <span
            className='inline-block rounded-full border border-[#E4E4E7] bg-white px-3 py-1 text-xs font-medium text-muted-foreground'
            style={{ fontFamily: 'var(--font-geist-mono)' }}
          >
            CRM & SUIVI DE CHANTIERS · BTP
          </span>

          <h1 className='mx-auto mt-6 max-w-3xl text-balance text-center font-semibold text-4xl leading-tight tracking-tighter sm:text-5xl md:max-w-4xl md:text-6xl lg:leading-[1.1]'>
            Du premier contact au chantier terminé, sans ressaisie.
          </h1>

          <p className='mx-auto mt-6 max-w-xl text-balance text-center text-muted-foreground md:max-w-2xl md:text-lg'>
            Alstock relie votre activité commerciale et vos chantiers dans un seul outil. Clients,
            affaires, chantiers, tâches et équipe — pensé pour les TPE et PME du bâtiment.
          </p>

          <div className='mx-auto mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4'>
            <Button
              size='lg'
              className='font-semibold text-white'
              render={(props) => (
                <Link {...props} href='/register'>
                  Créer un compte
                  <ArrowRight className='h-4 w-4' />
                </Link>
              )}
            />
            <Button
              variant='outline'
              size='lg'
              className='font-semibold'
              render={(props) => (
                <Link {...props} href='/login'>
                  Se connecter
                </Link>
              )}
            />
          </div>
        </div>

        {/* Chaîne métier */}
        <div className='mt-24 w-full'>
          <h2
            className='text-center text-sm font-medium text-muted-foreground mb-8'
            style={{ fontFamily: 'var(--font-geist-mono)' }}
          >
            UNE SEULE CHAÎNE, ZÉRO RESSAISIE
          </h2>
          <div className='flex flex-wrap items-center justify-center gap-3'>
            {chain.map((step, index) => (
              <div key={step} className='flex items-center gap-3'>
                <span className='rounded-md border border-[#E4E4E7] bg-white px-4 py-2 text-sm font-medium text-foreground'>
                  {step}
                </span>
                {index < chain.length - 1 && (
                  <ArrowRight className='h-4 w-4 text-muted-foreground' aria-hidden='true' />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
