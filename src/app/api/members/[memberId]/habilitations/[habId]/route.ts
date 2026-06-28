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
import { updateHabilitation } from '@/services/org/habilitation'
import { habilitationUpdateSchema } from '@/validation/habilitation'

export const dynamic = 'force-dynamic'

/**
 * Mise à jour d'une habilitation (métadonnées + remplacement de document optionnel).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string; habId: string }> }
) {
  const { memberId, habId } = await params
  try {
    const ctx = await requireOrgContext()
    const form = await request.formData()

    const meta = habilitationUpdateSchema.parse({
      type: form.get('type') ?? undefined,
      name: form.get('name') ?? undefined,
      issuer: form.get('issuer') ?? undefined,
      reference: form.get('reference') ?? undefined,
      issuedAt: form.get('issuedAt') ?? undefined,
      expiresAt: form.get('expiresAt') ?? undefined,
    })

    const fileEntry = form.get('file')
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : undefined

    await updateHabilitation(ctx, { habId, meta, file })
    revalidatePath(`/equipe/${memberId}`)
    revalidatePath('/equipe')
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: e.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      )
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    if (e instanceof StorageNotConfiguredError)
      return NextResponse.json({ error: e.message }, { status: 503 })
    console.error('update habilitation failed', e)
    return NextResponse.json({ error: "Échec de l'enregistrement" }, { status: 500 })
  }
}
