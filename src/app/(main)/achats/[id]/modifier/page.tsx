import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { getPurchase } from '@/services/crm/purchase'
import { listProductOptions } from '@/services/crm/product'
import { listSupplierOptions } from '@/services/crm/supplier'
import { PurchaseForm } from '../../_components/purchase-form'

interface EditPurchasePageProps {
  params: Promise<{ id: string }>
}

export default async function EditPurchasePage({ params }: EditPurchasePageProps) {
  const ctx = await requireOrgContext()
  if (!can(ctx, 'purchase', 'update')) redirect('/achats')
  const { id } = await params

  let purchase: Awaited<ReturnType<typeof getPurchase>>
  try {
    purchase = await getPurchase(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  if (purchase.status !== 'brouillon') redirect(`/achats/${id}`)

  const [products, suppliers] = await Promise.all([
    listProductOptions(ctx),
    listSupplierOptions(ctx),
  ])

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href={`/achats/${id}`} />}>
        <ChevronLeft className='size-4' /> Achat
      </Button>
      <h1 className='mb-6 text-2xl font-bold tracking-tight'>Modifier l'achat</h1>
      <PurchaseForm
        mode='edit'
        purchaseId={id}
        products={products}
        suppliers={suppliers}
        initial={{
          supplierId: purchase.supplierId,
          reference: purchase.reference,
          orderDate: purchase.orderDate,
          notes: purchase.notes,
          lines: purchase.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }}
      />
    </div>
  )
}
