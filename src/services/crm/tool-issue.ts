import 'server-only'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@/database'
import { member, tool, toolIssue, user } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { ToolIssueReportInput } from '@/validation/tool-issue'

/**
 * Services — signalements de problème sur un matériel. Pas de soft-delete :
 * le cycle de vie passe par le statut (ouvert → en_cours → resolu).
 * Un problème `bloquant` met le matériel `en_panne` ; résoudre le dernier
 * problème ouvert d'un matériel `en_panne` le repasse `disponible`.
 */

const assertToolInOrg = async (ctx: OrgContext, toolId: string): Promise<void> => {
  const [row] = await db
    .select({ id: tool.id })
    .from(tool)
    .where(
      and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId), isNull(tool.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Matériel introuvable')
}

export interface ToolIssueItem {
  id: string
  severity: string
  status: string
  description: string
  reportedByName: string | null
  resolvedByName: string | null
  resolvedAt: Date | null
  createdAt: Date
}

export const listIssuesForTool = async (
  ctx: OrgContext,
  toolId: string
): Promise<ToolIssueItem[]> => {
  requirePermission(ctx, 'toolIssue', 'read')

  const rows = await db
    .select({
      id: toolIssue.id,
      severity: toolIssue.severity,
      status: toolIssue.status,
      description: toolIssue.description,
      reportedById: toolIssue.reportedById,
      resolvedById: toolIssue.resolvedById,
      resolvedAt: toolIssue.resolvedAt,
      createdAt: toolIssue.createdAt,
    })
    .from(toolIssue)
    .where(and(eq(toolIssue.toolId, toolId), eq(toolIssue.organizationId, ctx.organizationId)))
    .orderBy(desc(toolIssue.createdAt))

  // Noms des intervenants (membres de l'org) en une lookup.
  const members = await db
    .select({ id: member.id, name: user.name })
    .from(member)
    .leftJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.organizationId))
  const memberName = new Map(members.map((m) => [m.id, m.name]))

  return rows.map((r) => ({
    id: r.id,
    severity: r.severity,
    status: r.status,
    description: r.description,
    reportedByName: r.reportedById ? (memberName.get(r.reportedById) ?? null) : null,
    resolvedByName: r.resolvedById ? (memberName.get(r.resolvedById) ?? null) : null,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  }))
}

export const reportIssue = async (
  ctx: OrgContext,
  toolId: string,
  input: ToolIssueReportInput
) => {
  requirePermission(ctx, 'toolIssue', 'create')
  await assertToolInOrg(ctx, toolId)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(toolIssue)
      .values({
        organizationId: ctx.organizationId,
        toolId,
        severity: input.severity,
        description: input.description,
        reportedById: ctx.memberId,
      })
      .returning({ id: toolIssue.id })

    // Un problème bloquant met le matériel en panne.
    if (input.severity === 'bloquant') {
      await tx
        .update(tool)
        .set({ status: 'en_panne' })
        .where(and(eq(tool.id, toolId), eq(tool.organizationId, ctx.organizationId)))
    }

    return created
  })
}

export const resolveIssue = async (ctx: OrgContext, issueId: string): Promise<void> => {
  requirePermission(ctx, 'toolIssue', 'update')

  await db.transaction(async (tx) => {
    const [issue] = await tx
      .select({ toolId: toolIssue.toolId })
      .from(toolIssue)
      .where(
        and(eq(toolIssue.id, issueId), eq(toolIssue.organizationId, ctx.organizationId))
      )
      .limit(1)

    if (!issue) throw new NotFoundError('Problème introuvable')

    await tx
      .update(toolIssue)
      .set({ status: 'resolu', resolvedById: ctx.memberId, resolvedAt: new Date() })
      .where(and(eq(toolIssue.id, issueId), eq(toolIssue.organizationId, ctx.organizationId)))

    // S'il ne reste plus aucun problème ouvert et que le matériel est en panne,
    // on le repasse disponible.
    const [{ openCount }] = await tx
      .select({ openCount: sql<number>`count(*)::int` })
      .from(toolIssue)
      .where(
        and(
          eq(toolIssue.toolId, issue.toolId),
          eq(toolIssue.organizationId, ctx.organizationId),
          ne(toolIssue.status, 'resolu')
        )
      )

    if (openCount === 0) {
      await tx
        .update(tool)
        .set({ status: 'disponible' })
        .where(
          and(
            eq(tool.id, issue.toolId),
            eq(tool.organizationId, ctx.organizationId),
            eq(tool.status, 'en_panne')
          )
        )
    }
  })
}
