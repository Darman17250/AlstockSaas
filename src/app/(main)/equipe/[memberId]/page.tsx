import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { db } from '@/database'
import { customRole, member, user } from '@/database/schema'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can, isBuiltinRole, ROLE_LABELS } from '@/lib/auth/permissions'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { listMemberHabilitations } from '@/services/org/habilitation'
import { MemberHabilitationsSection } from './_components/member-habilitations-section'

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const ctx = await requireOrgContext()

  if (!can(ctx, 'habilitation', 'read')) notFound()

  const [m] = await db
    .select({ id: member.id, role: member.role, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.id, memberId), eq(member.organizationId, ctx.organizationId)))
    .limit(1)

  if (!m) notFound()

  // Libellé/couleur du rôle (intégré ou custom de l'org).
  let roleName = ROLE_LABELS[m.role] ?? m.role
  let roleColor: string | null = null
  if (!isBuiltinRole(m.role)) {
    const [cr] = await db
      .select({ name: customRole.name, color: customRole.color })
      .from(customRole)
      .where(and(eq(customRole.organizationId, ctx.organizationId), eq(customRole.slug, m.role)))
      .limit(1)
    if (cr) {
      roleName = cr.name
      roleColor = cr.color
    }
  }

  const habilitations = await listMemberHabilitations(ctx, memberId)
  const canWrite = can(ctx, 'habilitation', 'create')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Link
        href='/equipe'
        className='mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
      >
        <ArrowLeft className='size-4' /> Équipe
      </Link>

      <div className='mb-8 flex flex-wrap items-center gap-3'>
        <div className='flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary'>
          {(m.name?.trim() || m.email).slice(0, 2).toUpperCase()}
        </div>
        <div className='min-w-0'>
          <h1 className='truncate text-2xl font-bold tracking-tight'>{m.name || m.email}</h1>
          <p className='truncate text-sm text-muted-foreground'>{m.email}</p>
        </div>
        {roleColor ? (
          <Badge style={{ backgroundColor: roleColor, color: '#fff', borderColor: roleColor }}>
            {roleName}
          </Badge>
        ) : (
          <Badge variant='secondary'>{roleName}</Badge>
        )}
      </div>

      <MemberHabilitationsSection
        memberId={memberId}
        habilitations={habilitations}
        canWrite={canWrite}
        storageConfigured={isStorageConfigured()}
      />
    </div>
  )
}
