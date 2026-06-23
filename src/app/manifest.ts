import type { MetadataRoute } from 'next'
import { getBrandConfig } from '@/config/branding'

export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrandConfig()

  return {
    name: brand.name,
    short_name: brand.name,
    description: 'CRM et suivi de chantiers pour le BTP.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: brand.theme?.primaryColor,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/image.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['developer tools', 'productivity', 'saas'],
    shortcuts: [
      {
        name: 'Open dashboard',
        short_name: 'Dashboard',
        description: 'Accéder au tableau de bord',
        url: '/dashboard',
      },
    ],
    lang: 'en-US',
    dir: 'ltr',
  }
}
