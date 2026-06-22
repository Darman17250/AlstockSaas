'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, QrCode, Trash2 } from 'lucide-react'

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
import { Button } from '@/components/ui/button'
import {
  EquipmentFormDialog,
  type EquipmentEditView,
} from '../../_components/equipment-form-dialog'
import { deleteEquipmentAction } from '../../actions'

interface EquipmentDetailActionsProps {
  equipment: EquipmentEditView
  clientId: string
  locations: { id: string; name: string }[]
  canEdit: boolean
  canDelete: boolean
}

export const EquipmentDetailActions = ({
  equipment,
  clientId,
  locations,
  canEdit,
  canDelete,
}: EquipmentDetailActionsProps) => {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteEquipmentAction(equipment.id, clientId)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.push(`/clients/${clientId}`)
    router.refresh()
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      <Button
        variant='outline'
        size='sm'
        render={<Link href={`/equipements/${equipment.id}/etiquette`} target='_blank' />}
      >
        <QrCode className='size-4' /> Étiquette QR
      </Button>
      {canEdit && (
        <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
          <Pencil className='size-4' /> Modifier
        </Button>
      )}
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant='destructive-outline' size='sm' disabled={busy} />}
          >
            <Trash2 className='size-4' /> Supprimer
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cet équipement ?</AlertDialogTitle>
              <AlertDialogDescription>
                « {equipment.name} » et son historique d'entretien seront archivés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p className='px-6 text-sm text-destructive-foreground'>{error}</p>}
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant='outline' />}>Annuler</AlertDialogClose>
              <AlertDialogClose render={<Button variant='destructive' />} onClick={handleDelete}>
                Supprimer
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      )}

      {canEdit && (
        <EquipmentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clientId={clientId}
          locations={locations}
          equipment={equipment}
        />
      )}
    </div>
  )
}
