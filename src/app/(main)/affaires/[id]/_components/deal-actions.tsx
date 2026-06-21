'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, RotateCcw, Trash2, Trophy, XCircle } from 'lucide-react'

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
import { deleteDealAction, reopenDealAction } from '../../actions'
import { LostDialog } from '../../_components/lost-dialog'
import { WonDialog } from '../../_components/won-dialog'

interface DealActionsProps {
  dealId: string
  status: string
  title: string
  canEdit: boolean
  canDelete: boolean
  canCreateSite: boolean
}

export const DealActions = ({
  dealId,
  status,
  title,
  canEdit,
  canDelete,
  canCreateSite,
}: DealActionsProps) => {
  const router = useRouter()
  const [wonOpen, setWonOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReopen = async () => {
    setBusy(true)
    const res = await reopenDealAction(dealId)
    setBusy(false)
    if (res.ok) router.refresh()
    else setError(res.error)
  }

  const handleDelete = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteDealAction(dealId)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    router.push('/affaires')
    router.refresh()
  }

  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {canEdit && status === 'en_cours' && (
        <>
          <Button variant='outline' size='sm' onClick={() => setWonOpen(true)}>
            <Trophy className='size-4' /> Gagnée
          </Button>
          <Button variant='destructive-outline' size='sm' onClick={() => setLostOpen(true)}>
            <XCircle className='size-4' /> Perdue
          </Button>
        </>
      )}
      {canEdit && status !== 'en_cours' && (
        <Button variant='outline' size='sm' disabled={busy} onClick={handleReopen}>
          <RotateCcw className='size-4' /> Rouvrir
        </Button>
      )}
      {canEdit && (
        <Button variant='outline' size='sm' render={<Link href={`/affaires/${dealId}/modifier`} />}>
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
              <AlertDialogTitle>Supprimer cette affaire ?</AlertDialogTitle>
              <AlertDialogDescription>« {title} » sera archivée.</AlertDialogDescription>
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

      {error && status === 'en_cours' && (
        <p className='w-full text-right text-sm text-destructive-foreground'>{error}</p>
      )}

      <WonDialog
        dealId={dealId}
        open={wonOpen}
        onOpenChange={setWonOpen}
        canCreateSite={canCreateSite}
      />
      <LostDialog dealId={dealId} open={lostOpen} onOpenChange={setLostOpen} />
    </div>
  )
}
