/**
 * Access-control métier (partagé serveur + client).
 *
 * Rôles intégrés (cf. CLAUDE.md §4) :
 *  - owner   : créateur de l'organisation — accès complet (rôle natif Better-Auth).
 *  - admin   : accès complet (rôle natif Better-Auth).
 *  - commercial : CRM complet, lecture chantiers.
 *  - conducteur : chantiers complets, lecture CRM.
 *  - terrain    : rapports + pointage, lecture limitée.
 *
 * En plus, chaque organisation peut définir des **rôles personnalisés** (table
 * `custom_role`). Leur matrice de permissions est chargée une fois dans
 * `OrgContext.permissions` ; `can()` reste donc 100% synchrone (cf. CLAUDE.md §4).
 * `BUILTIN_PERMISSIONS` est la **source de vérité** des rôles intégrés et sert à
 * construire les rôles Better-Auth ci-dessous.
 */
import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

const crud = ['create', 'read', 'update', 'delete'] as const

/** Ressources métier soumises à l'access-control (hors statements org natifs). */
export const BUSINESS_RESOURCES = [
  'client',
  'contact',
  'deal',
  'activity',
  'site',
  'report',
  'timeEntry',
  'location',
  'equipment',
  'maintenance',
  'depot',
  'depotMaintenance',
  'tool',
  'toolMaintenance',
  'toolTransfer',
  'toolIssue',
  'product',
  'productCategory',
  'supplier',
  'purchase',
  'stockMovement',
  'habilitation',
] as const

export type BusinessResource = (typeof BUSINESS_RESOURCES)[number]
export type Action = (typeof crud)[number]
export type PermissionMatrix = Partial<Record<BusinessResource, Action[]>>

/** Ressources métier + actions, en plus des statements org natifs (member/invitation…). */
export const statement = {
  ...defaultStatements,
  ...(Object.fromEntries(BUSINESS_RESOURCES.map((r) => [r, crud])) as Record<
    BusinessResource,
    typeof crud
  >),
} as const

export const ac = createAccessControl(statement)

const allCrud = (): Action[] => [...crud]
const fullMatrix: PermissionMatrix = Object.fromEntries(
  BUSINESS_RESOURCES.map((r) => [r, allCrud()])
)

/** Slugs des rôles intégrés. */
export const BUILTIN_ROLE_SLUGS = [
  'owner',
  'admin',
  'member',
  'commercial',
  'conducteur',
  'terrain',
] as const
export type AppRole = (typeof BUILTIN_ROLE_SLUGS)[number]

/**
 * Matrices de permissions des rôles intégrés — source de vérité unique
 * (rôles Better-Auth + résolution dans `OrgContext`).
 */
export const BUILTIN_PERMISSIONS: Record<AppRole, PermissionMatrix> = {
  owner: fullMatrix,
  admin: fullMatrix,
  // `member` natif : aucun accès métier (on assigne toujours un rôle explicite).
  member: {},
  commercial: {
    client: [...crud],
    contact: [...crud],
    deal: [...crud],
    activity: [...crud],
    site: ['read'],
    report: ['read'],
    timeEntry: ['read'],
    location: [...crud],
    equipment: [...crud],
    maintenance: ['read'],
    depot: ['read'],
    depotMaintenance: ['read'],
    tool: ['read'],
    toolMaintenance: ['read'],
    toolTransfer: ['read'],
    toolIssue: ['read'],
    product: ['read'],
    productCategory: ['read'],
    supplier: ['read'],
    purchase: ['read'],
    stockMovement: ['read'],
    habilitation: ['read'],
  },
  conducteur: {
    client: ['read'],
    contact: ['read'],
    deal: ['read'],
    activity: [...crud],
    site: [...crud],
    report: [...crud],
    timeEntry: [...crud],
    location: ['read'],
    equipment: ['read'],
    maintenance: [...crud],
    depot: [...crud],
    depotMaintenance: [...crud],
    tool: [...crud],
    toolMaintenance: [...crud],
    toolTransfer: ['create', 'read', 'delete'],
    toolIssue: [...crud],
    product: [...crud],
    productCategory: ['read'],
    supplier: [...crud],
    purchase: [...crud],
    stockMovement: ['create', 'read', 'delete'],
    habilitation: ['read', 'update'],
  },
  terrain: {
    client: ['read'],
    contact: ['read'],
    deal: ['read'],
    activity: ['read'],
    site: ['read'],
    report: ['create', 'read', 'update'],
    timeEntry: ['create', 'read', 'update'],
    location: ['read'],
    equipment: ['read'],
    maintenance: ['create', 'read', 'update'],
    depot: ['read'],
    depotMaintenance: ['create', 'read', 'update'],
    tool: ['read'],
    toolMaintenance: ['create', 'read', 'update'],
    toolTransfer: ['create', 'read'],
    toolIssue: ['create', 'read'],
    product: ['read'],
    productCategory: ['read'],
    supplier: ['read'],
    purchase: ['read'],
    stockMovement: ['create', 'read'],
    habilitation: ['read'],
  },
}

