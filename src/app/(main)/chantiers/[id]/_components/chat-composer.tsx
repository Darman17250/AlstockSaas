'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Mic, Send, Square, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { IMAGE_ACCEPT, MAX_ATTACHMENTS } from '@/validation/site-message'

export interface MentionMember {
  id: string
  name: string
}
export interface MentionTask {
  id: string
  subject: string
}

interface ChatComposerProps {
  siteId: string
  members: MentionMember[]
  tasks: MentionTask[]
  onSent: () => void
}

const NONE = '__none__'

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const ChatComposer = ({ siteId, members, tasks, onSent }: ChatComposerProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [mMembers, setMMembers] = useState<MentionMember[]>([])
  const [mTasks, setMTasks] = useState<MentionTask[]>([])
  const [images, setImages] = useState<File[]>([])
  const [audio, setAudio] = useState<{ blob: Blob; durationMs: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Enregistrement vocal (MediaRecorder) ---
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [canRecord, setCanRecord] = useState(false)

  useEffect(() => {
    setCanRecord(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined'
    )
  }, [])

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200)
    return () => clearInterval(t)
  }, [recording])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setAudio({ blob, durationMs: Date.now() - startedAtRef.current })
        for (const track of stream.getTracks()) track.stop()
      }
      startedAtRef.current = Date.now()
      setElapsed(0)
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch {
      setError("Micro indisponible ou refusé.")
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  const addImages = (files: FileList | null) => {
    if (!files) return
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, MAX_ATTACHMENTS))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const addMember = (id: string) => {
    if (id === NONE) return
    const m = members.find((x) => x.id === id)
    if (m && !mMembers.some((x) => x.id === id)) setMMembers((p) => [...p, m])
  }
  const addTask = (id: string) => {
    if (id === NONE) return
    const t = tasks.find((x) => x.id === id)
    if (t && !mTasks.some((x) => x.id === id)) setMTasks((p) => [...p, t])
  }

  const reset = () => {
    setBody('')
    setMMembers([])
    setMTasks([])
    setImages([])
    setAudio(null)
    setElapsed(0)
  }

  const hasContent = body.trim() || images.length > 0 || audio
  const availableMembers = members.filter((m) => !mMembers.some((x) => x.id === m.id))
  const availableTasks = tasks.filter((t) => !mTasks.some((x) => x.id === t.id))

  const handleSend = async () => {
    if (!hasContent || sending) return
    setSending(true)
    setError(null)
    try {
      const fd = new FormData()
      if (body.trim()) fd.append('body', body.trim())
      fd.append('memberIds', JSON.stringify(mMembers.map((m) => m.id)))
      fd.append('taskIds', JSON.stringify(mTasks.map((t) => t.id)))
      for (const img of images) fd.append('files', img)
      if (audio) {
        const ext = audio.blob.type.includes('mp4') ? 'm4a' : 'webm'
        fd.append('files', new File([audio.blob], `vocal-${Date.now()}.${ext}`, {
          type: audio.blob.type,
        }))
        fd.append('durationMs', String(audio.durationMs))
      }
      const res = await fetch(`/api/chantiers/${siteId}/messages`, { method: 'POST', body: fd })
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(b?.error ?? "Échec de l'envoi")
      }
      reset()
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className='space-y-2 border-t p-3'>
      {(mMembers.length > 0 || mTasks.length > 0 || images.length > 0 || audio) && (
        <div className='flex flex-wrap gap-1.5'>
          {mMembers.map((m) => (
            <Badge key={`m-${m.id}`} variant='secondary' size='sm'>
              @{m.name}
              <button
                type='button'
                aria-label={`Retirer ${m.name}`}
                onClick={() => setMMembers((p) => p.filter((x) => x.id !== m.id))}
              >
                <X className='size-3' />
              </button>
            </Badge>
          ))}
          {mTasks.map((t) => (
            <Badge key={`t-${t.id}`} variant='outline' size='sm'>
              #{t.subject}
              <button
                type='button'
                aria-label={`Retirer ${t.subject}`}
                onClick={() => setMTasks((p) => p.filter((x) => x.id !== t.id))}
              >
                <X className='size-3' />
              </button>
            </Badge>
          ))}
          {images.map((img, i) => (
            <Badge key={`i-${i}-${img.name}`} variant='outline' size='sm'>
              🖼 {img.name.slice(0, 18)}
              <button
                type='button'
                aria-label='Retirer image'
                onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
              >
                <X className='size-3' />
              </button>
            </Badge>
          ))}
          {audio && (
            <Badge variant='outline' size='sm'>
              🎤 {fmtDuration(audio.durationMs)}
              <button type='button' aria-label='Retirer le vocal' onClick={() => setAudio(null)}>
                <X className='size-3' />
              </button>
            </Badge>
          )}
        </div>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder='Écrire un message…'
        rows={2}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
        }}
      />

      {error && <p className='text-sm text-destructive-foreground'>{error}</p>}

      <div className='flex flex-wrap items-center gap-2'>
        <Select value={NONE} onValueChange={(v) => addMember(v ?? NONE)}>
          <SelectTrigger size='sm' className='w-32'>
            <SelectValue>{() => '@ Salarié'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableMembers.length === 0 ? (
              <SelectItem value={NONE} disabled>
                Aucun
              </SelectItem>
            ) : (
              availableMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={NONE} onValueChange={(v) => addTask(v ?? NONE)}>
          <SelectTrigger size='sm' className='w-32'>
            <SelectValue>{() => '# Tâche'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableTasks.length === 0 ? (
              <SelectItem value={NONE} disabled>
                Aucune
              </SelectItem>
            ) : (
              availableTasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.subject}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <input
          ref={imageInputRef}
          type='file'
          accept={IMAGE_ACCEPT}
          multiple
          className='hidden'
          onChange={(e) => addImages(e.target.files)}
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          aria-label='Ajouter une image'
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className='size-4' />
        </Button>

        {canRecord &&
          (recording ? (
            <Button
              type='button'
              variant='destructive'
              size='sm'
              onClick={stopRecording}
              aria-label="Arrêter l'enregistrement"
            >
              <Square className='size-4' /> {fmtDuration(elapsed)}
            </Button>
          ) : (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={startRecording}
              aria-label='Enregistrer un vocal'
              disabled={Boolean(audio)}
            >
              <Mic className='size-4' />
            </Button>
          ))}

        <Button
          type='button'
          size='sm'
          className='ml-auto'
          disabled={!hasContent || sending || recording}
          onClick={handleSend}
        >
          {sending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
          Envoyer
        </Button>
      </div>
    </div>
  )
}
