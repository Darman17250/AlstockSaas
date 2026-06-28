import Link from 'next/link'
import { AlertTriangle, Briefcase, HardHat, ListChecks, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { HABILITATION_TYPE_LABELS } from '@/lib/crm/labels'
import { listExpiringHabilitations } from '@/services/org/habilitation'

const SHORTCUTS = [
  { href: '/clients', label: 'Clients', icon: Users, desc: 'Sociétés & particuliers' },
  { href: '/affaires', label: 'Affaires', icon: Briefcase, desc: 'Pipeline commercial' },
  { href: '/chantiers', label: 'Chantiers', icon: HardHat, desc: 'Suivi d’exécution' },
  { href: '/taches', label: 'Tâches', icon: ListChecks, desc: 'Mes rappels du jour' },
]

export default async function DashboardPage() {
  const ctx = await getOrgContext()
  const expiring =
    ctx && can(ctx, 'habilitation', 'read') ? await listExpiringHabilitations(ctx) : []

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

      {expiring.length > 0 && (
        <section className='mt-8 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30'>
          <h2 className='mb-3 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200'>
            <AlertTriangle className='size-4' /> Habilitations à renouveler ({expiring.length})
          </h2>
          <ul className='space-y-2'>
            {expiring.slice(0, 5).map((h) => (
              <li key={h.id} className='flex flex-wrap items-center gap-2 text-sm'>
                <Link href={`/equipe/${h.memberId}`} className='font-medium hover:underline'>
                  {h.memberName ?? 'Membre'}
                </Link>
                <span className='text-muted-foreground'>
                  · {HABILITATION_TYPE_LABELS[h.type] ?? h.type} — {h.name}
                </span>
                <Badge
                  variant='outline'
                  size='sm'
                  className={h.status === 'expiree' ? 'text-red-600' : 'text-amber-700'}
                >
                  {h.status === 'expiree' ? 'Expirée le ' : 'Expire le '}
                  {h.expiresAt}
                </Badge>
              </li>
            ))}
          </ul>
          <Link
            href='/equipe'
            className='mt-3 inline-block text-sm font-medium text-amber-800 hover:underline dark:text-amber-300'
          >
            Voir l’équipe →
          </Link>
        </section>
      )}
    </div>
  )
}