// Rôles Better-Auth dérivés des matrices ci-dessus (+ statements org natifs).
// `BUILTIN_PERMISSIONS` étant typé `Partial`, on cast vers la forme attendue par
// `newRole` (la résolution métier passe par `can()`, ces rôles ne servent qu'à
// l'access-control natif du plugin organization).
type NewRoleArg = Parameters<typeof ac.newRole>[0]
const newBuiltinRole = (matrix: PermissionMatrix, native: Record<string, readonly string[]> = {}) =>
  ac.newRole({ ...native, ...matrix } as unknown as NewRoleArg)

export const owner = newBuiltinRole(BUILTIN_PERMISSIONS.owner, ownerAc.statements)
export const admin = newBuiltinRole(BUILTIN_PERMISSIONS.admin, adminAc.statements)
export const member = newBuiltinRole(BUILTIN_PERMISSIONS.member, memberAc.statements)
export const commercial = newBuiltinRole(BUILTIN_PERMISSIONS.commercial)
export const conducteur = newBuiltinRole(BUILTIN_PERMISSIONS.conducteur)
export const terrain = newBuiltinRole(BUILTIN_PERMISSIONS.terrain)

export const roles = { owner, admin, member, commercial, conducteur, terrain }

/** Liste des rôles intégrés assignables à l'invitation (hors `owner`). */
export const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'commercial', 'conducteur', 'terrain']

/** Libellés FR des rôles intégrés (UI). Les rôles custom portent leur propre `name`. */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  commercial: 'Commercial',
  conducteur: 'Conducteur de travaux',
  terrain: 'Terrain',
  member: 'Membre',
}

/** Renvoie la matrice d'un rôle intégré, ou `null` si le slug n'en est pas un. */
export const resolveBuiltinPermissions = (role: string): PermissionMatrix | null =>
  role in BUILTIN_PERMISSIONS ? BUILTIN_PERMISSIONS[role as AppRole] : null

/** Indique si un slug correspond à un rôle intégré (non modifiable/supprimable). */
export const isBuiltinRole = (role: string): boolean => role in BUILTIN_PERMISSIONS

const matrixAllows = (
  matrix: PermissionMatrix | null | undefined,
  resource: BusinessResource,
  action: Action
): boolean => Boolean(matrix?.[resource]?.includes(action))

/**
 * Vérifie une permission de façon **synchrone**.
 * - `subject` string : slug d'un rôle intégré (rétro-compat).
 * - `subject` contexte : `{ role, permissions }` — la matrice portée par
 *   `OrgContext` fait foi (rôles intégrés **et** custom). Cf. CLAUDE.md §4.
 */
export const can = (
  subject: string | { role: string; permissions?: PermissionMatrix | null },
  resource: BusinessResource,
  action: Action
): boolean => {
  if (typeof subject === 'string') {
    return matrixAllows(resolveBuiltinPermissions(subject), resource, action)
  }
  if (subject.permissions) return matrixAllows(subject.permissions, resource, action)
  return matrixAllows(resolveBuiltinPermissions(subject.role), resource, action)
}
