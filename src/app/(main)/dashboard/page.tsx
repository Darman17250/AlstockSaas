import Link from 'next/link'
import { Briefcase, HardHat, ListChecks, Users } from 'lucide-react'

const SHORTCUTS = [
  { href: '/clients', label: 'Clients', icon: Users, desc: 'Sociétés & particuliers' },
  { href: '/affaires', label: 'Affaires', icon: Briefcase, desc: 'Pipeline commercial' },
  { href: '/chantiers', label: 'Chantiers', icon: HardHat, desc: 'Suivi d’exécution' },
  { href: '/taches', label: 'Tâches', icon: ListChecks, desc: 'Mes rappels du jour' },
]

export default function DashboardPage() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <h1 className='mb-2 text-3xl font-bold tracking-tight'>Tableau de bord</h1>
      <p className='mb-8 text-muted-foreground'>Vue d’ensemble de votre activité.</p>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {SHORTCUTS.map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className='group rounded-lg border p-5 transition-colors hover:border-primary hover:bg-muted/50'
          >
            <div className='mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary'>
              <Icon className='size-5' />
            </div>
            <h2 className='font-semibold group-hover:text-primary'>{label}</h2>
            <p className='text-sm text-muted-foreground'>{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
