'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toolIssueSeverityEnum } from '@/database/schema'
import { TOOL_ISSUE_SEVERITY_LABELS, TOOL_ISSUE_STATUS_LABELS } from '@/lib/crm/labels'
import type { ToolIssueItem } from '@/services/crm/tool-issue'
import { reportIssueAction, resolveIssueAction } from '../../actions'

interface ToolIssuesSectionProps {
  toolId: string
  issues: ToolIssueItem[]
  canReport: boolean
  canResolve: boolean
}

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(d)
  )

const severityClass = (severity: string): string =>
  severity === 'bloquant'
    ? 'text-destructive-foreground'
    : severity === 'majeur'
      ? 'text-amber-600 dark:text-amber-500'
      : ''

export const ToolIssuesSection = ({
  toolId,
  issues,
  canReport,
  canResolve,
}: ToolIssuesSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [severity, setSeverity] = useState<string>('mineur')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const openCount = issues.filter((i) => i.status !== 'resolu').length

  const handleReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await reportIssueAction(toolId, {
      severity,
      description: String(fd.get('description') ?? ''),
    })
    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    setSeverity('mineur')
    setOpen(false)
    router.refresh()
  }

  const handleResolve = async (issueId: string) => {
    setResolvingId(issueId)
    await resolveIssueAction(issueId, toolId)
    setResolvingId(null)
    router.refresh()
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <AlertTriangle className='size-4' /> Problèmes
          {openCount > 0 && (
            <Badge variant='outline' className='text-destructive-foreground'>
              {openCount} ouvert{openCount > 1 ? 's' : ''}
            </Badge>
          )}
        </h2>
        {canReport && (
          <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
            <Plus className='size-4' /> Signaler
          </Button>
        )}
      </div>

      {issues.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun problème signalé.</p>
      ) : (
        <ul className='divide-y'>
          {issues.map((i) => {
            const resolved = i.status === 'resolu'
            return (
              <li key={i.id} className='flex items-start gap-3 px-5 py-3'>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline' className={severityClass(i.severity)}>
                      {TOOL_ISSUE_SEVERITY_LABELS[i.severity] ?? i.severity}
                    </Badge>
                    <Badge variant={resolved ? 'secondary' : 'outline'}>
                      {TOOL_ISSUE_STATUS_LABELS[i.status] ?? i.status}
                    </Badge>
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap text-sm ${resolved ? 'text-muted-foreground' : ''}`}
                  >
                    {i.description}
                  </p>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    Signalé le {formatDate(i.createdAt)}
                    {i.reportedByName && ` par ${i.reportedByName}`}
                    {resolved &&
                      i.resolvedAt &&
                      ` · résolu le ${formatDate(i.resolvedAt)}${i.resolvedByName ? ` par ${i.resolvedByName}` : ''}`}
                  </p>
                </div>
                {canResolve && !resolved && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={resolvingId === i.id}
                    onClick={() => handleResolve(i.id)}
                  >
                    {resolvingId === i.id ? (
                      <Loader2 className='size-4 animate-spin' />
                    ) : (
                      <Check className='size-4' />
                    )}
                    Résoudre
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canReport && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>Signaler un problème</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReport} className='flex min-h-0 flex-1 flex-col'>
              <DialogPanel className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Gravité</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v ?? 'mineur')}>
                    <SelectTrigger>
                      <SelectValue>
                        {(value) => TOOL_ISSUE_SEVERITY_LABELS[value as string] ?? ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {toolIssueSeverityEnum.enumValues.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TOOL_ISSUE_SEVERITY_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className='text-xs text-muted-foreground'>
                    Un problème « bloquant » met le matériel en panne.
                  </p>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='description'>Description</Label>
                  <Textarea
                    id='description'
                    name='description'
                    placeholder='Décrivez le problème constaté…'
                    required
                  />
                </div>
                {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
              </DialogPanel>
              <DialogFooter>
                <DialogClose render={<Button variant='outline' type='button' />}>
                  Annuler
                </DialogClose>
                <Button type='submit' disabled={submitting}>
                  {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Signaler'}
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      )}
    </section>
  )
}
