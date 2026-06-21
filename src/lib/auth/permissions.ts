/**
 * Access-control métier (partagé serveur + client).
 *
 * Rôles (cf. CLAUDE.md §4) :
 *  - owner   : créateur de l'organisation — accès complet (rôle natif Better-Auth).
 *  - admin   : accès complet (rôle natif Better-Auth).
 *  - commercial : CRM complet, lecture chantiers.
 *  - conducteur : chantiers complets, lecture CRM.
 *  - terrain    : rapports + pointage, lecture limitée.
 *
 * Les permissions sont vérifiées dans la couche service (jamais seulement côté UI).
 */
import { createAccessControl } from 'better-auth/plugins/access'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

const crud = ['create', 'read', 'update', 'delete'] as const

/** Ressources métier + actions, en plus des statements org natifs (member/invitation…). */
export const statement = {
  ...defaultStatements,
  client: crud,
  contact: crud,
  deal: crud,
  activity: crud,
  site: crud,
  report: crud,
  timeEntry: crud,
} as const

export const ac = createAccessControl(statement)

const fullBusiness = {
  client: [...crud],
  contact: [...crud],
  deal: [...crud],
  activity: [...crud],
  site: [...crud],
  report: [...crud],
  timeEntry: [...crud],
}

// Rôles natifs étendus avec l'accès métier complet.
export const owner = ac.newRole({ ...ownerAc.statements, ...fullBusiness })
export const admin = ac.newRole({ ...adminAc.statements, ...fullBusiness })
// `member` natif : aucun accès métier par défaut (on assigne toujours un rôle explicite).
export const member = ac.newRole({ ...memberAc.statements })

export const commercial = ac.newRole({
  client: [...crud],
  contact: [...crud],
  deal: [...crud],
  activity: [...crud],
  site: ['read'],
  report: ['read'],
  timeEntry: ['read'],
})

export const conducteur = ac.newRole({
  client: ['read'],
  contact: ['read'],
  deal: ['read'],
  activity: [...crud],
  site: [...crud],
  report: [...crud],
  timeEntry: [...crud],
})

export const terrain = ac.newRole({
  client: ['read'],
  contact: ['read'],
  deal: ['read'],
  activity: ['read'],
  site: ['read'],
  report: ['create', 'read', 'update'],
  timeEntry: ['create', 'read', 'update'],
})

export const roles = { owner, admin, member, commercial, conducteur, terrain }

export type AppRole = keyof typeof roles
export type BusinessResource =
  | 'client'
  | 'contact'
  | 'deal'
  | 'activity'
  | 'site'
  | 'report'
  | 'timeEntry'
export type Action = (typeof crud)[number]

/** Liste des rôles assignables à l'invitation (hors `owner`, réservé au créateur). */
export const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'commercial', 'conducteur', 'terrain']

/** Libellés FR des rôles (UI). */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  commercial: 'Commercial',
  conducteur: 'Conducteur de travaux',
  terrain: 'Terrain',
  member: 'Membre',
}

/**
 * Vérifie une permission de façon synchrone à partir du rôle.
 * Utilisé dans la couche service. Renvoie `true` si autorisé.
 */
export const can = (role: string, resource: BusinessResource, action: Action): boolean => {
  // Tous les rôles partagent le même `ac`/statement ; on en fige un seul type
  // concret (`typeof owner`) pour rendre `authorize` appelable (l'union de
  // signatures par rôle ne l'est pas), et la clé dynamique passe via `as never`.
  const r = roles[role as AppRole] as typeof owner | undefined
  if (!r) return false
  return r.authorize({ [resource]: [action] } as never).success
}
