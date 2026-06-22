import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, Calendar, ChevronLeft, MapPin, Package, Tag, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { EQUIPMENT_STATUS_LABELS, LOCATION_TYPE_LABELS } from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getEquipment } from '@/services/crm/equipment'
import { listEquipmentDocuments } from '@/services/crm/equipment-document'
import { listLocationsForClient } from '@/services/crm/location'
import { listMaintenanceForEquipment } from '@/services/crm/maintenance'
import { listOrgMembers } from '@/services/org/members'
import { EquipmentDetailActions } from './_components/equipment-detail-actions'
import { EquipmentDocumentsSection } from './_components/equipment-documents-section'
import { MaintenanceSection } from './_components/maintenance-section'
import { ReminderButton } from './_components/reminder-button'

interface EquipmentPageProps {
  params: Promise<{ id: string }>
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const formatDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(`${d}T00:00:00`)
      )
    : null

const Line = ({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let eq: Awaited<ReturnType<typeof getEquipment>>
  try {
    eq = await getEquipment(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx.role, 'equipment', 'update')
  const canDelete = can(ctx.role, 'equipment', 'delete')
  const canManageMaintenance = can(ctx.role, 'maintenance', 'create')
  const canCreateTask = can(ctx.role, 'activity', 'create')

  const { items, totalCost } = await listMaintenanceForEquipment(ctx, id)
  const members = canManageMaintenance ? await listOrgMembers(ctx) : []
  const locations = canEdit ? await listLocationsForClient(ctx, eq.clientId) : []
  const documents = await listEquipmentDocuments(ctx, id)
  const storageConfigured = isStorageConfigured()

  const editView = {
    id: eq.id,
    locationId: eq.locationId,
    name: eq.name,
    category: eq.category,
    brand: eq.brand,
    model: eq.model,
    serialNumber: eq.serialNumber,
    installDate: eq.installDate,
    status: eq.status,
    maintenanceFrequencyMonths: eq.maintenanceFrequencyMonths,
    nextMaintenanceDate: eq.nextMaintenanceDate,
    notes: eq.notes,
  }

  const overdue = eq.nextMaintenanceDate !== null && eq.nextMaintenanceDate < todayKey()

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button
        variant='ghost'
        size='sm'
        className='mb-4'
        render={<Link href={`/clients/${eq.clientId}`} />}
      >
        <ChevronLeft className='size-4' /> {eq.clientName}
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Package className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{eq.name}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant='secondary'>{EQUIPMENT_STATUS_LABELS[eq.status] ?? eq.status}</Badge>
              {eq.category && <Badge variant='outline'>{eq.category}</Badge>}
              {overdue && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  Entretien en retard
                </Badge>
              )}
            </div>
          </div>
        </div>
        <EquipmentDetailActions
          equipment={editView}
          clientId={eq.clientId}
          locations={locations}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          <Line icon={Building2}>
            <Link href={`/clients/${eq.clientId}`} className='hover:underline'>
              {eq.clientName}
            </Link>
          </Line>
          <Line icon={MapPin}>
            {eq.locationName}{' '}
            <span className='text-muted-foreground'>
              ({LOCATION_TYPE_LABELS[eq.locationType] ?? eq.locationType})
            </span>
          </Line>
          {(eq.brand || eq.model) && (
            <Line icon={Tag}>{[eq.brand, eq.model].filter(Boolean).join(' ')}</Line>
          )}
          {eq.serialNumber && <Line icon={Tag}>N° série : {eq.serialNumber}</Line>}
          {eq.installDate && <Line icon={Calendar}>Installé le {formatDate(eq.installDate)}</Line>}
          {eq.maintenanceFrequencyMonths && (
            <Line icon={Wrench}>Entretien tous les {eq.maintenanceFrequencyMonths} mois</Line>
          )}
        </section>

        {eq.nextMaintenanceDate && (
          <section className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5'>
            <div>
              <h2 className='font-semibold'>Prochain entretien</h2>
              <p
                className={`text-sm ${overdue ? 'text-destructive-foreground' : 'text-muted-foreground'}`}
              >
                {overdue ? 'En retard depuis le ' : 'Prévu le '}
                {formatDate(eq.nextMaintenanceDate)}
              </p>
            </div>
            {canCreateTask && (
              <ReminderButton
                equipmentId={eq.id}
                clientId={eq.clientId}
                subject={`Entretien : ${eq.name} (${eq.locationName})`}
                dueDate={eq.nextMaintenanceDate}
              />
            )}
          </section>
        )}

        {eq.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{eq.notes}</p>
          </section>
        )}

        <MaintenanceSection
          equipmentId={eq.id}
          items={items}
          totalCost={totalCost}
          members={members}
          currentMemberId={ctx.memberId}
          canManage={canManageMaintenance}
        />

        <EquipmentDocumentsSection
          equipmentId={eq.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
