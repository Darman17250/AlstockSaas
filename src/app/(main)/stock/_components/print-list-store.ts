'use client'

import { useSyncExternalStore } from 'react'

/**
 * Store client léger pour la « liste d'impression » d'étiquettes produits.
 *
 * La liste produit est rendue côté serveur : on ne peut pas porter la sélection
 * dans un état serveur. On persiste donc des ids de produits dans `localStorage`
 * et on expose la sélection via `useSyncExternalStore` (sync inter-onglets via
 * l'event `storage`). Aucune donnée métier ici : seulement des identifiants
 * resélectionnés côté serveur sur la page planche.
 */

const STORAGE_KEY = 'stock-print-list'

type Listener = () => void

const listeners = new Set<Listener>()
let ids: string[] = []
let hydrated = false

/** Tableau vide stable pour le snapshot serveur (évite une boucle de rendu). */
const EMPTY: string[] = []

const readStorage = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // best-effort : quota plein ou storage indisponible
  }
}

const emit = () => {
  for (const listener of listeners) listener()
}

/** Hydrate le cache mémoire depuis localStorage au premier accès client. */
const ensureHydrated = () => {
  if (!hydrated && typeof window !== 'undefined') {
    ids = readStorage()
    hydrated = true
  }
}

const subscribe = (listener: Listener): (() => void) => {
  ensureHydrated()
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      ids = readStorage()
      emit()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = (): string[] => {
  ensureHydrated()
  return ids
}

const getServerSnapshot = (): string[] => EMPTY

export const printListActions = {
  add(id: string) {
    ensureHydrated()
    if (!ids.includes(id)) {
      ids = [...ids, id]
      persist()
      emit()
    }
  },
  remove(id: string) {
    ensureHydrated()
    if (ids.includes(id)) {
      ids = ids.filter((x) => x !== id)
      persist()
      emit()
    }
  },
  toggle(id: string) {
    ensureHydrated()
    if (ids.includes(id)) this.remove(id)
    else this.add(id)
  },
  clear() {
    ensureHydrated()
    if (ids.length > 0) {
      ids = []
      persist()
      emit()
    }
  },
}

/** Liste des ids sélectionnés pour impression. */
export const usePrintList = (): string[] =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

/** Indique si un produit donné est dans la liste d'impression. */
export const usePrintListHas = (id: string): boolean => usePrintList().includes(id)
