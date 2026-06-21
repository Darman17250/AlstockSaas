import 'server-only'
import { env } from '@/config/env'

/**
 * Client minimal pour Supabase Storage (API REST, sans SDK).
 * Utilise la SERVICE_ROLE_KEY côté serveur uniquement — ne jamais exposer au client.
 * Bucket privé : l'accès en lecture passe par une URL signée à durée limitée.
 */

/** Levée quand le stockage n'est pas configuré (env manquantes). */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Stockage de fichiers non configuré')
    this.name = 'StorageNotConfiguredError'
  }
}

interface StorageConfig {
  baseUrl: string
  serviceKey: string
  bucket: string
}

const getConfig = (): StorageConfig => {
  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = env.SUPABASE_STORAGE_BUCKET
  if (!url || !serviceKey || !bucket) throw new StorageNotConfiguredError()
  return { baseUrl: `${url.replace(/\/$/, '')}/storage/v1`, serviceKey, bucket }
}

/** Indique si le stockage est utilisable (toutes les variables sont présentes). */
export const isStorageConfigured = (): boolean =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET)

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Envoie un fichier dans le bucket (chemin unique côté appelant). */
export const uploadObject = async (
  path: string,
  body: Blob,
  contentType: string
): Promise<void> => {
  const { baseUrl, serviceKey, bucket } = getConfig()
  const res = await fetch(`${baseUrl}/object/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Échec de l'envoi du fichier (${res.status})`)
  }
}

/** Génère une URL de téléchargement signée (lecture temporaire d'un objet privé). */
export const createSignedDownloadUrl = async (path: string, expiresIn = 300): Promise<string> => {
  const { baseUrl, serviceKey, bucket } = getConfig()
  const res = await fetch(`${baseUrl}/object/sign/${bucket}/${encodePath(path)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  })
  if (!res.ok) throw new Error(`Échec de génération de l'URL signée (${res.status})`)
  const data = (await res.json()) as { signedURL: string }
  // signedURL est relatif à /storage/v1.
  return `${baseUrl}${data.signedURL}`
}

/** Supprime un objet du bucket (best-effort). */
export const deleteObject = async (path: string): Promise<void> => {
  const { baseUrl, serviceKey, bucket } = getConfig()
  const res = await fetch(`${baseUrl}/object/${bucket}/${encodePath(path)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceKey}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Échec de suppression du fichier (${res.status})`)
  }
}
