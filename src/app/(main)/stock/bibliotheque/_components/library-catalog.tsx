'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Loader2, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PRODUCT_UNIT_LABELS } from '@/lib/crm/labels'
import { cn } from '@/lib/utils'
import type { CatalogCategory, LibrarySubProduct } from '@/services/crm/library'
import { bulkAddLibraryAction, loadLibrarySubcategoryProductsAction } from '../actions'

interface LibraryCatalogProps {
  tree: CatalogCategory[]
  canAdd: boolean
}

const toggleSet = (prev: Set<string>, id: string): Set<string> => {
  const next = new Set(prev)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export const LibraryCatalog = ({ tree, canAdd }: LibraryCatalogProps) => {
  const router = useRouter()
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [selCats, setSelCats] = useState<Set<string>>(new Set())
  const [selSubs, setSelSubs] = useState<Set<string>>(new Set())
  const [selProds, setSelProds] = useState<Set<string>>(new Set())
  const [subProducts, setSubProducts] = useState<Map<string, LibrarySubProduct[]>>(new Map())
  const [loadingSubs, setLoadingSubs] = useState<Set<string>>(new Set())
  const [prodMeta, setProdMeta] = useState<Map<string, { subId: string; catId: string }>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)

  const subToCat = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of tree) for (const s of c.subcategories) m.set(s.id, c.id)
    return m
  }, [tree])

  const loadSub = useCallback(
    async (subId: string) => {
      if (subProducts.has(subId) || loadingSubs.has(subId)) return
      setLoadingSubs((prev) => new Set(prev).add(subId))
      const res = await loadLibrarySubcategoryProductsAction(subId)
      setLoadingSubs((prev) => {
        const n = new Set(prev)
        n.delete(subId)
        return n
      })
      if (res.ok) setSubProducts((prev) => new Map(prev).set(subId, res.data))
    },
    [subProducts, loadingSubs]
  )

  const toggleSubExpand = (subId: string) => {
    setExpandedSubs((prev) => {
      const next = toggleSet(prev, subId)
      if (next.has(subId)) loadSub(subId)
      return next
    })
  }

  // --- Sélection : sélectionner un parent couvre tous ses descendants. -------

  const toggleCat = (cat: CatalogCategory) => {
    setSelCats((prev) => toggleSet(prev, cat.id))
    setSelSubs((prev) => {
      const n = new Set(prev)
      for (const s of cat.subcategories) n.delete(s.id)
      return n
    })
    setSelProds((prev) => {
      const n = new Set(prev)
      for (const [pid, meta] of prodMeta) if (meta.catId === cat.id) n.delete(pid)
      return n
    })
  }

  const toggleSub = (subId: string) => {
    setSelSubs((prev) => toggleSet(prev, subId))
    setSelProds((prev) => {
      const n = new Set(prev)
      for (const [pid, meta] of prodMeta) if (meta.subId === subId) n.delete(pid)
      return n
    })
  }

  const toggleProd = (prodId: string, subId: string) => {
    const catId = subToCat.get(subId)
    if (catId) setProdMeta((prev) => new Map(prev).set(prodId, { subId, catId }))
    setSelProds((prev) => toggleSet(prev, prodId))
  }

  const anyProdInSub = (subId: string) => {
    for (const pid of selProds) if (prodMeta.get(pid)?.subId === subId) return true
    return false
  }
  const anyProdInCat = (catId: string) => {
    for (const pid of selProds) if (prodMeta.get(pid)?.catId === catId) return true
    return false
  }

  const subCovered = (subId: string) => selCats.has(subToCat.get(subId) ?? '') || selSubs.has(subId)
  const prodCovered = (prodId: string, subId: string) => subCovered(subId) || selProds.has(prodId)

  const selectedCount = useMemo(() => {
    let total = 0
    for (const c of tree) {
      if (selCats.has(c.id)) {
        total += c.productCount
        continue
      }
      for (const s of c.subcategories) if (selSubs.has(s.id)) total += s.productCount
    }
    total += selProds.size
    return total
  }, [tree, selCats, selSubs, selProds])

  const handleAdd = async () => {
    setSubmitting(true)
    setError(null)
    setResult(null)
    const res = await bulkAddLibraryAction({
      categoryIds: [...selCats],
      subcategoryIds: [...selSubs],
      productIds: [...selProds],
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setResult(res.data)
    setSelCats(new Set())
    setSelSubs(new Set())
    setSelProds(new Set())
    router.refresh()
  }

  return (
    <div className='space-y-4 pb-24'>
      {result && (
        <p className='rounded-md border border-primary/20 bg-primary/5 p-3 text-sm'>
          <Check className='mr-1 inline size-4 text-primary' />
          {result.added} produit{result.added > 1 ? 's' : ''} ajouté{result.added > 1 ? 's' : ''}
          {result.skipped > 0 && ` · ${result.skipped} déjà présent${result.skipped > 1 ? 's' : ''}`}
          .
        </p>
      )}

      <ul className='divide-y rounded-lg border'>
        {tree.map((cat) => {
          const catChecked = selCats.has(cat.id)
          const catIndeterminate =
            !catChecked && (cat.subcategories.some((s) => selSubs.has(s.id)) || anyProdInCat(cat.id))
          const catExpanded = expandedCats.has(cat.id)
          return (
            <li key={cat.id}>
              <div className='flex items-center gap-2 px-3 py-2.5'>
                {canAdd && (
                  <Checkbox
                    checked={catChecked}
                    indeterminate={catIndeterminate}
                    onCheckedChange={() => toggleCat(cat)}
                    aria-label={`Sélectionner ${cat.name}`}
                  />
                )}
                <button
                  type='button'
                  onClick={() => setExpandedCats((prev) => toggleSet(prev, cat.id))}
                  className='flex flex-1 items-center gap-2 text-left'
                >
                  <ChevronRight
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      catExpanded && 'rotate-90'
                    )}
                  />
                  <span className='flex-1 text-sm font-medium'>{cat.name}</span>
                  <span className='shrink-0 text-xs text-muted-foreground'>{cat.productCount}</span>
                </button>
              </div>

              {catExpanded && (
                <ul className='border-t bg-muted/20'>
                  {cat.subcategories.map((sub) => {
                    const subIsCovered = subCovered(sub.id)
                    const subIndeterminate =
                      !subIsCovered && !selCats.has(cat.id) && anyProdInSub(sub.id)
                    const subExpanded = expandedSubs.has(sub.id)
                    const products = subProducts.get(sub.id)
                    return (
                      <li key={sub.id} className='border-b last:border-b-0'>
                        <div className='flex items-center gap-2 py-2 pl-8 pr-3'>
                          {canAdd && (
                            <Checkbox
                              checked={subIsCovered}
                              indeterminate={subIndeterminate}
                              disabled={selCats.has(cat.id)}
                              onCheckedChange={() => toggleSub(sub.id)}
                              aria-label={`Sélectionner ${sub.name}`}
                            />
                          )}
                          <button
                            type='button'
                            onClick={() => toggleSubExpand(sub.id)}
                            className='flex flex-1 items-center gap-2 text-left'
                          >
                            <ChevronRight
                              className={cn(
                                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                subExpanded && 'rotate-90'
                              )}
                            />
                            <span className='flex-1 text-sm'>{sub.name}</span>
                            <span className='shrink-0 text-xs text-muted-foreground'>
                              {sub.productCount}
                            </span>
                          </button>
                        </div>

                        {subExpanded && (
                          <div className='pb-2 pl-12 pr-3'>
                            {loadingSubs.has(sub.id) || !products ? (
                              <p className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
                                <Loader2 className='size-3.5 animate-spin' /> Chargement…
                              </p>
                            ) : products.length === 0 ? (
                              <p className='py-2 text-xs text-muted-foreground'>Aucun produit.</p>
                            ) : (
                              <ul className='divide-y rounded-md border bg-background'>
                                {products.map((p) => {
                                  const checked = prodCovered(p.id, sub.id)
                                  return (
                                    <li key={p.id} className='flex items-center gap-2.5 px-2.5 py-2'>
                                      {canAdd && (
                                        <Checkbox
                                          checked={checked}
                                          disabled={subIsCovered}
                                          onCheckedChange={() => toggleProd(p.id, sub.id)}
                                          aria-label={`Sélectionner ${p.title}`}
                                        />
                                      )}
                                      <div className='flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground'>
                                        {p.imagePath ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={`/api/biblio/${p.id}/image`}
                                            alt=''
                                            loading='lazy'
                                            className='size-full object-cover'
                                          />
                                        ) : (
                                          <Package className='size-4' />
                                        )}
                                      </div>
                                      <span className='flex-1 text-sm leading-snug'>{p.title}</span>
                                      <span className='shrink-0 text-xs text-muted-foreground'>
                                        {PRODUCT_UNIT_LABELS[p.unit] ?? p.unit}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {canAdd && selectedCount > 0 && (
        <div className='fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
          <div className='mx-auto flex max-w-5xl items-center justify-between gap-4 px-1'>
            <div className='text-sm'>
              <span className='font-medium'>{selectedCount}</span> produit
              {selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
              {error && <span className='ml-2 text-destructive-foreground'>{error}</span>}
            </div>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                'Ajouter la sélection au stock'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
