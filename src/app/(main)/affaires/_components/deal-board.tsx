'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { MoreVertical, Trophy, User, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { DEAL_STAGE_LABELS, DEAL_STAGES, formatDealAmount } from '@/lib/crm/labels'
import type { DealBoardItem } from '@/services/crm/deal'
import { moveDealStageAction } from '../actions'
import { LostDialog } from './lost-dialog'
import { WonDialog } from './won-dialog'

type Stage = (typeof DEAL_STAGES)[number]

interface DealBoardProps {
  deals: DealBoardItem[]
  canEdit: boolean
  canCreateSite: boolean
}

interface CardProps {
  deal: DealBoardItem
  canEdit: boolean
  canCreateSite: boolean
  onMove: (id: string, stage: Stage) => void
}

/** Carte d'affaire : titre cliquable + menu d'actions. Draggable si `canEdit`. */
const DealCard = ({ deal, canEdit, canCreateSite, onMove }: CardProps) => {
  const [wonOpen, setWonOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    disabled: !canEdit,
  })

  const amount = formatDealAmount(deal.estimatedAmount, deal.currency)

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-3 shadow-xs ${
        canEdit ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className='flex items-start justify-between gap-2'>
        <Link
          href={`/affaires/${deal.id}`}
          className='min-w-0 flex-1 hover:underline'
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className='truncate text-sm font-medium'>{deal.title}</p>
        </Link>
        {canEdit && (
          <Menu>
            <MenuTrigger
              className='-m-1 rounded-md p-1 text-muted-foreground hover:bg-accent'
              aria-label='Actions'
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className='size-4' />
            </MenuTrigger>
            <MenuPopup align='end'>
              <MenuSub>
                <MenuSubTrigger>Déplacer vers</MenuSubTrigger>
                <MenuSubPopup>
                  <MenuRadioGroup
                    value={deal.stage}
                    onValueChange={(v) => onMove(deal.id, v as Stage)}
                  >
                    {DEAL_STAGES.map((s) => (
                      <MenuRadioItem key={s} value={s}>
                        {DEAL_STAGE_LABELS[s]}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSeparator />
              <MenuItem onClick={() => setWonOpen(true)}>
                <Trophy className='size-4' /> Marquer gagnée
              </MenuItem>
              <MenuItem variant='destructive' onClick={() => setLostOpen(true)}>
                <XCircle className='size-4' /> Marquer perdue
              </MenuItem>
            </MenuPopup>
          </Menu>
        )}
      </div>
      <p className='mt-1 truncate text-xs text-muted-foreground'>{deal.clientName}</p>
      <div className='mt-2 flex flex-wrap items-center gap-2'>
        {amount && <span className='text-sm font-semibold tabular-nums'>{amount}</span>}
        {deal.probability !== null && <Badge variant='secondary'>{deal.probability}%</Badge>}
      </div>
      {deal.ownerName && (
        <p className='mt-2 flex items-center gap-1 text-xs text-muted-foreground'>
          <User className='size-3' /> {deal.ownerName}
        </p>
      )}

      <WonDialog
        dealId={deal.id}
        open={wonOpen}
        onOpenChange={setWonOpen}
        canCreateSite={canCreateSite}
      />
      <LostDialog dealId={deal.id} open={lostOpen} onOpenChange={setLostOpen} />
    </div>
  )
}

interface ColumnProps {
  stage: Stage
  deals: DealBoardItem[]
  canEdit: boolean
  canCreateSite: boolean
  onMove: (id: string, stage: Stage) => void
}

const Column = ({ stage, deals, canEdit, canCreateSite, onMove }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const total = deals.reduce((sum, d) => sum + Number(d.estimatedAmount ?? 0), 0)
  const totalLabel = formatDealAmount(total, 'EUR')

  return (
    <div className='flex w-72 shrink-0 snap-start flex-col sm:w-auto sm:shrink'>
      <div className='mb-2 flex items-center justify-between px-1'>
        <h2 className='text-sm font-semibold'>{DEAL_STAGE_LABELS[stage]}</h2>
        <span className='text-xs text-muted-foreground'>{deals.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? 'border-primary bg-primary/5' : 'bg-muted/30'
        }`}
      >
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            canEdit={canEdit}
            canCreateSite={canCreateSite}
            onMove={onMove}
          />
        ))}
        {deals.length === 0 && (
          <p className='px-1 py-4 text-center text-xs text-muted-foreground'>Aucune affaire</p>
        )}
      </div>
      {total > 0 && (
        <p className='mt-1 px-1 text-right text-xs text-muted-foreground tabular-nums'>
          {totalLabel}
        </p>
      )}
    </div>
  )
}

export const DealBoard = ({ deals, canEdit, canCreateSite }: DealBoardProps) => {
  const router = useRouter()
  const [items, setItems] = useState(deals)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Resynchronise l'état local quand les données serveur changent (refresh).
  useEffect(() => setItems(deals), [deals])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const move = async (id: string, stage: Stage) => {
    const current = items.find((d) => d.id === id)
    if (!current || current.stage === stage) return
    const previous = items
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)))
    const res = await moveDealStageAction(id, { stage })
    if (!res.ok) {
      setItems(previous) // revert en cas d'échec (ex. permission)
      return
    }
    router.refresh()
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    move(String(e.active.id), e.over.id as Stage)
  }

  const activeDeal = activeId ? items.find((d) => d.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className='flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4'>
        {DEAL_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            deals={items.filter((d) => d.stage === stage)}
            canEdit={canEdit}
            canCreateSite={canCreateSite}
            onMove={move}
          />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <div className='w-72 rounded-lg border bg-card p-3 shadow-lg sm:w-64'>
            <p className='truncate text-sm font-medium'>{activeDeal.title}</p>
            <p className='mt-1 truncate text-xs text-muted-foreground'>{activeDeal.clientName}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
