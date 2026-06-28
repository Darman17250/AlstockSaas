'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { RESOURCE_DOMAINS, RESOURCE_LABELS } from '@/lib/crm/labels'
import type { PermissionMatrix } from '@/lib/auth/permissions'
import type { RoleSummary } from '@/services/org/roles'
import { ROLE_ACTIONS } from '@/validation/custom-role'
import { createRoleAction, updateRoleAction } from '../equipe/actions'

interface RoleEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: RoleSummary | null
}

const ACTION_HEADERS: Record<string, string> = {
  create: 'Créer',
  read: 'Lire',
  update: 'Modifier',
  delete: 'Suppr.',
}

const DEFAULT_COLOR = '#2563eb'

type MatrixState = Record<string, string[]>

const toState = (permissions: PermissionMatrix): MatrixState => {
  const out: MatrixState = {}
  for (const [resource, actions] of Object.entries(permissions)) {
    if (actions && actions.length > 0) out[resource] = [...actions]
  }
  return out
}

export const RoleEditorDialog = ({ open, onOpenChange, role }: RoleEditorDialogProps) => {
  const router = useRouter()
  const isEdit = Boolean(role)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [matrix, setMatrix] = useState<MatrixState>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '')
      setColor(role?.color ?? DEFAULT_COLOR)
      setMatrix(role ? toState(role.permissions) : {})
      setError(null)
    }
  }, [open, role])

  const has = (resource: string, action: string) => matrix[resource]?.includes(action) ?? false

  const toggle = (resource: string, action: string) => {
    setMatrix((prev) => {
      const current = new Set(prev[resource] ?? [])
      if (current.has(action)) current.delete(action)
      else current.add(action)
      const next = { ...prev }
      if (current.size === 0) delete next[resource]
      else next[resource] = [...current]
      return next
    })
  }

  const allResources = RESOURCE_DOMAINS.flatMap((d) => d.resources)
  const applyPreset = (actions: string[]) => {
    if (actions.length === 0) {
      setMatrix({})
      return
    }
    setMatrix(Object.fromEntries(allResources.map((r) => [r, [...actions]])))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = { name, color, permissions: matrix }
    const res =
      isEdit && role ? await updateRoleAction(role.slug, payload) : await createRoleAction(payload)
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le rôle' : 'Nouveau rôle'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
          <DialogPanel className='space-y-5'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-end'>
              <div className='flex-1 space-y-2'>
                <Label htmlFor='role-name'>Nom du rôle</Label>
                <Input
                  id='role-name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Chef d’équipe, Magasinier…'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='role-color'>Couleur</Label>
                <Input
                  id='role-color'
                  type='color'
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className='h-9 w-16 p-1'
                />
              </div>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button type='button' variant='outline' size='sm' onClick={() => applyPreset([])}>
                Aucun accès
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => applyPreset(['read'])}
              >
                Tout lire
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => applyPreset([...ROLE_ACTIONS])}
              >
                Accès complet
              </Button>
            </div>

            <div className='space-y-5'>
              {RESOURCE_DOMAINS.map((domain) => (
                <div key={domain.label} className='space-y-2'>
                  <p className='text-sm font-semibold'>{domain.label}</p>
                  <div className='overflow-hidden rounded-md border'>
                    <table className='w-full text-sm'>
                      <thead className='bg-muted/50 text-xs text-muted-foreground'>
                        <tr>
                          <th className='px-3 py-2 text-left font-medium'>Ressource</th>
                          {ROLE_ACTIONS.map((a) => (
                            <th key={a} className='px-2 py-2 text-center font-medium'>
                              {ACTION_HEADERS[a]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className='divide-y'>
                        {domain.resources.map((resource) => (
                          <tr key={resource}>
                            <td className='px-3 py-2'>{RESOURCE_LABELS[resource] ?? resource}</td>
                            {ROLE_ACTIONS.map((a) => (
                              <td key={a} className='px-2 py-2 text-center'>
                                <div className='flex justify-center'>
                                  <Checkbox
                                    checked={has(resource, a)}
                                    onCheckedChange={() => toggle(resource, a)}
                                    aria-label={`${RESOURCE_LABELS[resource] ?? resource} — ${ACTION_HEADERS[a]}`}
                                  />
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>Annuler</DialogClose>
            <Button type='submit' disabled={submitting}>
              {submitting ? <Loader2 className='size-4 animate-spin' /> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
