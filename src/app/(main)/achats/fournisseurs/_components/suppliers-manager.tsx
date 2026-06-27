'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSupplierAction, deleteSupplierAction, updateSupplierAction } from '../../actions'

export interface SupplierRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  notes: string | null
}

interface SuppliersManagerProps {
  suppliers: SupplierRow[]
  canManage: boolean
}

const EMPTY: SupplierRow = {
  id: '',
  name: '',
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
  notes: null,
}

export const SuppliersManager = ({ suppliers, canManage }: SuppliersManagerProps) => {
  const router = useRouter()
  const [editing, setEditing] = useState<SupplierRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') ?? ''),
      email: String(fd.get('email') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      addressLine1: String(fd.get('addressLine1') ?? ''),
      postalCode: String(fd.get('postalCode') ?? ''),
      city: String(fd.get('city') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    }
    const res = editing.id
      ? await updateSupplierAction(editing.id, payload)
      : await createSupplierAction(payload)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }
    setBusy(false)
    setEditing(null)
    router.refresh()
  }

  const remove = async (id: string) => {
    const res = await deleteSupplierAction(id)
    if (!res.ok) {
      window.alert(res.error)
      return
    }
    router.refresh()
  }

  const v = (s: string | null) => s ?? ''

  return (
    <div className='space-y-4'>
      {canManage && (
        <Button onClick={() => setEditing(EMPTY)}>
          <Plus className='size-4' /> Nouveau fournisseur
        </Button>
      )}

      {suppliers.length === 0 ? (
        <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground'>
          <Users className='size-6' />
          <p className='text-sm'>Aucun fournisseur enregistré.</p>
        </div>
      ) : (
        <ul className='divide-y rounded-lg border'>
          {suppliers.map((s) => (
            <li key={s.id} className='flex items-center gap-3 px-4 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{s.name}</p>
                <div className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                  {s.email && (
                    <span className='inline-flex items-center gap-1'>
                      <Mail className='size-3' /> {s.email}
                    </span>
                  )}
                  {s.phone && (
                    <span className='inline-flex items-center gap-1'>
                      <Phone className='size-3' /> {s.phone}
                    </span>
                  )}
                  {s.city && <span>{s.city}</span>}
                </div>
              </div>
              {canManage && (
                <div className='flex shrink-0 gap-1'>
                  <Button variant='ghost' size='icon' onClick={() => setEditing(s)}>
                    <Pencil className='size-4' />
                  </Button>
                  <Button variant='ghost' size='icon' onClick={() => remove(s.id)}>
                    <Trash2 className='size-4' />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit}>
            <DialogPanel className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Nom</Label>
                <Input id='name' name='name' defaultValue={v(editing?.name ?? null)} required />
              </div>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    name='email'
                    type='email'
                    defaultValue={v(editing?.email ?? null)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone'>Téléphone</Label>
                  <Input id='phone' name='phone' defaultValue={v(editing?.phone ?? null)} />
                </div>
                <div className='space-y-2 sm:col-span-2'>
                  <Label htmlFor='addressLine1'>Adresse</Label>
                  <Input
                    id='addressLine1'
                    name='addressLine1'
                    defaultValue={v(editing?.addressLine1 ?? null)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='postalCode'>Code postal</Label>
                  <Input
                    id='postalCode'
                    name='postalCode'
                    defaultValue={v(editing?.postalCode ?? null)}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='city'>Ville</Label>
                  <Input id='city' name='city' defaultValue={v(editing?.city ?? null)} />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='notes'>Notes</Label>
                <Textarea id='notes' name='notes' defaultValue={v(editing?.notes ?? null)} />
              </div>
              {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
              <Button type='submit' disabled={busy}>
                {busy ? <Loader2 className='size-4 animate-spin' /> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
