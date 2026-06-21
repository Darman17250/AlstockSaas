import { Skeleton } from '@/components/ui/skeleton'

export default function ClientsLoading() {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8'>
      <Skeleton className='mb-2 h-8 w-40' />
      <Skeleton className='mb-6 h-4 w-64' />
      <Skeleton className='mb-4 h-9 w-full' />
      <div className='space-y-2 rounded-lg border p-2'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-12 w-full' />
        ))}
      </div>
    </div>
  )
}
