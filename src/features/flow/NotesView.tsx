import { useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, NotebookPen, Pin, PinOff, SearchX, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchField } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Tooltip } from '../../components/ui/Tooltip'
import { cn } from '../../lib/cn'
import { formatAgo } from '../../lib/format'
import type { Note } from '../../lib/types'
import { useFlow } from '../../store/flow'

const snippet = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 90)

function Editor({ note }: { note: Note }) {
  const saveNote = useFlow((s) => s.saveNote)
  const setPinned = useFlow((s) => s.setNotePinned)
  const deleteNote = useFlow((s) => s.deleteNote)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [state, setState] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [confirm, setConfirm] = useState(false)

  const latest = useRef({ title, body })
  latest.current = { title, body }
  const stored = useRef(note)
  stored.current = note

  const dirty = title.trim() !== note.title || body !== note.body

  // Autosave 700 ms after the last keystroke.
  useEffect(() => {
    if (!dirty) {
      setState('saved')
      return
    }
    setState('dirty')
    const timer = window.setTimeout(async () => {
      setState('saving')
      const ok = await saveNote(note.id, title, body)
      setState(ok ? 'saved' : 'dirty')
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body])

  // Leaving the note (or the page) flushes any pending change.
  useEffect(
    () => () => {
      const { title: t, body: b } = latest.current
      if (t.trim() !== stored.current.title || b !== stored.current.body) void saveNote(stored.current.id, t, b)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-noir-line/70 px-5 py-3">
        <p className="nis-label flex-1" role="status" aria-live="polite">
          {state === 'saved' ? `Saved · ${formatAgo(note.updatedAt)}` : state === 'saving' ? 'Saving…' : 'Unsaved changes'}
        </p>
        <Tooltip content={note.pinned ? 'Unpin' : 'Pin to top'}>
          <Button variant="ghost" size="sm" iconOnly aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => void setPinned(note.id, !note.pinned)} icon={note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} />
        </Tooltip>
        <Tooltip content="Delete note">
          <Button variant="ghost" size="sm" iconOnly aria-label="Delete note" onClick={() => setConfirm(true)} icon={<Trash2 className="size-4" />} />
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          aria-label="Note title"
          maxLength={200}
          className="w-full bg-transparent text-[22px] font-semibold tracking-tight text-noir-white placeholder:text-noir-ash focus-visible:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Start writing…"
          aria-label="Note body"
          spellCheck
          className="min-h-0 w-full flex-1 resize-none bg-transparent text-[14px] leading-[22px] text-noir-paper placeholder:text-noir-ash focus-visible:outline-none"
        />
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this note?"
        description="This can't be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="primary" data-autofocus onClick={() => { setConfirm(false); void deleteNote(note.id) }}>Delete note</Button>
          </>
        }
      />
    </div>
  )
}

export function NotesView() {
  const notes = useFlow((s) => s.notes)
  const selectedId = useFlow((s) => s.selectedNoteId)
  const select = useFlow((s) => s.selectNote)
  const createNote = useFlow((s) => s.createNote)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return notes
    return notes.filter((n) => {
      const hay = `${n.title}\n${n.body}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [notes, query])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  // Keep a valid selection when the list changes.
  useEffect(() => {
    if (!selected && shown[0] && !query) select(shown[0].id)
  }, [selected, shown, query, select])

  if (notes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={NotebookPen}
          title="No notes yet"
          description="Capture a thought. Notes save automatically as you type and stay on this PC."
          action={<Button variant="primary" icon={<FilePlus2 className="size-4" />} onClick={() => void createNote()}>New note</Button>}
        />
      </Card>
    )
  }

  return (
    <Card className="grid h-[calc(100vh-290px)] min-h-[420px] grid-cols-[280px_minmax(0,1fr)] overflow-hidden max-[820px]:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col border-r border-noir-line/70">
        <div className="flex items-center gap-2 p-3">
          <div className="min-w-0 flex-1">
            <SearchField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" />
          </div>
          <Tooltip content="New note">
            <Button variant="primary" iconOnly aria-label="New note" onClick={() => { setQuery(''); void createNote() }} icon={<FilePlus2 className="size-4" />} />
          </Tooltip>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" aria-label="Notes">
          {shown.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => select(n.id)}
                aria-current={n.id === selectedId ? 'true' : undefined}
                className={cn(
                  'w-full rounded-ctl px-3 py-2.5 text-left transition-colors duration-fast ease-noir',
                  n.id === selectedId ? 'bg-noir-graphite' : 'hover:bg-white/[0.04]',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="size-3 shrink-0 text-noir-silver" aria-label="Pinned" />}
                  <span className="truncate text-[13px] font-medium text-noir-paper">{n.title || 'Untitled'}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-noir-silver">{snippet(n.body) || 'No text'}</span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-noir-ash">{formatAgo(n.updatedAt)}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && (
            <li>
              <EmptyState compact icon={SearchX} title="No matching notes" description={`Nothing contains “${query.trim()}”.`} />
            </li>
          )}
        </ul>
      </div>
      <div className="min-w-0">
        {selected ? (
          <Editor key={selected.id} note={selected} />
        ) : (
          <EmptyState icon={NotebookPen} title="Select a note" description="Pick one from the list, or create a new one." />
        )}
      </div>
    </Card>
  )
}
