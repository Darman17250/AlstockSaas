import { z } from 'zod'

import { toolIssueSeverityEnum } from '@/database/schema'

/**
 * Signalement d'un problème sur un matériel (panne, casse, dysfonctionnement).
 * Cycle de vie via le statut : ouvert → en_cours → resolu.
 */

export const toolIssueReportSchema = z.object({
  severity: z.enum(toolIssueSeverityEnum.enumValues).default('mineur'),
  description: z.string().trim().min(1, 'Description requise'),
})

export type ToolIssueReportInput = z.infer<typeof toolIssueReportSchema>
