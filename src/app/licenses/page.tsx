import type { Metadata } from 'next'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo'
import Navbar from '../(site)/navbar'
import Footer from '../(site)/footer'
import { GridLayout } from '../(site)/grid-layout'

export const metadata: Metadata = generateSEOMetadata({
  title: 'Licences',
  description: 'Informations de licence de la plateforme Alstock',
  canonical: '/licenses',
})

export default async function LicensesPage() {
  return (
    <GridLayout>
      <Navbar />
      <main className='min-h-screen pt-14'>
        <div className='mx-auto max-w-4xl px-4 py-16 sm:px-6'>
          <h1 className='mb-4 text-4xl font-semibold tracking-tight'>Licences</h1>
          <p className='mb-12 text-sm text-muted-foreground'>Dernière mise à jour : 22 juin 2026</p>

          <div className='prose prose-sm max-w-none space-y-8 text-muted-foreground'>
            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>1. Logiciel Alstock</h2>
              <p>
                Le logiciel Alstock et son code source sont mis à disposition dans le cadre d’un
                abonnement ou d’un accès valide. Toute redistribution ou revente sans autorisation
                est interdite.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>
                2. Composants open-source
              </h2>
              <p>
                Alstock intègre des bibliothèques open-source soumises à leurs licences respectives
                (MIT, Apache 2.0, etc.). Vous devez en respecter les termes.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>3. Attribution</h2>
              <p>
                Aucune mention publique d’Alstock n’est exigée, mais l’attribution est toujours
                appréciée.
              </p>
            </section>

            <section>
              <h2 className='mb-4 text-xl font-semibold text-foreground'>4. Résiliation</h2>
              <p>
                Nous nous réservons le droit de révoquer votre licence en cas d’usage abusif ou de
                redistribution de notre code en violation de ces conditions.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </GridLayout>
  )
}
