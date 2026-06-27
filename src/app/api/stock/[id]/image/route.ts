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
import { getProductImageUrl, uploadProductImage } from '@/services/crm/product'

export const dynamic = 'force-dynamic'

/** Sert l'image d'un produit (redirection vers une URL signée temporaire). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await requireOrgContext()
    const url = await getProductImageUrl(ctx, id)
    if (!url) return NextResponse.json({ error: 'Aucune image' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (e) {
    if (e instanceof UnauthorizedError)
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 })
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 })
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

/** Upload/remplacement de l'image d'un produit. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await requireOrgContext()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Format d’image non supporté' }, { status: 400 })
    }

    await uploadProductImage(ctx, { productId: id, file })
    revalidatePath('/stock')
    revalidatePath(`/stock/${id}`)
    return NextResponse.json({ ok: true }, { status: 201 })
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
    console.error('upload product image failed', e)
    return NextResponse.json({ error: "Échec de l'envoi de l'image" }, { status: 500 })
  }
}
