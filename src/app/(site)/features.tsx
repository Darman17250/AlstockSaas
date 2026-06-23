import { Users, Briefcase, HardHat, ListChecks, Wrench, MessagesSquare } from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Clients & contacts',
    description:
      'Centralisez sociétés, contacts et emplacements. Une fiche 360° par client, accessible à toute l’équipe.',
  },
  {
    icon: Briefcase,
    title: 'Affaires & pipeline',
    description:
      'Suivez vos opportunités dans un pipeline visuel. Une affaire gagnée se convertit en chantier sans tout retaper.',
  },
  {
    icon: HardHat,
    title: 'Chantiers',
    description:
      'Pilotez chaque chantier : informations, équipe, documents et avancement, depuis le bureau ou le terrain.',
  },
  {
    icon: ListChecks,
    title: 'Tâches & planning',
    description:
      'Affectez les tâches, suivez les échéances et gardez la vue « à faire » claire pour chacun.',
  },
  {
    icon: Wrench,
    title: 'Équipements',
    description:
      'Inventaire du matériel, maintenance, documents et étiquettes QR pour retrouver chaque équipement.',
  },
  {
    icon: MessagesSquare,
    title: 'Messagerie de chantier',
    description:
      'Échangez en contexte sur chaque chantier : mentions, pièces jointes et historique au même endroit.',
  },
]

export default function Features() {
  return (
    <section id='features' className='py-24 bg-[#F4F4F5]'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <h2
          className='text-center text-sm font-medium text-muted-foreground mb-8'
          style={{ fontFamily: 'var(--font-geist-mono)' }}
        >
          FONCTIONNALITÉS
        </h2>
        <div className='text-center mb-16'>
          <h2 className='text-4xl font-semibold tracking-tight mb-4'>
            Tout votre chantier, du devis au terrain
          </h2>
          <p className='text-lg text-muted-foreground'>
            Les modules essentiels du BTP, reliés entre eux et sans double saisie.
          </p>
        </div>

        <div className='grid gap-px overflow-hidden rounded-lg border border-[#E4E4E7] bg-[#E4E4E7] sm:grid-cols-2 lg:grid-cols-3'>
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className='flex flex-col bg-[#F4F4F5] p-6'>
                <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-[#E4E4E7] bg-white'>
                  <Icon className='h-5 w-5 text-foreground' aria-hidden='true' />
                </div>
                <h3 className='mb-2 text-lg font-semibold'>{feature.title}</h3>
                <p className='text-sm text-muted-foreground'>{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
