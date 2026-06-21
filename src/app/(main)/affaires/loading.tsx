import { Skeleton } from '@/components/ui/skeleton'

export default function AffairesLoading() {
  return (
    <div className='mx-auto max-w-5xl px-4 py-8'>
      <Skeleton className='mb-2 h-8 w-40' />
      <Skeleton className='mb-6 h-4 w-64' />
      <Skeleton className='mb-6 h-9 w-72' />
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='space-y-2 rounded-lg border border-dashed p-2'>
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
          </div>
        ))}
      </div>
    </div>
  )
}
