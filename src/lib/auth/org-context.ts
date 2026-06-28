import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/database'
import { customRole, member as memberTable } from '@/database/schema'
import { auth } from './auth'
import {
  can,
  resolveBuiltinPermissions,
  type Action,
  type BusinessResource,
  type PermissionMatrix,
} from './permissions'

/**
 * Contexte d'organisation dérivé **côté serveur** de la session active.
 * Primitive centrale du multi-tenant : toute fonction service le reçoit en
 * argument et filtre ses requêtes sur `organizationId`.
 *
 * On ne fait JAMAIS confiance à un `organizationId` venant du client.
 */
export interface OrgContext {
  userId: string
  organizationId: string
  memberId: string
  role: string
  /**
   * Matrice de permissions effective du rôle (intégré ou custom). Fait foi pour
   * `can(ctx, …)`. Résolue une fois ici pour rester synchrone côté services.
   */
  permissions: PermissionMatrix
}

/**
 * Résout la matrice de permissions d'un slug de rôle dans l'organisation : matrice
 * intégrée si connue, sinon `custom_role` de l'org (filtré `organizationId`).
 */
const resolveRolePermissions = async (
  organizationId: string,
  role: string
): Promise<PermissionMatrix> => {
  const builtin = resolveBuiltinPermissions(role)
  if (builtin) return builtin

  const [row] = await db
    .select({ permissions: customRole.permissions })
    .from(customRole)
    .where(and(eq(customRole.organizationId, organizationId), eq(customRole.slug, role)))
    .limit(1)

  return (row?.permissions as PermissionMatrix | undefined) ?? {}
}

/** Renvoie le contexte org, ou `null` si non authentifié / pas d'org active. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const activeOrgId = session.session.activeOrganizationId

  // 1) Org active de la session : on vérifie que l'utilisateur en est membre.
  let row: { id: string; role: string; organizationId: string } | undefined
  if (activeOrgId) {
    ;[row] = await db
      .select({
        id: memberTable.id,
        role: memberTable.role,
        organizationId: memberTable.organizationId,
      })
      .from(memberTable)
      .where(
        and(eq(memberTable.userId, session.user.id), eq(memberTable.organizationId, activeOrgId))
      )
      .limit(1)
  }

  // 2) Fallback : pas d'org active (ou plus membre) → dernière org rejointe.
  //    Évite une redirection onboarding pour un membre existant.
  if (!row) {
    ;[row] = await db
      .select({
        id: memberTable.id,
        role: memberTable.role,
        organizationId: memberTable.organizationId,
      })
      .from(memberTable)
      .where(eq(memberTable.userId, session.user.id))
      .orderBy(desc(memberTable.createdAt))
      .limit(1)
  }

  // Aucune appartenance → onboarding.
  if (!row) return null

  const permissions = await resolveRolePermissions(row.organizationId, row.role)

  return {
    userId: session.user.id,
    organizationId: row.organizationId,
    memberId: row.id,
    role: row.role,
    permissions,
  }
})

/** Erreurs métier typées (pas de throw de strings). */
export class UnauthorizedError extends Error {
  constructor(message = 'Authentification requise') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
export class ForbiddenError extends Error {
  constructor(message = 'Action non autorisée') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
export class NotFoundError extends Error {
  constructor(message = 'Ressource introuvable') {
    super(message)
    this.name = 'NotFoundError'
  }
}

/** Exige un contexte org valide, sinon lève `UnauthorizedError`. */
export const requireOrgContext = async (): Promise<OrgContext> => {
  const ctx = await getOrgContext()
  if (!ctx) throw new UnauthorizedError()
  return ctx
}

/** Exige une permission précise pour le rôle du contexte, sinon `ForbiddenError`. */
export const requirePermission = (
  ctx: OrgContext,
  resource: BusinessResource,
  action: Action
): void => {
  if (!can(ctx, resource, action)) {
    throw new ForbiddenError(`Permission manquante : ${resource}:${action}`)
  }
}

/** Exige un rôle d'administration de l'org (owner/admin) — gestion des rôles/membres. */
export const requireOrgAdmin = (ctx: OrgContext): void => {
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new ForbiddenError("Réservé à l'administration de l'organisation")
  }
}
