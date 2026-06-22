import { NextResponse } from 'next/server'

import { NotFoundError, UnauthorizedError, requireOrgContext } from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { getTaskDocumentDownload } from '@/services/crm/task-document'

export const dynamic = 'force-dynamic'

/**
 * Affichage / téléchargement d'une pièce jointe de tâche : redirige vers une URL
 * signée temporaire (bucket privé). `?download=1` force le téléchargement.
 */
export async function GET(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  try {
    const ctx = await requireOrgContext()
    const { url, fileName } = await getTaskDocumentDownload(ctx, docId)

    const forceDownload = new URL(request.url).searchParams.get('download') === '1'
    const target = forceDownload ? `${url}&download=${encodeURIComponent(fileName)}` : url

    return NextResponse.redirect(target)
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('download task document failed', e)
    return NextResponse.json({ error: 'Échec du téléchargement' }, { status: 500 })
  }
}
