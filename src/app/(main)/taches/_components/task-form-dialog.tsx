'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from '@/components/ui/combobox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TASK_STATUS_LABELS } from '@/lib/crm/labels'
import { taskStatusEnum } from '@/database/schema'
import type { ClientOption } from '@/services/crm/client'
import type { DealOption } from '@/services/crm/deal'
import type { DepotOption } from '@/services/crm/depot'
import type { EquipmentOption } from '@/services/crm/equipment'
import type { SiteOption } from '@/services/crm/site'
import type { ToolOption } from '@/services/crm/tool'
import type { OrgMemberOption } from '@/services/org/members'
import { createTaskAction, updateTaskAction } from '../actions'
import type { TaskView } from './task-row'

const NONE = '__none__'
type Item = { value: string; label: string }

export interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: OrgMemberOption[]
  currentMemberId: string
  /** Liens fixes (contexte fiche) : la liaison est imposée et non éditable. */
  locked?: {
    clientId?: string
    dealId?: string
    siteId?: string
    equipmentId?: string
    depotId?: string
    toolId?: string
  }
  /** Options proposées dans les sélecteurs de liaison (vue globale). */
  clients?: ClientOption[]
  deals?: DealOption[]
  sites?: SiteOption[]
  equipments?: EquipmentOption[]
  depots?: DepotOption[]
  tools?: ToolOption[]
  task?: TaskView | null
  /** Échéance pré-remplie à la création (ex. clic sur un jour du calendrier). */
  defaultDueDate?: string
  onSaved?: () => void
}

