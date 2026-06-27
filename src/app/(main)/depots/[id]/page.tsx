import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, Car, ChevronLeft, Fuel, Gauge, MapPin, Tag, User, Warehouse } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { DEPOT_TYPE_LABELS, FUEL_TYPE_LABELS } from '@/lib/crm/labels'
import { isStorageConfigured } from '@/lib/supabase-storage'
import { getDepot } from '@/services/crm/depot'
import { listDepotDocuments } from '@/services/crm/depot-document'
import { listMaintenanceForDepot } from '@/services/crm/depot-maintenance'
import { listTasksForDepot, type TaskItem } from '@/services/crm/task'
import { getLocationStockValue, listStockForLocation } from '@/services/crm/stock'
import { listToolsForDepot } from '@/services/crm/tool'
import { listOrgMembers } from '@/services/org/members'
import { LocationStockSection } from '../../stock/_components/location-stock-section'
import { ToolsPresentSection } from '../../materiel/_components/tools-present-section'
import { TasksSection } from '../../taches/_components/tasks-section'
import { DepotDetailActions } from './_components/depot-detail-actions'
import { DepotDocumentsSection } from './_components/depot-documents-section'
import { DepotMaintenanceSection } from './_components/depot-maintenance-section'
import { DepotReminderButton } from './_components/depot-reminder-button'

const taskToView = (t: TaskItem) => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

interface DepotPageProps {
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
const formatKm = (km: number | null) =>
  km === null ? null : `${new Intl.NumberFormat('fr-FR').format(km)} km`

const Line = ({ icon: Icon, children }: { icon: typeof Tag; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

export default async function DepotPage({ params }: DepotPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let depot: Awaited<ReturnType<typeof getDepot>>
  try {
    depot = await getDepot(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx.role, 'depot', 'update')
  const canDelete = can(ctx.role, 'depot', 'delete')
  const canManageMaintenance = can(ctx.role, 'depotMaintenance', 'create')
  const canCreateTask = can(ctx.role, 'activity', 'create')
  const canReadTasks = can(ctx.role, 'activity', 'read')
  const canReadTools = can(ctx.role, 'tool', 'read')
  const canTransferTools = can(ctx.role, 'toolTransfer', 'create')
  const canReadStock = can(ctx.role, 'product', 'read')

  const isVehicle = depot.type === 'vehicule'
  const { items, totalCost } = await listMaintenanceForDepot(ctx, id)
  const members = canManageMaintenance || canCreateTask ? await listOrgMembers(ctx) : []
  const documents = await listDepotDocuments(ctx, id)
  const tasks = canReadTasks ? await listTasksForDepot(ctx, id) : []
  const toolsPresent = canReadTools ? await listToolsForDepot(ctx, id) : []
  const stockLoc = { depotId: id, siteId: null }
  const [stockItems, stockValue] = canReadStock
    ? await Promise.all([listStockForLocation(ctx, stockLoc), getLocationStockValue(ctx, stockLoc)])
    : [[], 0]
  const storageConfigured = isStorageConfigured()

  const overdue = depot.nextMaintenanceDate !== null && depot.nextMaintenanceDate < todayKey()
  const address = [depot.addressLine1, depot.postalCode, depot.city].filter(Boolean).join(', ')

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/depots' />}>
        <ChevronLeft className='size-4' /> Dépôts
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            {isVehicle ? <Car className='size-5' /> : <Warehouse className='size-5' />}
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{depot.name}</h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant='secondary'>{DEPOT_TYPE_LABELS[depot.type] ?? depot.type}</Badge>
              {isVehicle && depot.registrationNumber && (
                <Badge variant='outline' className='font-mono uppercase'>
                  {depot.registrationNumber}
                </Badge>
              )}
              {overdue && (
                <Badge variant='outline' className='text-destructive-foreground'>
                  Entretien en retard
                </Badge>
              )}
            </div>
          </div>
        </div>
        <DepotDetailActions
          depotId={depot.id}
          depotName={depot.name}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className='space-y-6'>
        <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
          {address && <Line icon={MapPin}>{address}</Line>}
          {depot.responsibleName && <Line icon={User}>Responsable : {depot.responsibleName}</Line>}
        </section>

        {isVehicle && (
          <section className='grid gap-3 rounded-lg border p-5 sm:grid-cols-2'>
            {(depot.brand || depot.model) && (
              <Line icon={Tag}>{[depot.brand, depot.model].filter(Boolean).join(' ')}</Line>
            )}
            {depot.fuelType && (
              <Line icon={Fuel}>{FUEL_TYPE_LABELS[depot.fuelType] ?? depot.fuelType}</Line>
            )}
            {depot.mileage !== null && <Line icon={Gauge}>{formatKm(depot.mileage)}</Line>}
            {depot.year && <Line icon={Calendar}>Année {depot.year}</Line>}
            {depot.firstRegistrationDate && (
              <Line icon={Calendar}>
                1re circulation : {formatDate(depot.firstRegistrationDate)}
              </Line>
            )}
            {depot.vin && <Line icon={Tag}>VIN : {depot.vin}</Line>}
          </section>
        )}

        {depot.nextMaintenanceDate && (
          <section className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5'>
            <div>
              <h2 className='font-semibold'>Prochain entretien</h2>
              <p
                className={`text-sm ${overdue ? 'text-destructive-foreground' : 'text-muted-foreground'}`}
              >
                {overdue ? 'En retard depuis le ' : 'Prévu le '}
                {formatDate(depot.nextMaintenanceDate)}
              </p>
            </div>
            {canCreateTask && (
              <DepotReminderButton
                depotId={depot.id}
                subject={`Entretien : ${depot.name}`}
                dueDate={depot.nextMaintenanceDate}
              />
            )}
          </section>
        )}

        {depot.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{depot.notes}</p>
          </section>
        )}

        <DepotMaintenanceSection
          depotId={depot.id}
          items={items}
          totalCost={totalCost}
          members={members}
          currentMemberId={ctx.memberId}
          canManage={canManageMaintenance}
        />

        {canReadTools && (
          <ToolsPresentSection items={toolsPresent} canTransfer={canTransferTools} />
        )}

        {canReadStock && <LocationStockSection items={stockItems} totalValue={stockValue} />}

        {canReadTasks && (
          <TasksSection
            tasks={tasks.map(taskToView)}
            canEdit={canCreateTask}
            currentMemberId={ctx.memberId}
            members={members}
            locked={{ depotId: depot.id }}
          />
        )}

        <DepotDocumentsSection
          depotId={depot.id}
          documents={documents}
          canEdit={canEdit}
          storageConfigured={storageConfigured}
        />
      </div>
    </div>
  )
}
