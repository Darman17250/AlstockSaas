import { ArrowRight, HardHat, Warehouse } from 'lucide-react'

import type { ToolTransferItem } from '@/services/crm/tool-transfer'

interface ToolTransfersSectionProps {
  transfers: ToolTransferItem[]
}

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))

const Place = ({
  depotName,
  siteName,
}: {
  depotName: string | null
  siteName: string | null
}) => {
  if (depotName)
    return (
      <span className='inline-flex items-center gap-1'>
        <Warehouse className='size-3' /> {depotName}
      </span>
    )
  if (siteName)
    return (
      <span className='inline-flex items-center gap-1'>
        <HardHat className='size-3' /> {siteName}
      </span>
    )
  return <span className='text-muted-foreground'>—</span>
}

/** Historique des transferts (journal append-only). Section serveur. */
export const ToolTransfersSection = ({ transfers }: ToolTransfersSectionProps) => (
  <section className='rounded-lg border'>
    <div className='border-b px-5 py-3'>
      <h2 className='flex items-center gap-2 font-semibold'>
        <ArrowRight className='size-4' /> Transferts ({transfers.length})
      </h2>
    </div>
    {transfers.length === 0 ? (
      <p className='px-5 py-6 text-sm text-muted-foreground'>Aucun transfert enregistré.</p>
    ) : (
      <ul className='divide-y'>
        {transfers.map((t) => (
          <li key={t.id} className='px-5 py-3'>
            <div className='flex flex-wrap items-center gap-2 text-sm'>
              <Place depotName={t.fromDepotName} siteName={t.fromSiteName} />
              <ArrowRight className='size-3 text-muted-foreground' />
              <Place depotName={t.toDepotName} siteName={t.toSiteName} />
            </div>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {formatDateTime(t.transferredAt)}
              {t.transferredByName && ` · ${t.transferredByName}`}
            </p>
            {t.note && (
              <p className='mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground'>{t.note}</p>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>
)
