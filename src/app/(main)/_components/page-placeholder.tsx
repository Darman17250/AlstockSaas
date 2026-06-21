interface PagePlaceholderProps {
  title: string
  description: string
}

/** Écran d'attente pour les sections dont la feature n'est pas encore livrée. */
export const PagePlaceholder = ({ title, description }: PagePlaceholderProps) => (
  <div className='mx-auto max-w-4xl px-4 py-8'>
    <h1 className='mb-2 text-2xl font-bold tracking-tight'>{title}</h1>
    <p className='mb-8 text-muted-foreground'>{description}</p>
    <div className='rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground'>
      🚧 Fonctionnalité en cours de construction.
    </div>
  </div>
)
