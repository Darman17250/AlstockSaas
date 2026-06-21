import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { uploadDealDocument } from '@/services/crm/deal-document'

export const dynamic = 'force-dynamic'

/**
 * Upload d'un document d'affaire. Route Handler (façade fine) : le fichier
 * transite côté serveur, qui l'envoie au stockage et enregistre les métadonnées.
 * Réutilisable par le futur client mobile (cf. CLAUDE.md §7).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await requireOrgContext()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const doc = await uploadDealDocument(ctx, { dealId: id, file })
    revalidatePath(`/affaires/${id}`)
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 })
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('upload deal document failed', e)
    return NextResponse.json({ error: "Échec de l'envoi du fichier" }, { status: 500 })
  }
}
