/**
 * Contraintes des documents d'affaire (images, PDF, bureautique).
 * Validées côté serveur avant l'envoi au stockage.
 */

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024 // 20 Mo

export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  // PDF
  'application/pdf',
  // Bureautique
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Texte
  'text/plain',
  'text/csv',
] as const

/** Attribut `accept` de l'input fichier (UI). */
export const DOCUMENT_ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'

export const isAllowedMimeType = (mime: string): boolean =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
