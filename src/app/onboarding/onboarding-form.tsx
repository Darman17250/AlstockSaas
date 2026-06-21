'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client } from '@/lib/auth/auth-client'

/** Slug URL-safe dérivé du nom + suffixe court pour limiter les collisions. */
const toSlug = (value: string): string => {
  const base = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return base ? `${base}-${suffix}` : `org-${suffix}`
}

export const OnboardingForm = ({ hasInvites = false }: { hasInvites?: boolean }) => {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Le nom de l’entreprise est requis.')
      return
    }

    setIsLoading(true)
    setError(null)

    const created = await client.organization.create({ name: trimmed, slug: toSlug(trimmed) })

    if (created.error || !created.data) {
      setError(created.error?.message ?? 'Impossible de créer l’organisation.')
      setIsLoading(false)
      return
    }

    // Définit l'org fraîchement créée comme org active de la session.
    await client.organization.setActive({ organizationId: created.data.id })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className='w-full space-y-6'>
      {hasInvites ? (
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          <span className='h-px flex-1 bg-border' />
          OU CRÉEZ VOTRE ENTREPRISE
          <span className='h-px flex-1 bg-border' />
        </div>
      ) : (
        <div className='space-y-2 text-center'>
          <h1 className='text-3xl font-semibold tracking-tight'>Bienvenue 👋</h1>
          <p className='text-muted-foreground'>
            Créez votre entreprise pour commencer. Vous pourrez inviter votre équipe ensuite.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='space-y-2'>
          <Label htmlFor='org-name'>Nom de l’entreprise</Label>
          <Input
            id='org-name'
            name='name'
            size='lg'
            placeholder='Ex. Maçonnerie Dupont'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          {error && <p className='text-sm text-red-500'>{error}</p>}
        </div>

        <Button type='submit' size='lg' className='w-full' disabled={isLoading}>
          {isLoading ? 'Création…' : 'Créer mon entreprise'}
        </Button>
      </form>
    </div>
  )
}
