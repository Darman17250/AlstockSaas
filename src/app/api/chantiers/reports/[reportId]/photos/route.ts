import { NextResponse } from 'next/server'

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  requireOrgContext,
} from '@/lib/auth/org-context'
import { StorageNotConfiguredError } from '@/lib/supabase-storage'
import { uploadSiteReportPhoto } from '@/services/crm/site-report-photo'

export const dynamic = 'force-dynamic'

/** Upload d'une photo sur un rapport de chantier (images uniquement). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  try {
    const ctx = await requireOrgContext()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const photo = await uploadSiteReportPhoto(ctx, { reportId, file })
    return NextResponse.json({ ok: true, id: photo.id }, { status: 201 })
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('upload site report photo failed', e)
    return NextResponse.json({ error: "Échec de l'envoi de la photo" }, { status: 500 })
  }
}
