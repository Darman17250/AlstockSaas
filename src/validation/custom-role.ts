import { z } from 'zod'

import { BUSINESS_RESOURCES } from '@/lib/auth/permissions'

/**
 * Validation des rôles personnalisés. La matrice de permissions ne peut référencer
 * que des ressources/actions connues (dérivées de `statement`) — source de vérité.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const ROLE_ACTIONS = ['create', 'read', 'update', 'delete'] as const

export const permissionMatrixSchema = z.partialRecord(
  z.enum(BUSINESS_RESOURCES),
  z.array(z.enum(ROLE_ACTIONS))
)

export const customRoleCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(60, 'Nom trop long'),
  description: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  color: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (format #RRGGBB)')
      .optional()
  ),
  permissions: permissionMatrixSchema.default({}),
})

export const customRoleUpdateSchema = customRoleCreateSchema

export const assignRoleSchema = z.object({
  memberId: z.string().min(1),
  slug: z.string().trim().min(1),
})

export type CustomRoleInput = z.infer<typeof customRoleCreateSchema>
export type PermissionMatrixInput = z.infer<typeof permissionMatrixSchema>
export type AssignRoleInput = z.infer<typeof assignRoleSchema>
