'use client'

import Link from 'next/link'
import { X, Menu } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

const navLinks = [
  { href: '/#features', label: 'Fonctionnalités' },
  { href: '/#cta', label: 'Commencer' },
]

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const toggleMenu = () => setIsMenuOpen((open) => !open)

  return (
    <nav className='fixed inset-x-0 top-0 z-30 border-b border-[#E4E4E7] bg-[#F4F4F5]'>
      <div className='mx-auto max-w-7xl flex h-14 items-center justify-between gap-8 px-4 sm:px-6'>
        <Link href='/' className='flex items-center gap-2'>
          <img src='/image.png' alt='Logo Alstock' className='h-6 w-6 object-contain' />
          <span
            className='text-base font-semibold text-foreground'
            style={{ fontFamily: 'var(--font-bricolage-grotesque)' }}
          >
            Alstock
          </span>
        </Link>

        <div className='flex-1' />

        <div className='hidden items-center gap-6 md:flex'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className='text-sm font-medium text-muted-foreground transition-colors duration-200 ease-in-out hover:text-foreground'
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className='hidden h-6 w-px bg-black/20 md:block' />

        <div className='hidden items-center gap-3 md:flex'>
          <Link
            href='/login'
            className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            Connexion
          </Link>
          <Button
            className='text-white'
            render={(props) => (
              <Link {...props} href='/register'>
                Créer un compte
              </Link>
            )}
          />
        </div>

        <button
          type='button'
          onClick={toggleMenu}
          className='inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden'
        >
          <span className='sr-only'>Ouvrir le menu</span>
          {isMenuOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
        </button>
      </div>

      {/* Menu mobile */}
      {isMenuOpen && (
        <div className='border-t border-border md:hidden'>
          <div className='mx-auto max-w-6xl space-y-1 px-4 sm:px-6 pb-3 pt-2'>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className='block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground'
                onClick={toggleMenu}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href='/login'
              className='block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground'
              onClick={toggleMenu}
            >
              Connexion
            </Link>
            <Button
              className='mt-2 w-full text-white'
              render={(props) => (
                <Link {...props} href='/register' onClick={toggleMenu}>
                  Créer un compte
                </Link>
              )}
            />
          </div>
        </div>
      )}
    </nav>
  )
}
