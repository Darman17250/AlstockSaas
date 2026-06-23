import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CTA() {
  return (
    <section id='cta' className='py-24 px-4 sm:px-6 bg-[#F4F4F5]'>
      <div className='mx-auto max-w-4xl'>
        <h2
          className='text-center text-sm font-medium text-muted-foreground mb-8'
          style={{ fontFamily: 'var(--font-geist-mono)' }}
        >
          COMMENCER
        </h2>

        <div className='text-center mb-12'>
          <h2 className='text-4xl font-semibold tracking-tight mb-4'>
            Mettez votre activité sur les rails dès aujourd’hui.
          </h2>
          <p className='text-lg text-muted-foreground'>
            Créez votre compte, invitez votre équipe et pilotez vos premiers chantiers en quelques
            minutes.
          </p>
        </div>

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
    </section>
  )
}
