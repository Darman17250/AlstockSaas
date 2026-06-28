import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Building2, ChevronLeft, Globe, Mail, MapPin, Phone, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NotFoundError, requireOrgContext } from '@/lib/auth/org-context'
import { can } from '@/lib/auth/permissions'
import { CIVILITY_LABELS, CLIENT_TYPE_LABELS, RELATION_TYPE_LABELS } from '@/lib/crm/labels'
import { listClientCommunications } from '@/services/crm/activity'
import { getClient } from '@/services/crm/client'
import { listDealsForClient } from '@/services/crm/deal'
import { listEquipmentsForClient } from '@/services/crm/equipment'
import { listLocationsForClient } from '@/services/crm/location'
import { listTasksForClient, type TaskItem } from '@/services/crm/task'
import { listOrgMembers } from '@/services/org/members'
import { TasksSection } from '../../taches/_components/tasks-section'
import { ClientActions } from './_components/client-actions'
import { CommunicationsSection } from './_components/communications-section'
import { ContactsSection } from './_components/contacts-section'
import { DealsSection } from './_components/deals-section'
import { LocationsSection } from './_components/locations-section'

const taskToView = (t: TaskItem) => ({
  ...t,
  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
})

interface ClientPageProps {
  params: Promise<{ id: string }>
}

const Line = ({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) => (
  <div className='flex items-center gap-2 text-sm'>
    <Icon className='size-4 shrink-0 text-muted-foreground' />
    <span className='min-w-0 break-words'>{children}</span>
  </div>
)

export default async function ClientPage({ params }: ClientPageProps) {
  const ctx = await requireOrgContext()
  const { id } = await params

  let data: Awaited<ReturnType<typeof getClient>>
  try {
    data = await getClient(ctx, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }

  const canEdit = can(ctx, 'client', 'update')
  const canDelete = can(ctx, 'client', 'delete')
  const canEditContacts = can(ctx, 'contact', 'create')
  const canReadDeals = can(ctx, 'deal', 'read')
  const canCreateDeals = can(ctx, 'deal', 'create')
  const deals = canReadDeals ? await listDealsForClient(ctx, id) : []

  const canReadComms = can(ctx, 'activity', 'read')
  const canEditComms = can(ctx, 'activity', 'create')
  const communications = canReadComms ? await listClientCommunications(ctx, id) : []
  const members = canEditComms ? await listOrgMembers(ctx) : []
  const tasks = canReadComms ? await listTasksForClient(ctx, id) : []

  const canReadEquipment = can(ctx, 'equipment', 'read')
  const canManageLocations = can(ctx, 'location', 'create')
  const canManageEquipment = can(ctx, 'equipment', 'create')
  const locations = canReadEquipment ? await listLocationsForClient(ctx, id) : []
  const equipments = canReadEquipment ? await listEquipmentsForClient(ctx, id) : []

  const addressParts = [
    data.addressLine1,
    data.addressLine2,
    [data.postalCode, data.city].filter(Boolean).join(' '),
    data.country && data.country !== 'FR' ? data.country : null,
  ].filter(Boolean)

  const civilityPrefix =
    data.type === 'particulier' && data.civility ? `${CIVILITY_LABELS[data.civility]} ` : ''

  return (
    <div className='mx-auto max-w-3xl px-4 py-8'>
      <Button variant='ghost' size='sm' className='mb-4' render={<Link href='/clients' />}>
        <ChevronLeft className='size-4' /> Clients
      </Button>

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            {data.type === 'societe' ? (
              <Building2 className='size-5' />
            ) : (
              <User className='size-5' />
            )}
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {civilityPrefix}
              {data.name}
            </h1>
            <div className='mt-1 flex flex-wrap gap-2'>
              <Badge variant='outline'>{CLIENT_TYPE_LABELS[data.type] ?? data.type}</Badge>
              <Badge variant='secondary'>
                {RELATION_TYPE_LABELS[data.relationType] ?? data.relationType}
              </Badge>
              {data.sector && <Badge variant='outline'>{data.sector}</Badge>}
            </div>
          </div>
        </div>
        <ClientActions
          clientId={data.id}
          clientName={data.name}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      </div>

      <div className='space-y-6'>
        {/* Coordonnées */}
        <section className='space-y-3 rounded-lg border p-5'>
          <h2 className='font-semibold'>Coordonnées</h2>
          {data.email && (
            <Line icon={Mail}>
              <a href={`mailto:${data.email}`} className='hover:underline'>
                {data.email}
              </a>
            </Line>
          )}
          {data.phone && (
            <Line icon={Phone}>
              <a href={`tel:${data.phone}`} className='hover:underline'>
                {data.phone}
              </a>
            </Line>
          )}
          {data.website && (
            <Line icon={Globe}>
              <a
                href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                target='_blank'
                rel='noreferrer'
                className='hover:underline'
              >
                {data.website}
              </a>
            </Line>
          )}
          {addressParts.length > 0 && <Line icon={MapPin}>{addressParts.join(', ')}</Line>}
          {data.siret && <p className='text-sm text-muted-foreground'>SIRET : {data.siret}</p>}
          {data.ownerName && (
            <p className='text-sm text-muted-foreground'>Commercial en charge : {data.ownerName}</p>
          )}
          {!data.email &&
            !data.phone &&
            !data.website &&
            addressParts.length === 0 &&
            !data.siret && (
              <p className='text-sm text-muted-foreground'>Aucune coordonnée renseignée.</p>
            )}
        </section>

        {/* Contacts */}
        <ContactsSection
          clientId={data.id}
          canEdit={canEditContacts}
          contacts={data.contacts.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            jobTitle: c.jobTitle,
            email: c.email,
            phone: c.phone,
            mobile: c.mobile,
            isPrimary: c.isPrimary,
            notes: c.notes,
          }))}
        />

        {/* Affaires */}
        {canReadDeals && (
          <DealsSection clientId={data.id} deals={deals} canCreate={canCreateDeals} />
        )}

        {/* Communications */}
        {canReadComms && (
          <CommunicationsSection
            clientId={data.id}
            canEdit={canEditComms}
            currentMemberId={ctx.memberId}
            members={members}
            communications={communications.map((c) => ({
              id: c.id,
              type: c.type,
              subject: c.subject,
              description: c.description,
              occurredAt: c.occurredAt ? c.occurredAt.toISOString() : null,
              authorId: c.authorId,
              authorName: c.authorName,
            }))}
          />
        )}

        {/* Tâches */}
        {canReadComms && (
          <TasksSection
            tasks={tasks.map(taskToView)}
            canEdit={canEditComms}
            currentMemberId={ctx.memberId}
            members={members}
            locked={{ clientId: data.id }}
          />
        )}

        {/* Localisations & équipements */}
        {canReadEquipment && (
          <LocationsSection
            clientId={data.id}
            locations={locations}
            equipments={equipments}
            canManageLocations={canManageLocations}
            canManageEquipment={canManageEquipment}
          />
        )}

        {/* Notes */}
        {data.notes && (
          <section className='space-y-2 rounded-lg border p-5'>
            <h2 className='font-semibold'>Notes</h2>
            <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{data.notes}</p>
          </section>
        )}
      </div>
    </div>
  )
}
