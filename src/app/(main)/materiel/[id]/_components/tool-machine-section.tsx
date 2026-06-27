'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Fuel, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fuelLevelEnum } from '@/database/schema'
import { FUEL_LEVEL_LABELS } from '@/lib/crm/labels'
import { setFuelLevelAction, updateEngineHoursAction } from '../../actions'

interface ToolMachineSectionProps {
  toolId: string
  fuelLevel: string | null
  engineHours: number | null
  canEdit: boolean
}

export const ToolMachineSection = ({
  toolId,
  fuelLevel,
  engineHours,
  canEdit,
}: ToolMachineSectionProps) => {
  const router = useRouter()
  const [fuel, setFuel] = useState<string>(fuelLevel ?? '')
  const [hours, setHours] = useState<string>(engineHours != null ? String(engineHours) : '')
  const [savingFuel, setSavingFuel] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveFuel = async (v: string | null) => {
    if (!v) return
    setFuel(v)
    if (!canEdit) return
    setSavingFuel(true)
    setError(null)
    const res = await setFuelLevelAction(toolId, { fuelLevel: v })
    setSavingFuel(false)
    if (!res.ok) setError(res.error)
    else router.refresh()
  }

  const saveHours = async () => {
    setSavingHours(true)
    setError(null)
    const res = await updateEngineHoursAction(toolId, { engineHours: hours })
    setSavingHours(false)
    if (!res.ok) setError(res.error)
    else router.refresh()
  }

  return (
    <section className='space-y-4 rounded-lg border p-5'>
      <h2 className='font-semibold'>Machine</h2>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label className='flex items-center gap-1.5 text-sm'>
            <Fuel className='size-4 text-muted-foreground' /> Niveau de carburant
            {savingFuel && <Loader2 className='size-3 animate-spin' />}
          </Label>
          <Select value={fuel} onValueChange={saveFuel} disabled={!canEdit}>
            <SelectTrigger>
              <SelectValue>
                {(value) =>
                  value ? (FUEL_LEVEL_LABELS[value as string] ?? '') : '— Non renseigné'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {fuelLevelEnum.enumValues.map((f) => (
                <SelectItem key={f} value={f}>
                  {FUEL_LEVEL_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='engineHours' className='flex items-center gap-1.5 text-sm'>
            <Clock className='size-4 text-muted-foreground' /> Compteur horaire (h)
          </Label>
          <div className='flex gap-2'>
            <Input
              id='engineHours'
              type='number'
              min='0'
              inputMode='numeric'
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && (
              <Button
                type='button'
                variant='outline'
                size='icon'
                aria-label='Enregistrer le compteur'
                disabled={savingHours || hours === ''}
                onClick={saveHours}
              >
                {savingHours ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Check className='size-4' />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}
    </section>
  )
}
