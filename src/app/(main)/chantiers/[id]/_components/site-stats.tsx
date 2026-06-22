import {
  CheckSquare,
  Clock,
  FileText,
  type LucideIcon,
  MessagesSquare,
  TrendingUp,
  Users,
} from 'lucide-react'

interface SiteStatsProps {
  tasksTotal: number
  tasksDone: number
  messagesCount: number
  documentsCount: number
  teamCount: number
}

interface StatCard {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  soon?: boolean
}

/**
 * Statistiques de la fiche chantier. Quelques indicateurs réels déjà calculés ;
 * les cartes « Bientôt » sont des emplacements à compléter plus tard
 * (avancement, heures pointées — dépendent des features Rapports/Pointage).
 */
export const SiteStats = ({
  tasksTotal,
  tasksDone,
  messagesCount,
  documentsCount,
  teamCount,
}: SiteStatsProps) => {
  const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0

  const cards: StatCard[] = [
    {
      icon: CheckSquare,
      label: 'Tâches',
      value: `${tasksDone}/${tasksTotal}`,
      hint: tasksTotal > 0 ? `${taskPct}% terminées` : 'Aucune tâche',
    },
    { icon: Users, label: 'Équipe', value: String(teamCount), hint: 'salariés assignés' },
    { icon: MessagesSquare, label: 'Messages', value: String(messagesCount) },
    { icon: FileText, label: 'Documents', value: String(documentsCount) },
    { icon: TrendingUp, label: 'Avancement', value: '—', soon: true },
    { icon: Clock, label: 'Heures pointées', value: '—', soon: true },
  ]

  return (
    <section className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
      {cards.map((c) => (
        <div key={c.label} className='rounded-lg border p-3'>
          <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <c.icon className='size-3.5' /> {c.label}
          </div>
          <p className='mt-1 text-xl font-bold tabular-nums'>{c.value}</p>
          {c.hint && <p className='text-xs text-muted-foreground'>{c.hint}</p>}
          {c.soon && <p className='text-xs text-muted-foreground'>Bientôt</p>}
        </div>
      ))}
    </section>
  )
}
