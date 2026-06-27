import { z } from 'zod'

import { weatherEnum } from '@/database/schema'

/**
 * Schémas de validation des rapports de chantier journaliers (`site_report`).
 * Un seul rapport par (chantier, jour) — l'unicité est aussi garantie en base.
 */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())

export const siteReportFieldsSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  weather: z.preprocess(emptyToUndefined, z.enum(weatherEnum.enumValues).optional()),
  temperature: z.preprocess(emptyToUndefined, z.coerce.number().int().min(-50).max(60).optional()),
  workforceCount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(999).optional()
  ),
  progressNotes: optionalText,
  issues: optionalText,
})

export const siteReportCreateSchema = siteReportFieldsSchema.extend({
  siteId: z.uuid('Chantier requis'),
})
export const siteReportUpdateSchema = siteReportFieldsSchema

export type SiteReportCreateInput = z.infer<typeof siteReportCreateSchema>
export type SiteReportUpdateInput = z.infer<typeof siteReportUpdateSchema>
