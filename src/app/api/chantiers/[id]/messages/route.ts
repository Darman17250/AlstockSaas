import { NextResponse } from 'next/server'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { createSiteMessage, listSiteMessages } from '@/services/crm/site-message'

export const dynamic = 'force-dynamic'

/** Liste des messages d'un chantier (polling : `?since=<ISO>` pour l'incrémental). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await requireOrgContext()
    const sinceParam = new URL(request.url).searchParams.get('since')
    const since = sinceParam ? new Date(sinceParam) : undefined
    const opts = since && !Number.isNaN(since.getTime()) ? { since } : {}
    const messages = await listSiteMessages(ctx, id, opts)
    return NextResponse.json({ messages })
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    console.error('list site messages failed', e)
    return NextResponse.json({ error: 'Échec du chargement' }, { status: 500 })
  }
}

const parseIds = (raw: FormDataEntryValue | null): string[] => {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/**
 * Envoi d'un message (texte + mentions + pièces jointes images/vocaux).
 * Route Handler (façade fine) : les fichiers transitent côté serveur, le service
 * gère l'upload au stockage et l'insertion. Réutilisable par le futur mobile.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await requireOrgContext()
    const form = await request.formData()

    const body = typeof form.get('body') === 'string' ? (form.get('body') as string) : undefined
    const memberIds = parseIds(form.get('memberIds'))
    const taskIds = parseIds(form.get('taskIds'))

    const durationRaw = form.get('durationMs')
    const durationMs =
      typeof durationRaw === 'string' && durationRaw ? Number(durationRaw) : undefined

    const files = form
      .getAll('files')
      .filter((f): f is File => f instanceof File)
      .map((file) => ({
        file,
        durationMs: file.type.startsWith('audio/') ? durationMs : undefined,
      }))

    const created = await createSiteMessage(ctx, {
      siteId: id,
      body,
      memberIds,
      taskIds,
      attachments: files,
    })

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('create site message failed', e)
    return NextResponse.json({ error: "Échec de l'envoi" }, { status: 500 })
  }
}
