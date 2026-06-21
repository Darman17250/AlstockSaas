import 'server-only'
import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { member, user } from '@/database/schema'
import type { OrgContext } from '@/lib/auth/org-context'

export interface OrgMemberOption {
  id: string
  name: string
  role: string
}

/** Membres de l'organisation active — pour les sélecteurs (propriétaire, etc.). */
export const listOrgMembers = async (ctx: OrgContext): Promise<OrgMemberOption[]> => {
  const rows = await db
    .select({ id: member.id, name: user.name, email: user.email, role: member.role })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.organizationId))

  return rows.map((r) => ({ id: r.id, name: r.name || r.email, role: r.role }))
}
