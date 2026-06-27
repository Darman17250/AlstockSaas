import 'server-only'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'

import { db } from '@/database'
import { member, site, siteReport, siteReportPhoto, user } from '@/database/schema'
import {
  type OrgContext,
  ForbiddenError,
  NotFoundError,
  requirePermission,
} from '@/lib/auth/org-context'
import type { SiteReportCreateInput, SiteReportUpdateInput } from '@/validation/site-report'

/**
 * Services — rapports de chantier journaliers (`site_report`). Couche métier pure.
 * Cloisonnement multi-tenant : filtre `organizationId` partout. Soft-delete.
 * Un seul rapport par (chantier, jour) — vérifié côté service + contrainte d'unicité en base.
 */

const assertSiteInOrg = async (ctx: OrgContext, siteId: string): Promise<void> => {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(
      and(eq(site.id, siteId), eq(site.organizationId, ctx.organizationId), isNull(site.deletedAt))
    )
    .limit(1)
  if (!row) throw new NotFoundError('Chantier introuvable')
}

export interface SiteReportPhotoView {
  id: string
  caption: string | null
}

export interface SiteReportItem {
  id: string
  reportDate: string
  weather: string | null
  temperature: number | null
  workforceCount: number | null
  progressNotes: string | null
  issues: string | null
  authorId: string | null
  authorName: string | null
  photos: SiteReportPhotoView[]
}

export const listSiteReports = async (
  ctx: OrgContext,
  siteId: string
): Promise<SiteReportItem[]> => {
  requirePermission(ctx, 'report', 'read')

  const rows = await db
    .select({
      id: siteReport.id,
      reportDate: siteReport.reportDate,
      weather: siteReport.weather,
      temperature: siteReport.temperature,
      workforceCount: siteReport.workforceCount,
      progressNotes: siteReport.progressNotes,
      issues: siteReport.issues,
      authorId: siteReport.authorId,
      authorName: user.name,
      authorEmail: user.email,
    })
    .from(siteReport)
    .leftJoin(member, eq(siteReport.authorId, member.id))
    .leftJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(siteReport.siteId, siteId),
        eq(siteReport.organizationId, ctx.organizationId),
        isNull(siteReport.deletedAt)
      )
    )
    .orderBy(desc(siteReport.reportDate))

  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const photoRows = await db
    .select({
      id: siteReportPhoto.id,
      reportId: siteReportPhoto.reportId,
      caption: siteReportPhoto.caption,
    })
    .from(siteReportPhoto)
    .where(
      and(
        inArray(siteReportPhoto.reportId, ids),
        eq(siteReportPhoto.organizationId, ctx.organizationId)
      )
    )

  const byReport = new Map<string, SiteReportPhotoView[]>()
  for (const p of photoRows) {
    const list = byReport.get(p.reportId) ?? []
    list.push({ id: p.id, caption: p.caption })
    byReport.set(p.reportId, list)
  }

  return rows.map((r) => ({
    id: r.id,
    reportDate: r.reportDate,
    weather: r.weather,
    temperature: r.temperature,
    workforceCount: r.workforceCount,
    progressNotes: r.progressNotes,
    issues: r.issues,
    authorId: r.authorId,
    authorName: r.authorName || r.authorEmail,
    photos: byReport.get(r.id) ?? [],
  }))
}

/** Garantit l'unicité (chantier, jour) hors rapports supprimés. */
const assertNoDuplicate = async (
  ctx: OrgContext,
  siteId: string,
  reportDate: string,
  exceptId?: string
): Promise<void> => {
  const conditions = [
    eq(siteReport.siteId, siteId),
    eq(siteReport.organizationId, ctx.organizationId),
    eq(siteReport.reportDate, reportDate),
    isNull(siteReport.deletedAt),
  ]
  if (exceptId) conditions.push(ne(siteReport.id, exceptId))
  const [row] = await db
    .select({ id: siteReport.id })
    .from(siteReport)
    .where(and(...conditions))
    .limit(1)
  if (row) throw new ForbiddenError('Un rapport existe déjà pour ce jour.')
}

const toColumns = (input: SiteReportCreateInput | SiteReportUpdateInput) => ({
  reportDate: input.reportDate,
  weather: input.weather ?? null,
  temperature: input.temperature ?? null,
  workforceCount: input.workforceCount ?? null,
  progressNotes: input.progressNotes ?? null,
  issues: input.issues ?? null,
})

export const createSiteReport = async (ctx: OrgContext, input: SiteReportCreateInput) => {
  requirePermission(ctx, 'report', 'create')
  await assertSiteInOrg(ctx, input.siteId)
  await assertNoDuplicate(ctx, input.siteId, input.reportDate)

  const [created] = await db
    .insert(siteReport)
    .values({
      ...toColumns(input),
      organizationId: ctx.organizationId,
      siteId: input.siteId,
      authorId: ctx.memberId,
    })
    .returning({ id: siteReport.id })

  return created
}

export const updateSiteReport = async (
  ctx: OrgContext,
  id: string,
  input: SiteReportUpdateInput
) => {
  requirePermission(ctx, 'report', 'update')

  const [current] = await db
    .select({ siteId: siteReport.siteId })
    .from(siteReport)
    .where(
      and(
        eq(siteReport.id, id),
        eq(siteReport.organizationId, ctx.organizationId),
        isNull(siteReport.deletedAt)
      )
    )
    .limit(1)
  if (!current) throw new NotFoundError('Rapport introuvable')

  await assertNoDuplicate(ctx, current.siteId, input.reportDate, id)

  const [updated] = await db
    .update(siteReport)
    .set(toColumns(input))
    .where(and(eq(siteReport.id, id), eq(siteReport.organizationId, ctx.organizationId)))
    .returning({ id: siteReport.id })

  return updated
}

export const softDeleteSiteReport = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'report', 'delete')

  const [deleted] = await db
    .update(siteReport)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(siteReport.id, id),
        eq(siteReport.organizationId, ctx.organizationId),
        isNull(siteReport.deletedAt)
      )
    )
    .returning({ id: siteReport.id })

  if (!deleted) throw new NotFoundError('Rapport introuvable')
}
