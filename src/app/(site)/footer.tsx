import Link from 'next/link'

const columns = [
  {
    title: 'Produit',
    links: [
      { href: '/#features', label: 'Fonctionnalités' },
      { href: '/login', label: 'Connexion' },
      { href: '/register', label: 'Créer un compte' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { href: '/terms', label: "Conditions d'utilisation" },
      { href: '/privacy', label: 'Politique de confidentialité' },
      { href: '/licenses', label: 'Licences' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className='border-t border-[#E4E4E7] bg-[#F4F4F5] py-12'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='grid grid-cols-2 gap-8 md:grid-cols-4'>
          {columns.map((column) => (
            <div key={column.title}>
              <h3
                className='mb-4 text-sm font-semibold uppercase'
                style={{ fontFamily: 'var(--font-geist-mono)' }}
              >
                {column.title}
              </h3>
              <ul className='space-y-3'>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className='text-sm font-medium text-muted-foreground transition-colors duration-200 ease-in-out hover:text-foreground'
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className='mt-12 pt-8 border-t border-[#E4E4E7]'>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center gap-2'>
              <img src='/image.png' alt='Logo Alstock' className='h-6 w-6 object-contain' />
              <span
                className='text-base font-semibold text-foreground'
                style={{ fontFamily: 'var(--font-bricolage-grotesque)' }}
              >
                Alstock
              </span>
            </div>
            <p className='text-sm text-muted-foreground'>CRM et suivi de chantiers pour le BTP.</p>
            <p className='text-sm text-muted-foreground'>
              © {new Date().getFullYear()} Alstock. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
