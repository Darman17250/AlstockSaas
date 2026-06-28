import 'server-only'
import { and, count, eq } from 'drizzle-orm'

import { db } from '@/database'
import { customRole, member } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requireOrgAdmin,
} from '@/lib/auth/org-context'
import {
  BUILTIN_PERMISSIONS,
  ROLE_LABELS,
  isBuiltinRole,
  type PermissionMatrix,
} from '@/lib/auth/permissions'
import type { CustomRoleInput } from '@/validation/custom-role'

/**
 * Services — rôles d'organisation (intégrés + personnalisés).
 * Cloisonnement multi-tenant : toute requête `custom_role` filtre `organizationId`.
 * Réservé à l'administration de l'org (`requireOrgAdmin`).
 */

export interface RoleSummary {
  slug: string
  name: string
  description: string | null
  color: string | null
  permissions: PermissionMatrix
  isSystem: boolean
  /** Assignable à un membre (owner ne l'est pas — transfert non géré ici). */
  assignable: boolean
  memberCount: number
}

/** Rôles intégrés exposés dans l'écran de gestion (hors `member` natif). */
const BUILTIN_LIST: { slug: string; assignable: boolean }[] = [
  { slug: 'owner', assignable: false },
  { slug: 'admin', assignable: true },
  { slug: 'commercial', assignable: true },
  { slug: 'conducteur', assignable: true },
  { slug: 'terrain', assignable: true },
]

// NFKD décompose les accents en marques combinantes, retirées par `[^\w\s-]`.
const slugify = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)

const countMembersByRole = async (organizationId: string): Promise<Map<string, number>> => {
  const rows = await db
    .select({ role: member.role, n: count() })
    .from(member)
    .where(eq(member.organizationId, organizationId))
    .groupBy(member.role)
  return new Map(rows.map((r) => [r.role, r.n]))
}

export const listRoles = async (ctx: OrgContext): Promise<RoleSummary[]> => {
  requireOrgAdmin(ctx)

  const counts = await countMembersByRole(ctx.organizationId)

  const builtins: RoleSummary[] = BUILTIN_LIST.map(({ slug, assignable }) => ({
    slug,
    name: ROLE_LABELS[slug] ?? slug,
    description: null,
    color: null,
    permissions: BUILTIN_PERMISSIONS[slug as keyof typeof BUILTIN_PERMISSIONS] ?? {},
    isSystem: true,
    assignable,
    memberCount: counts.get(slug) ?? 0,
  }))

  const customs = await db
    .select()
    .from(customRole)
    .where(eq(customRole.organizationId, ctx.organizationId))
    .orderBy(customRole.name)

  const customSummaries: RoleSummary[] = customs.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    color: r.color,
    permissions: (r.permissions as PermissionMatrix) ?? {},
    isSystem: false,
    assignable: true,
    memberCount: counts.get(r.slug) ?? 0,
  }))

  return [...builtins, ...customSummaries]
}

const slugExists = async (organizationId: string, slug: string): Promise<boolean> => {
  if (isBuiltinRole(slug)) return true
  const [row] = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(and(eq(customRole.organizationId, organizationId), eq(customRole.slug, slug)))
    .limit(1)
  return Boolean(row)
}

export const createRole = async (ctx: OrgContext, input: CustomRoleInput) => {
  requireOrgAdmin(ctx)

  const base = slugify(input.name)
  if (!base) throw new ForbiddenError('Nom de rôle invalide')
  if (await slugExists(ctx.organizationId, base)) {
    throw new ForbiddenError('Un rôle avec ce nom existe déjà')
  }

  const [created] = await db
    .insert(customRole)
    .values({
      organizationId: ctx.organizationId,
      name: input.name,
      slug: base,
      description: input.description ?? null,
      color: input.color ?? null,
      permissions: input.permissions,
      isSystem: false,
    })
    .returning()

  return created
}

export const updateRole = async (ctx: OrgContext, slug: string, input: CustomRoleInput) => {
  requireOrgAdmin(ctx)
  if (isBuiltinRole(slug)) throw new ForbiddenError('Rôle intégré non modifiable')

  const [row] = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(and(eq(customRole.organizationId, ctx.organizationId), eq(customRole.slug, slug)))
    .limit(1)
  if (!row) throw new NotFoundError('Rôle introuvable')

  // Le slug reste stable (référencé par member.role) ; seul le libellé évolue.
  await db
    .update(customRole)
    .set({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      permissions: input.permissions,
    })
    .where(and(eq(customRole.id, row.id), eq(customRole.organizationId, ctx.organizationId)))
}

export const deleteRole = async (ctx: OrgContext, slug: string): Promise<void> => {
  requireOrgAdmin(ctx)
  if (isBuiltinRole(slug)) throw new ForbiddenError('Rôle intégré non supprimable')

  const [row] = await db
    .select({ id: customRole.id })
    .from(customRole)
    .where(and(eq(customRole.organizationId, ctx.organizationId), eq(customRole.slug, slug)))
    .limit(1)
  if (!row) throw new NotFoundError('Rôle introuvable')

  // 3A : suppression bloquée tant que des membres l'utilisent.
  const [used] = await db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.organizationId, ctx.organizationId), eq(member.role, slug)))
  if ((used?.n ?? 0) > 0) {
    throw new ForbiddenError('Ce rôle est attribué à des membres — réassignez-les d’abord')
  }

  await db
    .delete(customRole)
    .where(and(eq(customRole.id, row.id), eq(customRole.organizationId, ctx.organizationId)))
}

/**
 * Assigne un slug (intégré assignable ou custom de l'org) à un membre. Écriture
 * directe de `member.role` car le plugin Better-Auth valide contre sa config
 * statique et rejetterait un slug custom.
 */
export const assignMemberRole = async (
  ctx: OrgContext,
  memberId: string,
  slug: string
): Promise<void> => {
  requireOrgAdmin(ctx)

  if (slug === 'owner') throw new ForbiddenError('Le rôle propriétaire ne peut pas être assigné')
  if (memberId === ctx.memberId)
    throw new ForbiddenError('Vous ne pouvez pas changer votre propre rôle')

  const assignable =
    (isBuiltinRole(slug) && slug !== 'member') || (await slugExists(ctx.organizationId, slug))
  if (!assignable) throw new ForbiddenError('Rôle inconnu')

  const [target] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)
  if (!target) throw new NotFoundError('Membre introuvable')
  if (target.role === 'owner') throw new ForbiddenError('Le propriétaire ne peut pas être modifié')

  await db
    .update(member)
    .set({ role: slug })
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
}
