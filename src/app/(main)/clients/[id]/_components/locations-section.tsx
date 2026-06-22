'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Package, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EQUIPMENT_STATUS_LABELS, LOCATION_TYPE_LABELS } from '@/lib/crm/labels'
import { EquipmentFormDialog } from '../../../equipements/_components/equipment-form-dialog'
import { deleteLocationAction } from '../../../equipements/actions'
import { LocationFormDialog, type LocationView } from './location-form-dialog'

export interface EquipmentRow {
  id: string
  name: string
  category: string | null
  status: string
  locationId: string
  nextMaintenanceDate: string | null
}

interface LocationsSectionProps {
  clientId: string
  locations: LocationView[]
  equipments: EquipmentRow[]
  canManageLocations: boolean
  canManageEquipment: boolean
}

const todayKey = () => new Date().toISOString().slice(0, 10)

export const LocationsSection = ({
  clientId,
  locations,
  equipments,
  canManageLocations,
  canManageEquipment,
}: LocationsSectionProps) => {
  const router = useRouter()
  const [locOpen, setLocOpen] = useState(false)
  const [editingLoc, setEditingLoc] = useState<LocationView | null>(null)
  const [eqOpen, setEqOpen] = useState(false)
  const [eqLocationId, setEqLocationId] = useState<string | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | null>(null)

  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }))
  const today = todayKey()

  const openCreateLoc = () => {
    setEditingLoc(null)
    setLocOpen(true)
  }
  const openEditLoc = (l: LocationView) => {
    setEditingLoc(l)
    setLocOpen(true)
  }
  const openCreateEquipment = (locationId: string) => {
    setEqLocationId(locationId)
    setEqOpen(true)
  }

  const handleDeleteLoc = async (id: string) => {
    setBusyId(id)
    await deleteLocationAction(id, clientId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <section className='rounded-lg border'>
      <div className='flex items-center justify-between gap-3 border-b px-5 py-3'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <MapPin className='size-4' /> Localisations & équipements ({locations.length})
        </h2>
        {canManageLocations && (
          <Button size='sm' variant='outline' onClick={openCreateLoc}>
            <Plus className='size-4' /> Localisation
          </Button>
        )}
      </div>

      {locations.length === 0 ? (
        <p className='px-5 py-6 text-sm text-muted-foreground'>
          Aucune localisation. Ajoutez une maison, un appartement, un local…
        </p>
      ) : (
        <ul className='divide-y'>
          {locations.map((loc) => {
            const eqs = equipments.filter((e) => e.locationId === loc.id)
            const address = [loc.addressLine1, [loc.postalCode, loc.city].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ')
            return (
              <li key={loc.id} className='px-5 py-3'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium'>{loc.name}</span>
                      <Badge variant='outline'>{LOCATION_TYPE_LABELS[loc.type] ?? loc.type}</Badge>
                    </div>
                    {address && <p className='mt-0.5 text-xs text-muted-foreground'>{address}</p>}
                  </div>
                  {canManageLocations && (
                    <div className='flex shrink-0 gap-1'>
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label='Modifier la localisation'
                        onClick={() => openEditLoc(loc)}
                      >
                        <Pencil className='size-4' />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              size='icon-sm'
                              variant='ghost'
                              aria-label='Supprimer la localisation'
                              disabled={busyId === loc.id}
                            />
                          }
                        >
                          <Trash2 className='size-4 text-destructive-foreground' />
                        </AlertDialogTrigger>
                        <AlertDialogPopup>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette localisation ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              « {loc.name} » et ses équipements seront archivés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogClose render={<Button variant='outline' />}>
                              Annuler
                            </AlertDialogClose>
                            <AlertDialogClose
                              render={<Button variant='destructive' />}
                              onClick={() => handleDeleteLoc(loc.id)}
                            >
                              Supprimer
                            </AlertDialogClose>
                          </AlertDialogFooter>
                        </AlertDialogPopup>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                <ul className='mt-2 space-y-1'>
                  {eqs.map((e) => {
                    const overdue = e.nextMaintenanceDate !== null && e.nextMaintenanceDate < today
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/equipements/${e.id}`}
                          className='-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50'
                        >
                          <Package className='size-4 shrink-0 text-muted-foreground' />
                          <span className='min-w-0 flex-1 truncate text-sm'>
                            {e.name}
                            {e.category && (
                              <span className='text-muted-foreground'> · {e.category}</span>
                            )}
                          </span>
                          {overdue && (
                            <Badge variant='outline' className='gap-1 text-destructive-foreground'>
                              <Wrench className='size-3' /> En retard
                            </Badge>
                          )}
                          <Badge variant='secondary'>
                            {EQUIPMENT_STATUS_LABELS[e.status] ?? e.status}
                          </Badge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>

                {canManageEquipment && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='mt-1'
                    onClick={() => openCreateEquipment(loc.id)}
                  >
                    <Plus className='size-4' /> Équipement
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManageLocations && (
        <LocationFormDialog
          open={locOpen}
          onOpenChange={setLocOpen}
          clientId={clientId}
          location={editingLoc}
        />
      )}
      {canManageEquipment && locations.length > 0 && (
        <EquipmentFormDialog
          open={eqOpen}
          onOpenChange={setEqOpen}
          clientId={clientId}
          locations={locationOptions}
          defaultLocationId={eqLocationId}
        />
      )}
    </section>
  )
}
