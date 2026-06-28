import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Library, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getPlatformAdmin } from '@/lib/auth/platform-admin'

/**
 * Espace « Alstock Admin » — réservé aux administrateurs plateforme (allowlist
 * d'e-mails). Volontairement hors du groupe `(main)` pour ne pas exiger une
 * organisation active : un admin Alstock n'est pas nécessairement membre d'une org.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin()
  if (!admin) redirect('/dashboard')

  return (
    <div className='min-h-svh bg-muted/20'>
      <header className='sticky top-0 z-10 border-b bg-background'>
        <div className='mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4'>
          <Link href='/admin/bibliotheque' className='flex items-center gap-2 font-semibold'>
            <span className='flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary'>
              <ShieldCheck className='size-4' />
            </span>
            Alstock Admin
          </Link>
          <nav className='flex items-center gap-2'>
            <Button variant='ghost' size='sm' render={<Link href='/admin/bibliotheque' />}>
              <Library className='size-4' /> Bibliothèque
            </Button>
            <Button variant='outline' size='sm' render={<Link href='/dashboard' />}>
              <ArrowLeft className='size-4' /> Retour à l'app
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
