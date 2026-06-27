import { z } from 'zod'

/** Schémas de validation des fournisseurs. */

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  email: z.preprocess(emptyToUndefined, z.email('Email invalide').optional()),
  phone: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  city: optionalText,
  notes: optionalText,
})

export type SupplierInput = z.infer<typeof supplierSchema>
