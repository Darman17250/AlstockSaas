import { z } from 'zod'

import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { InsufficientStockError } from '@/services/crm/stock'

/**
 * Type de retour sérialisable des Server Actions + mapping d'erreurs métier
 * typées vers un message FR. Module sans `'use server'` (un fichier d'actions ne
 * peut exporter que des fonctions async).
 */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

export const toStockError = (e: unknown): string => {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? 'Données invalides'
  if (e instanceof UnauthorizedError) return 'Authentification requise'
  if (e instanceof ForbiddenError) return e.message
  if (e instanceof NotFoundError) return e.message
  if (e instanceof InsufficientStockError) return e.message
  if (e instanceof StorageNotConfiguredError) return e.message
  return 'Une erreur est survenue'
}
