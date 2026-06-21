import { NextResponse } from 'next/server'

import { NotFoundError, UnauthorizedError, requireOrgContext } from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { getSiteMessageAttachmentDownload } from '@/services/crm/site-message'

export const dynamic = 'force-dynamic'

/**
 * Affichage / lecture d'une pièce jointe de message : redirige vers une URL
 * signée temporaire (bucket privé). Sert de `src` aux <img>/<audio> (inline) ;
 * `?download=1` force le téléchargement.
 */
export async function GET(request: Request, { params }: { params: Promise<{ attId: string }> }) {
  const { attId } = await params
  try {
    const ctx = await requireOrgContext()
    const { url, fileName } = await getSiteMessageAttachmentDownload(ctx, attId)

    const forceDownload = new URL(request.url).searchParams.get('download') === '1'
    const target = forceDownload ? `${url}&download=${encodeURIComponent(fileName)}` : url

    return NextResponse.redirect(target)
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('download site message attachment failed', e)
    return NextResponse.json({ error: 'Échec du téléchargement' }, { status: 500 })
  }
}
