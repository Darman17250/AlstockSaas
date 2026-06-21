import { NextResponse } from 'next/server'

import { NotFoundError, UnauthorizedError, requireOrgContext } from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { getDealDocumentDownload } from '@/services/crm/deal-document'

export const dynamic = 'force-dynamic'

/**
 * Téléchargement d'un document : redirige vers une URL signée temporaire
 * (bucket privé). `?download=1` force le téléchargement avec le nom d'origine.
 */
export async function GET(request: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  try {
    const ctx = await requireOrgContext()
    const { url, fileName } = await getDealDocumentDownload(ctx, docId)

    const forceDownload = new URL(request.url).searchParams.get('download') === '1'
    const target = forceDownload ? `${url}&download=${encodeURIComponent(fileName)}` : url

    return NextResponse.redirect(target)
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('download deal document failed', e)
    return NextResponse.json({ error: 'Échec du téléchargement' }, { status: 500 })
  }
}