export const TaskFormDialog = ({
  open,
  onOpenChange,
  members,
  currentMemberId,
  locked,
  clients,
  deals,
  sites,
  equipments,
  depots,
  tools,
  task,
  defaultDueDate,
  onSaved,
}: TaskFormDialogProps) => {
  const router = useRouter()
  const [status, setStatus] = useState<string>(task?.status ?? 'a_faire')
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId ?? currentMemberId ?? NONE)
  const [coAssignees, setCoAssignees] = useState<{ id: string; name: string }[]>(
    task?.coAssignees ?? []
  )
  const [clientId, setClientId] = useState<string | null>(task?.clientId ?? null)
  const [dealId, setDealId] = useState<string | null>(task?.dealId ?? null)
  const [siteId, setSiteId] = useState<string>(task?.siteId ?? NONE)
  const [equipmentId, setEquipmentId] = useState<string | null>(task?.equipmentId ?? null)
  const [depotId, setDepotId] = useState<string | null>(task?.depotId ?? null)
  const [toolId, setToolId] = useState<string | null>(task?.toolId ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Le contenu du popup est démonté à la fermeture : on réinitialise les champs
  // contrôlés à chaque ouverture pour refléter la tâche éditée (ou une création).
  useEffect(() => {
    if (!open) return
    setStatus(task?.status ?? 'a_faire')
    setAssigneeId(task?.assigneeId ?? currentMemberId ?? NONE)
    setCoAssignees(task?.coAssignees ?? [])
    setClientId(task?.clientId ?? null)
    setDealId(task?.dealId ?? null)
    setSiteId(task?.siteId ?? NONE)
    setEquipmentId(task?.equipmentId ?? null)
    setDepotId(task?.depotId ?? null)
    setToolId(task?.toolId ?? null)
    setError(null)
  }, [open, task, currentMemberId])

  const clientItems: Item[] = (clients ?? []).map((c) => ({ value: c.id, label: c.name }))
  const dealItems: Item[] = (deals ?? []).map((d) => ({ value: d.id, label: d.title }))
  const equipmentItems: Item[] = (equipments ?? []).map((e) => ({
    value: e.id,
    label: `${e.name} · ${e.clientName}`,
  }))
  const depotItems: Item[] = (depots ?? []).map((d) => ({ value: d.id, label: d.name }))
  const toolItems: Item[] = (tools ?? []).map((t) => ({ value: t.id, label: t.name }))
  const selectedClient = clientItems.find((i) => i.value === clientId) ?? null
  const selectedDeal = dealItems.find((i) => i.value === dealId) ?? null
  const selectedEquipment = equipmentItems.find((i) => i.value === equipmentId) ?? null
  const selectedDepot = depotItems.find((i) => i.value === depotId) ?? null
  const selectedTool = toolItems.find((i) => i.value === toolId) ?? null

  // Chantiers proposés : restreints au client sélectionné, sinon tous.
  const visibleSites = (sites ?? []).filter((s) => !clientId || s.clientId === clientId)

  const showClient = !locked?.clientId && clients
  const showDeal = !locked?.dealId && deals
  const showSite = !locked?.siteId && sites
  const showEquipment = !locked?.equipmentId && equipments
  const showDepot = !locked?.depotId && depots
  const showTool = !locked?.toolId && tools

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      subject: String(fd.get('subject') ?? ''),
      description: String(fd.get('description') ?? ''),
      dueDate: String(fd.get('dueDate') ?? ''),
      status,
      assigneeId: assigneeId !== NONE ? assigneeId : undefined,
      coAssigneeIds: coAssignees.map((c) => c.id),
      clientId: locked?.clientId ?? clientId ?? undefined,
      dealId: locked?.dealId ?? dealId ?? undefined,
      siteId: locked?.siteId ?? (siteId !== NONE ? siteId : undefined),
      equipmentId: locked?.equipmentId ?? equipmentId ?? undefined,
      depotId: locked?.depotId ?? depotId ?? undefined,
      toolId: locked?.toolId ?? toolId ?? undefined,
    }

    const res = task ? await updateTaskAction(task.id, payload) : await createTaskAction(payload)

    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onOpenChange(false)
    onSaved?.()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
          <DialogPanel className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='subject'>Intitulé</Label>
              <Input
                id='subject'
                name='subject'
                defaultValue={task?.subject ?? ''}
                placeholder='Ex. Relancer le client, envoyer le devis…'
                required
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='dueDate'>Échéance</Label>
                <Input
                  id='dueDate'
                  name='dueDate'
                  type='date'
                  defaultValue={task?.dueDate ? task.dueDate.slice(0, 10) : (defaultDueDate ?? '')}
                />
              </div>
              <div className='space-y-2'>
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v) => setStatus(v ?? 'a_faire')}>
                  <SelectTrigger>
                    <SelectValue>
                      {(value) => TASK_STATUS_LABELS[value as string] ?? ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {taskStatusEnum.enumValues.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label>Assigné à</Label>
              <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? NONE)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value) =>
                      value === NONE
                        ? '— Personne'
                        : (members.find((m) => m.id === value)?.name ?? '')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Personne</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Co-assignés</Label>
              <Select
                value={NONE}
                onValueChange={(v) => {
                  if (!v || v === NONE) return
                  const m = members.find((x) => x.id === v)
                  if (m && !coAssignees.some((c) => c.id === v)) {
                    setCoAssignees((prev) => [...prev, { id: m.id, name: m.name }])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue>{() => 'Ajouter un co-assigné…'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.filter(
                    (m) => m.id !== assigneeId && !coAssignees.some((c) => c.id === m.id)
                  ).length === 0 ? (
                    <SelectItem value={NONE} disabled>
                      Aucun
                    </SelectItem>
                  ) : (
                    members
                      .filter((m) => m.id !== assigneeId && !coAssignees.some((c) => c.id === m.id))
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              {coAssignees.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {coAssignees.map((c) => (
                    <Badge key={c.id} variant='secondary' size='sm'>
                      {c.name}
                      <button
                        type='button'
                        aria-label={`Retirer ${c.name}`}
                        onClick={() => setCoAssignees((prev) => prev.filter((x) => x.id !== c.id))}
                      >
                        <X className='size-3' />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {showClient && (
              <div className='space-y-2'>
                <Label>Client</Label>
                <Combobox
                  items={clientItems}
                  value={selectedClient}
                  onValueChange={(item: Item | null) => {
                    const next = item?.value ?? null
                    setClientId(next)
                    // Si le chantier choisi n'appartient pas au nouveau client, on le retire.
                    if (
                      next &&
                      siteId !== NONE &&
                      !(sites ?? []).some((s) => s.id === siteId && s.clientId === next)
                    ) {
                      setSiteId(NONE)
                    }
                  }}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                >
                  <ComboboxInput placeholder='Rechercher un client…' showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>Aucun client trouvé.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </div>
            )}

            {showDeal && (
              <div className='space-y-2'>
                <Label>Affaire</Label>
                <Combobox
                  items={dealItems}
                  value={selectedDeal}
                  onValueChange={(item: Item | null) => setDealId(item?.value ?? null)}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                >
                  <ComboboxInput placeholder='Rechercher une affaire…' showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>Aucune affaire trouvée.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </div>
            )}

            {showSite && sites.length > 0 && (
              <div className='space-y-2'>
                <Label>Chantier</Label>
                <Select
                  value={siteId}
                  onValueChange={(v) => {
                    const next = v ?? NONE
                    setSiteId(next)
                    // Sélectionner un chantier pré-remplit son client.
                    if (next !== NONE) {
                      const s = sites.find((x) => x.id === next)
                      if (s) setClientId(s.clientId)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value) =>
                        value === NONE ? '— Aucun' : (sites.find((s) => s.id === value)?.name ?? '')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Aucun</SelectItem>
                    {visibleSites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showEquipment && equipmentItems.length > 0 && (
              <div className='space-y-2'>
                <Label>Équipement</Label>
                <Combobox
                  items={equipmentItems}
                  value={selectedEquipment}
                  onValueChange={(item: Item | null) => setEquipmentId(item?.value ?? null)}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                >
                  <ComboboxInput placeholder='Rechercher un équipement…' showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>Aucun équipement trouvé.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </div>
            )}

            {showDepot && depotItems.length > 0 && (
              <div className='space-y-2'>
                <Label>Dépôt</Label>
                <Combobox
                  items={depotItems}
                  value={selectedDepot}
                  onValueChange={(item: Item | null) => setDepotId(item?.value ?? null)}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                >
                  <ComboboxInput placeholder='Rechercher un dépôt…' showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>Aucun dépôt trouvé.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </div>
            )}

            {showTool && toolItems.length > 0 && (
              <div className='space-y-2'>
                <Label>Matériel</Label>
                <Combobox
                  items={toolItems}
                  value={selectedTool}
                  onValueChange={(item: Item | null) => setToolId(item?.value ?? null)}
                  isItemEqualToValue={(a, b) => a?.value === b?.value}
                >
                  <ComboboxInput placeholder='Rechercher un matériel…' showClear />
                  <ComboboxPopup>
                    <ComboboxEmpty>Aucun matériel trouvé.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxPopup>
                </Combobox>
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='description'>Détails</Label>
              <Textarea
                id='description'
                name='description'
                defaultValue={task?.description ?? ''}
              />
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
