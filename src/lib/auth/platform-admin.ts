import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'

import { env } from '@/config/env'
import { auth } from './auth'
import { ForbiddenError, UnauthorizedError } from './org-context'

/**
 * « Alstock Admin » — administration plateforme, au-dessus des organisations.
 * Il n'existe pas de rôle global sur la table `user` : l'appartenance est dérivée
 * d'une allowlist d'e-mails en variable d'environnement (`ALSTOCK_ADMIN_EMAILS`).
 *
 * Sert exclusivement à gérer la bibliothèque catalogue partagée. Aucune fonction
 * org-scoped ne dépend de ce contexte.
 */
export interface PlatformAdmin {
  userId: string
  email: string
}

const adminEmails = (): string[] =>
  (env.ALSTOCK_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

/** Indique si un e-mail figure dans l'allowlist des administrateurs Alstock. */
export const isPlatformAdminEmail = (email: string | null | undefined): boolean =>
  Boolean(email && adminEmails().includes(email.toLowerCase()))

/** Renvoie l'admin plateforme courant, ou `null` si non authentifié / non autorisé. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isPlatformAdminEmail(session.user.email)) return null
  return { userId: session.user.id, email: session.user.email }
})

/** Exige un admin plateforme, sinon `UnauthorizedError` / `ForbiddenError`. */
export const requirePlatformAdmin = async (): Promise<PlatformAdmin> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new UnauthorizedError()
  if (!isPlatformAdminEmail(session.user.email)) {
    throw new ForbiddenError("Réservé à l'administration Alstock")
  }
  return { userId: session.user.id, email: session.user.email }
}
