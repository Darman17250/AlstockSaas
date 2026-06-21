/**
 * Contraintes des messages de chantier (chat) et de leurs pièces jointes.
 * Validées côté serveur avant l'insertion / l'envoi au stockage.
 */

export const MAX_MESSAGE_LENGTH = 5000

export const MAX_IMAGE_SIZE = 15 * 1024 * 1024 // 15 Mo
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024 // 25 Mo

/** Nombre maximum de pièces jointes par message. */
export const MAX_ATTACHMENTS = 10

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/wav',
  'audio/x-m4a',
] as const

/** Attribut `accept` de l'input image (UI). */
export const IMAGE_ACCEPT = 'image/*'

const isImageMime = (mime: string): boolean =>
  (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime) || mime.startsWith('image/')

const isAudioMime = (mime: string): boolean =>
  (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime) || mime.startsWith('audio/')

/** Classe une pièce jointe selon son type MIME, ou `null` si non autorisée. */
export const classifyAttachment = (mime: string): 'image' | 'audio' | null => {
  if (isImageMime(mime)) return 'image'
  if (isAudioMime(mime)) return 'audio'
  return null
}
