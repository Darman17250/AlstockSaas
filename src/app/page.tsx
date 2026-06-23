import Navbar from './(site)/navbar'
import Hero from './(site)/hero'
import Features from './(site)/features'
import CTA from './(site)/cta'
import Footer from './(site)/footer'
import { GridLayout, SectionDivider } from './(site)/grid-layout'

export default function Page() {
  return (
    <GridLayout>
      <Navbar />
      <Hero />
      <SectionDivider />
      <Features />
      <SectionDivider />
      <CTA />
      <Footer />
    </GridLayout>
  )
}
