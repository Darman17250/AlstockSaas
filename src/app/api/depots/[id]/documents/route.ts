import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { uploadDepotDocument } from '@/services/crm/depot-document'
import { depotDocumentMetaSchema } from '@/validation/depot-document'

export const dynamic = 'force-dynamic'

/**
 * Upload d'un document de dépôt/véhicule (carte grise, assurance, CT…). Route
 * Handler (façade fine) : le fichier transite côté serveur, qui l'envoie au
 * stockage et enregistre les métadonnées (catégorie + date d'expiration).
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

    const meta = depotDocumentMetaSchema.parse({
      category: form.get('category') ?? undefined,
      expiresAt: form.get('expiresAt') ?? undefined,
    })

    const doc = await uploadDepotDocument(ctx, { depotId: id, file, meta })
    revalidatePath(`/depots/${id}`)
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.issues[0]?.message ?? 'Données invalides' }, { status: 400 })
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('upload depot document failed', e)
    return NextResponse.json({ error: "Échec de l'envoi du fichier" }, { status: 500 })
  }
}
