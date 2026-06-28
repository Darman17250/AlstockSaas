/**
 * Seed de la bibliothèque catalogue (Alstock Admin) depuis le classeur Excel
 * `biblio/`. Importe catégories, sous-catégories et produits, et téléverse les
 * images dans le bucket Supabase partagé (préfixe `library/`).
 *
 * Usage :
 *   bun run ./scripts/seed-library.ts            # n'agit que si le catalogue est vide
 *   bun run ./scripts/seed-library.ts --force    # purge puis réimporte tout
 *
 * Les onglets FROID et VENTILATION sont volontairement ignorés (vides / hors lot).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { isNull, sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as XLSX from 'xlsx'

import { libraryCategory, libraryProduct, librarySubcategory } from '../src/database/schema'

config()

const BIBLIO_DIR = join(process.cwd(), 'biblio')
const XLSX_PATH = join(BIBLIO_DIR, 'BIBLIOTHEQUE - Plombier, chauffagiste, frigoriste.xlsx')
const IMAGES_DIR = join(BIBLIO_DIR, '0 - IMAGES CODAGE SEUL')
const SKIP_SHEETS = /CATEGORIES|FROID|VENTILATION/i

const force = process.argv.includes('--force')

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'affaire-documents'
const storageReady = Boolean(SUPABASE_URL && SUPABASE_KEY)

type Unit = 'u' | 'ml' | 'm2' | 'm3' | 'kg' | 't' | 'l' | 'sac' | 'palette' | 'rouleau' | 'boite' | 'lot' | 'h'

const mapUnit = (raw: string): Unit => {
  const v = raw.trim().toLowerCase()
  if (v === 'ml') return 'ml'
  return 'u' // "Unité", "u", défaut
}

interface ParsedProduct {
  trade: string
  category: string
  subcategory: string
  title: string
  description: string | null
  unit: Unit
  imageCode: string | null
}

const parseWorkbook = (): ParsedProduct[] => {
  const wb = XLSX.readFile(XLSX_PATH)
  const out: ParsedProduct[] = []
  for (const name of wb.SheetNames) {
    if (SKIP_SHEETS.test(name)) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as unknown[][]
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const title = String(r[3] ?? '').trim()
      if (!title) continue
      const category = String(r[1] ?? '').trim()
      const subcategory = String(r[2] ?? '').trim() || category
      if (!category) continue
      const imageRaw = String(r[6] ?? '').trim()
      out.push({
        trade: String(r[0] ?? '').trim() || 'PLOMBIER - CHAUFFAGISTE - FRIGORISTE',
        category,
        subcategory,
        title,
        description: String(r[4] ?? '').trim() || null,
        unit: mapUnit(String(r[5] ?? '')),
        imageCode: imageRaw || null,
      })
    }
  }
  return out
}

/** Index code → nom de fichier image (gère les extensions .jpg/.JPG). */
const buildImageIndex = (): Map<string, string> => {
  const index = new Map<string, string>()
  for (const file of readdirSync(IMAGES_DIR)) {
    const dot = file.lastIndexOf('.')
    const code = dot === -1 ? file : file.slice(0, dot)
    if (!index.has(code)) index.set(code, file)
  }
  return index
}

const uploadImage = async (fileName: string): Promise<void> => {
  const body = readFileSync(join(IMAGES_DIR, fileName))
  const path = `library/${fileName}`
  const res = await fetch(
    `${SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body,
    }
  )
  if (!res.ok && res.status !== 409) {
    throw new Error(`Upload échoué pour ${fileName} (${res.status})`)
  }
}

const main = async () => {
  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client)

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(libraryCategory)
      .where(isNull(libraryCategory.deletedAt))

    if (count > 0 && !force) {
      console.log(`Catalogue déjà alimenté (${count} catégories). Utilisez --force pour réimporter.`)
      return
    }

    if (force) {
      console.log('--force : purge du catalogue existant…')
      await db.delete(libraryProduct)
      await db.delete(librarySubcategory)
      await db.delete(libraryCategory)
    }

    console.log('Lecture du classeur…')
    const products = parseWorkbook()
    console.log(`${products.length} produits trouvés.`)

    const imageIndex = buildImageIndex()

    // 1) Catégories (uniques par nom).
    const categoryNames: string[] = []
    const tradeByCategory = new Map<string, string>()
    for (const p of products) {
      if (!tradeByCategory.has(p.category)) {
        tradeByCategory.set(p.category, p.trade)
        categoryNames.push(p.category)
      }
    }
    const categoryRows = await db
      .insert(libraryCategory)
      .values(
        categoryNames.map((name, i) => ({
          name,
          trade: tradeByCategory.get(name)!,
          position: i,
        }))
      )
      .returning({ id: libraryCategory.id, name: libraryCategory.name })
    const categoryId = new Map(categoryRows.map((c) => [c.name, c.id]))
    console.log(`${categoryRows.length} catégories insérées.`)

    // 2) Sous-catégories (uniques par catégorie + nom).
    const subSeen = new Set<string>()
    const subValues: { categoryId: string; name: string; position: number }[] = []
    for (const p of products) {
      const key = `${p.category}|||${p.subcategory}`
      if (subSeen.has(key)) continue
      subSeen.add(key)
      subValues.push({
        categoryId: categoryId.get(p.category)!,
        name: p.subcategory,
        position: subValues.length,
      })
    }
    const subRows = await db
      .insert(librarySubcategory)
      .values(subValues)
      .returning({ id: librarySubcategory.id, categoryId: librarySubcategory.categoryId, name: librarySubcategory.name })
    const subId = new Map(subRows.map((s) => [`${s.categoryId}|||${s.name}`, s.id]))
    console.log(`${subRows.length} sous-catégories insérées.`)

    // 3) Upload des images référencées (distinctes).
    if (storageReady) {
      const codes = new Set<string>()
      for (const p of products) if (p.imageCode && imageIndex.has(p.imageCode)) codes.add(p.imageCode)
      console.log(`Upload de ${codes.size} images vers Supabase…`)
      let done = 0
      for (const code of codes) {
        await uploadImage(imageIndex.get(code)!)
        done++
        if (done % 50 === 0) console.log(`  …${done}/${codes.size}`)
      }
      console.log(`${done} images téléversées.`)
    } else {
      console.warn('Supabase non configuré : import des produits sans images.')
    }

    // 4) Produits.
    const productValues = products.map((p) => {
      const cid = categoryId.get(p.category)!
      const sid = subId.get(`${cid}|||${p.subcategory}`)!
      const file = p.imageCode ? imageIndex.get(p.imageCode) : undefined
      return {
        categoryId: cid,
        subcategoryId: sid,
        title: p.title,
        description: p.description,
        unit: p.unit,
        imagePath: file && storageReady ? `library/${file}` : null,
      }
    })
    let inserted = 0
    const BATCH = 500
    for (let i = 0; i < productValues.length; i += BATCH) {
      const batch = productValues.slice(i, i + BATCH)
      await db.insert(libraryProduct).values(batch)
      inserted += batch.length
      console.log(`  produits ${inserted}/${productValues.length}`)
    }
    console.log(`Terminé : ${inserted} produits importés.`)
  } catch (e) {
    console.error('Seed échoué :', e)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
