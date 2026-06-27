import 'server-only'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { supplier } from '@/database/schema'
import { type OrgContext, NotFoundError, requirePermission } from '@/lib/auth/org-context'
import type { SupplierInput } from '@/validation/supplier'

/** Services — fournisseurs. Règle d'or : toute requête filtre `organizationId`. */

export interface SupplierOption {
  id: string
  name: string
}

export const listSupplierOptions = async (ctx: OrgContext): Promise<SupplierOption[]> => {
  requirePermission(ctx, 'supplier', 'read')
  return db
    .select({ id: supplier.id, name: supplier.name })
    .from(supplier)
    .where(and(eq(supplier.organizationId, ctx.organizationId), isNull(supplier.deletedAt)))
    .orderBy(asc(supplier.name))
}

export const listSuppliers = async (ctx: OrgContext) => {
  requirePermission(ctx, 'supplier', 'read')
  return db
    .select()
    .from(supplier)
    .where(and(eq(supplier.organizationId, ctx.organizationId), isNull(supplier.deletedAt)))
    .orderBy(asc(supplier.name))
}

export const assertSupplierInOrg = async (ctx: OrgContext, supplierId: string): Promise<void> => {
  const [row] = await db
    .select({ id: supplier.id })
    .from(supplier)
    .where(
      and(
        eq(supplier.id, supplierId),
        eq(supplier.organizationId, ctx.organizationId),
        isNull(supplier.deletedAt)
      )
    )
    .limit(1)
  if (!row) throw new NotFoundError('Fournisseur introuvable')
}

const toColumns = (input: SupplierInput) => ({
  name: input.name,
  email: input.email ?? null,
  phone: input.phone ?? null,
  addressLine1: input.addressLine1 ?? null,
  addressLine2: input.addressLine2 ?? null,
  postalCode: input.postalCode ?? null,
  city: input.city ?? null,
  notes: input.notes ?? null,
})

export const createSupplier = async (ctx: OrgContext, input: SupplierInput) => {
  requirePermission(ctx, 'supplier', 'create')
  const [created] = await db
    .insert(supplier)
    .values({ ...toColumns(input), organizationId: ctx.organizationId })
    .returning()
  return created
}

export const updateSupplier = async (ctx: OrgContext, id: string, input: SupplierInput) => {
  requirePermission(ctx, 'supplier', 'update')
  const [updated] = await db
    .update(supplier)
    .set(toColumns(input))
    .where(
      and(
        eq(supplier.id, id),
        eq(supplier.organizationId, ctx.organizationId),
        isNull(supplier.deletedAt)
      )
    )
    .returning({ id: supplier.id })
  if (!updated) throw new NotFoundError('Fournisseur introuvable')
}

export const softDeleteSupplier = async (ctx: OrgContext, id: string): Promise<void> => {
  requirePermission(ctx, 'supplier', 'delete')
  const [deleted] = await db
    .update(supplier)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(supplier.id, id),
        eq(supplier.organizationId, ctx.organizationId),
        isNull(supplier.deletedAt)
      )
    )
    .returning({ id: supplier.id })
  if (!deleted) throw new NotFoundError('Fournisseur introuvable')
}
