import type { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'
import Navbar from '../(site)/navbar'
import Footer from '../(site)/footer'
import { GridLayout } from '../(site)/grid-layout'

export const metadata: Metadata = generateSEOMetadata({
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité de la plateforme Alstock',
  canonical: '/privacy',
})

export default async function PrivacyPage() {
  return (
    <GridLayout>
      <Navbar />
      <main className='min-h-screen pt-14'>
        <div className='mx-auto max-w-4xl px-4 py-16 sm:px-6'>
          <h1 className='mb-4 text-4xl font-semibold tracking-tight'>
            Politique de confidentialité
          </h1>
          <p className='mb-12 text-sm text-muted-foreground'>Dernière mise à jour : 22 juin 2026</p>

          <div className='prose prose-sm max-w-none space-y-8 text-muted-foreground'>
            <p>
              Nous accordons de l’importance à votre vie privée. Voici comment nous traitons vos
              données.
            </p>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                1. Données que nous collectons
              </h2>
              <ul className='list-disc space-y-2 pl-6'>
                <li>informations de compte (email, nom, etc.)</li>
                <li>données d’usage (votre manière d’utiliser l’application)</li>
                <li>données facultatives que vous partagez (retours, demandes de support)</li>
              </ul>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                2. Comment nous les utilisons
              </h2>
              <ul className='list-disc space-y-2 pl-6'>
                <li>faire fonctionner et améliorer Alstock</li>
                <li>vous informer des mises à jour ou des incidents</li>
                <li>prévenir les abus et les fraudes</li>
              </ul>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>3. Cookies</h2>
              <p>
                Nous utilisons des cookies pour vous garder connecté et mesurer les performances.
                Vous pouvez les désactiver, mais certaines fonctionnalités pourraient ne plus
                fonctionner correctement.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>4. Services tiers</h2>
              <p>
                Nous pouvons recourir à des outils d’hébergement ou de mesure (comme Vercel ou
                Supabase) qui traitent des données conformément à leurs propres politiques.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                5. Sécurité des données
              </h2>
              <p>
                Nous prenons des mesures raisonnables pour protéger vos données, sans pouvoir
                garantir une sécurité absolue.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>6. Vos droits</h2>
              <p>
                Vous pouvez demander à tout moment la correction ou la suppression de vos données à{' '}
                <a
                  href='mailto:contact@alstock.fr'
                  className='text-(--brand-accent-hex) underline-offset-4 hover:text-(--brand-accent-hover-hex) hover:underline'
                >
                  contact@alstock.fr
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </GridLayout>
  )
}
