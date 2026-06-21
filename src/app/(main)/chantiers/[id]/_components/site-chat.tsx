'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Hash, MessagesSquare, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteSiteMessageAction } from '../../actions'
import {
  ChatComposer,
  type MentionMember,
  type MentionTask,
} from './chat-composer'

export interface ChatMentionView {
  type: 'member' | 'task'
  id: string
  label: string
}
export interface ChatAttachmentView {
  id: string
  kind: 'image' | 'audio'
  fileName: string
  mimeType: string | null
  durationMs: number | null
}
export interface ChatMessageView {
  id: string
  body: string | null
  createdAt: string
  authorId: string | null
  authorName: string | null
  isOwn: boolean
  mentions: ChatMentionView[]
  attachments: ChatAttachmentView[]
}

interface SiteChatProps {
  siteId: string
  initialMessages: ChatMessageView[]
  members: MentionMember[]
  tasks: MentionTask[]
  canManageAll: boolean
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const SiteChat = ({
  siteId,
  initialMessages,
  members,
  tasks,
  canManageAll,
}: SiteChatProps) => {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages)
  const lastTimeRef = useRef<string | undefined>(initialMessages.at(-1)?.createdAt)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: défilement à chaque nouveau message
  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  const fetchNew = useCallback(async () => {
    const since = lastTimeRef.current
    const qs = since ? `?since=${encodeURIComponent(since)}` : ''
    try {
      const res = await fetch(`/api/chantiers/${siteId}/messages${qs}`)
      if (!res.ok) return
      const { messages: fresh } = (await res.json()) as { messages: ChatMessageView[] }
      if (!fresh?.length) return
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const merged = [...prev, ...fresh.filter((m) => !known.has(m.id))]
        lastTimeRef.current = merged.at(-1)?.createdAt
        return merged
      })
    } catch {
      // silencieux : le prochain tick réessaiera
    }
  }, [siteId])

  useEffect(() => {
    const t = setInterval(fetchNew, 5000)
    return () => clearInterval(t)
  }, [fetchNew])

  const handleDelete = async (id: string) => {
    const res = await deleteSiteMessageAction(id)
    if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <section className='flex flex-col rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-5 py-3'>
        <MessagesSquare className='size-4' />
        <h2 className='font-semibold'>Discussion</h2>
      </div>

      <div ref={scrollRef} className='max-h-[28rem] min-h-32 space-y-3 overflow-y-auto p-4'>
        {messages.length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            Aucun message. Démarrez la discussion du chantier.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1 ${m.isOwn ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.isOwn ? 'bg-primary/10' : 'bg-muted'
                }`}
              >
                <div className='mb-0.5 flex items-center gap-2 text-xs text-muted-foreground'>
                  <span className='font-medium text-foreground'>
                    {m.authorName ?? 'Utilisateur supprimé'}
                  </span>
                  <span>{timeLabel(m.createdAt)}</span>
                  {(m.isOwn || canManageAll) && (
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label='Supprimer le message'
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  )}
                </div>

                {m.body && <p className='whitespace-pre-wrap break-words text-sm'>{m.body}</p>}

                {m.attachments.length > 0 && (
                  <div className='mt-2 space-y-2'>
                    {m.attachments.map((a) =>
                      a.kind === 'image' ? (
                        // biome-ignore lint/performance/noImgElement: image privée servie via URL signée (pas d'optimisation Next)
                        <img
                          key={a.id}
                          src={`/api/chantiers/messages/attachments/${a.id}`}
                          alt={a.fileName}
                          loading='lazy'
                          className='max-h-64 max-w-full rounded-md border'
                        />
                      ) : (
                        <audio
                          key={a.id}
                          controls
                          preload='none'
                          src={`/api/chantiers/messages/attachments/${a.id}`}
                          className='w-full max-w-72'
                        >
                          <track kind='captions' />
                        </audio>
                      )
                    )}
                  </div>
                )}

                {m.mentions.length > 0 && (
                  <div className='mt-1.5 flex flex-wrap gap-1'>
                    {m.mentions.map((mt) => (
                      <Badge
                        key={`${mt.type}-${mt.id}`}
                        variant={mt.type === 'member' ? 'secondary' : 'outline'}
                        size='sm'
                      >
                        {mt.type === 'member' ? (
                          <AtSign className='size-3' />
                        ) : (
                          <Hash className='size-3' />
                        )}
                        {mt.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ChatComposer siteId={siteId} members={members} tasks={tasks} onSent={fetchNew} />
    </section>
  )
}
