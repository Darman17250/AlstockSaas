import type { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'
import Navbar from '../(site)/navbar'
import Footer from '../(site)/footer'
import { GridLayout } from '../(site)/grid-layout'

export const metadata: Metadata = generateSEOMetadata({
  title: 'Conditions d’utilisation',
  description: 'Conditions d’utilisation de la plateforme Alstock',
  canonical: '/terms',
})

export default async function TermsPage() {
  return (
    <GridLayout>
      <Navbar />
      <main className='min-h-screen pt-14'>
        <div className='mx-auto max-w-4xl px-4 py-16 sm:px-6'>
          <h1 className='mb-4 text-4xl font-semibold tracking-tight'>Conditions d’utilisation</h1>
          <p className='mb-12 text-sm text-muted-foreground'>Dernière mise à jour : 22 juin 2026</p>

          <div className='prose prose-sm max-w-none space-y-8 text-muted-foreground'>
            <p>
              Bienvenue sur Alstock. En accédant à la plateforme ou en l’utilisant, vous acceptez
              les présentes conditions. Si vous ne les acceptez pas, merci de ne pas utiliser
              Alstock.
            </p>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                1. Utilisation d’Alstock
              </h2>
              <p>
                Vous vous engagez à utiliser Alstock uniquement à des fins licites. Vous êtes
                responsable de l’usage que vous faites de la plateforme, y compris des données et
                documents que vous y enregistrez ou partagez.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>2. Comptes</h2>
              <p>
                Vous êtes responsable de la sécurité de votre compte. En cas de suspicion d’accès
                non autorisé, contactez-nous immédiatement à{' '}
                <a
                  href='mailto:contact@alstock.fr'
                  className='text-(--brand-accent-hex) underline-offset-4 hover:text-(--brand-accent-hover-hex) hover:underline'
                >
                  contact@alstock.fr
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                3. Propriété intellectuelle
              </h2>
              <p>
                Le logiciel Alstock et l’ensemble de ses composants restent notre propriété ou celle
                de nos partenaires. Vous conservez l’ensemble des droits sur vos propres données
                métier (clients, affaires, chantiers).
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>4. Restrictions</h2>
              <p>
                Il est interdit de tenter de pirater, décompiler ou revendre les services d’Alstock.
                Nous nous réservons le droit de suspendre ou de fermer tout compte ne respectant pas
                ces conditions.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>5. Responsabilité</h2>
              <p>
                Alstock est fourni « en l’état ». Nous ne garantissons pas un service ininterrompu
                ni exempt d’erreurs. Notre responsabilité ne saurait être engagée en cas de
                dommages, de perte de données ou d’indisponibilité.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                6. Évolution des conditions
              </h2>
              <p>
                Nous pouvons mettre à jour ces conditions à tout moment. La poursuite de
                l’utilisation vaut acceptation de la version la plus récente.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </GridLayout>
  )
}
