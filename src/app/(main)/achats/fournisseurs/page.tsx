import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listSuppliers } from '@/services/crm/supplier'
import { SuppliersManager } from './_components/suppliers-manager'

export default async function FournisseursPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, 'supplier', 'read')) redirect('/achats')

  const suppliers = await listSuppliers(ctx)
  const canManage = can(ctx.role, 'supplier', 'create')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/achats' />}>
        <ChevronLeft className='size-4' /> Achats
      </Button>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Fournisseurs</h1>
        <p className='text-muted-foreground'>Vos fournisseurs pour les achats.</p>
      </div>
      <SuppliersManager
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          addressLine1: s.addressLine1,
          addressLine2: s.addressLine2,
          postalCode: s.postalCode,
          city: s.city,
          notes: s.notes,
        }))}
        canManage={canManage}
      />
    </div>
  )
}
