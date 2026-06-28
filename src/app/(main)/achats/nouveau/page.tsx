import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { listProductOptions } from '@/services/crm/product'
import { listSupplierOptions } from '@/services/crm/supplier'
import { PurchaseForm } from '../_components/purchase-form'

export default async function NouvelAchatPage() {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'purchase', 'create')) redirect('/achats')

  const [products, suppliers] = await Promise.all([
    listProductOptions(ctx),
    listSupplierOptions(ctx),
  ])

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/achats' />}>
        <ChevronLeft className='size-4' /> Achats
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Nouvel achat</h1>
      <PurchaseForm mode='create' products={products} suppliers={suppliers} />
    </div>
  )
}
