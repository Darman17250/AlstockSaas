import { z } from 'zod'

/**
 * Transfert d'un matériel vers une nouvelle localisation (dépôt OU chantier).
 * La localisation de départ et le statut sont déterminés côté service.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const toolTransferCreateSchema = z.object({
  destinationKind: z.enum(['depot', 'site']),
  destinationId: z.uuid(),
  note: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
})

export type ToolTransferCreateInput = z.infer<typeof toolTransferCreateSchema>
