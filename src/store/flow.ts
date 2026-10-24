import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { call, isTauri } from '../lib/tauri'
import type { Note, Project, Task, WorkSession } from '../lib/types'

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')
const fail = (title: string, e: unknown) => toast.error(title, message(e))

export type FlowTab = 'notes' | 'tasks' | 'projects' | 'timer'

interface FlowState {
  loaded: boolean
  error: string | null
  notes: Note[]
  tasks: Task[]
  projects: Project[]
  sessions: WorkSession[]
  tab: FlowTab
  selectedNoteId: string | null

  setTab: (tab: FlowTab) => void
  selectNote: (id: string | null) => void
  load: (force?: boolean) => Promise<void>

  createNote: (title?: string, body?: string) => Promise<Note | null>
  saveNote: (id: string, title: string, body: string) => Promise<boolean>
  setNotePinned: (id: string, pinned: boolean) => Promise<void>
  deleteNote: (id: string) => Promise<void>

  addTask: (title: string, projectId?: string | null, due?: number | null) => Promise<Task | null>
  updateTask: (id: string, title: string, projectId: string | null, due: number | null) => Promise<boolean>
  setTaskDone: (id: string, done: boolean) => Promise<void>
  setTaskPinned: (id: string, pinned: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  clearDone: () => Promise<void>

  addProject: (name: string, path: string | null) => Promise<Project | null>
  updateProject: (id: string, name: string, path: string | null) => Promise<boolean>
  setProjectArchived: (id: string, archived: boolean) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  openProject: (id: string) => Promise<void>

  addSession: (s: { label: string; projectId: string | null; startedAt: number; durationSecs: number; kind: 'stopwatch' | 'countdown' }) => Promise<boolean>
  deleteSession: (id: string) => Promise<void>
}

const sortNotes = (notes: Note[]) =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

let loading: Promise<void> | null = null

export const useFlow = create<FlowState>((set, get) => ({
  loaded: false,
  error: null,
  notes: [],
  tasks: [],
  projects: [],
  sessions: [],
  tab: 'notes',
  selectedNoteId: null,

  setTab: (tab) => set({ tab }),
  selectNote: (selectedNoteId) => set({ selectedNoteId }),

  load: async (force = false) => {
    if (!isTauri()) return
    if (get().loaded && !force) return
    loading ??= (async () => {
      try {
        const [notes, tasks, projects, sessions] = await Promise.all([
          call<Note[]>('note_list', {}),
          call<Task[]>('task_list'),
          call<Project[]>('project_list'),
          call<WorkSession[]>('session_list', { limit: 300 }),
        ])
        set({ notes: sortNotes(notes), tasks, projects, sessions, loaded: true, error: null })
      } catch (e) {
        set({ loaded: true, error: message(e) })
      } finally {
        loading = null
      }
    })()
    await loading
  },

  // ── notes ──
  createNote: async (title = '', body = '') => {
    try {
      const note = await call<Note>('note_create', { title, body })
      set((s) => ({ notes: sortNotes([note, ...s.notes]), selectedNoteId: note.id }))
      return note
    } catch (e) {
      fail('Could not create the note', e)
      return null
    }
  },
  saveNote: async (id, title, body) => {
    try {
      const updatedAt = await call<number>('note_update', { id, title, body })
      set((s) => ({ notes: sortNotes(s.notes.map((n) => (n.id === id ? { ...n, title: title.trim(), body, updatedAt } : n))) }))
      return true
    } catch (e) {
      fail('Could not save the note', e)
      return false
    }
  },
  setNotePinned: async (id, pinned) => {
    const before = get().notes
    set({ notes: sortNotes(before.map((n) => (n.id === id ? { ...n, pinned } : n))) })
    try {
      await call<void>('note_set_pinned', { id, pinned })
    } catch (e) {
      set({ notes: before })
      fail('Could not pin the note', e)
    }
  },
  deleteNote: async (id) => {
    const before = get().notes
    set((s) => ({ notes: before.filter((n) => n.id !== id), selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId }))
    try {
      await call<void>('note_delete', { id })
    } catch (e) {
      set({ notes: before })
      fail('Could not delete the note', e)
    }
  },

  // ── tasks ──
  addTask: async (title, projectId = null, due = null) => {
    try {
      const task = await call<Task>('task_add', { title, projectId, due })
      set((s) => ({ tasks: [task, ...s.tasks] }))
      return task
    } catch (e) {
      fail('Could not add the task', e)
      return null
    }
  },
  updateTask: async (id, title, projectId, due) => {
    try {
      await call<void>('task_update', { id, title, projectId, due })
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: title.trim(), projectId, due } : t)) }))
      return true
    } catch (e) {
      fail('Could not update the task', e)
      return false
    }
  },
  setTaskDone: async (id, done) => {
    const before = get().tasks
    set({ tasks: before.map((t) => (t.id === id ? { ...t, done, completedAt: done ? Date.now() : null } : t)) })
    try {
      await call<void>('task_set_done', { id, done })
    } catch (e) {
      set({ tasks: before })
      fail('Could not update the task', e)
    }
  },
  setTaskPinned: async (id, pinned) => {
    const before = get().tasks
    set({ tasks: before.map((t) => (t.id === id ? { ...t, pinned } : t)) })
    try {
      await call<void>('task_set_pinned', { id, pinned })
    } catch (e) {
      set({ tasks: before })
      fail('Could not pin the task', e)
    }
  },
  deleteTask: async (id) => {
    const before = get().tasks
    set({ tasks: before.filter((t) => t.id !== id) })
    try {
      await call<void>('task_delete', { id })
    } catch (e) {
      set({ tasks: before })
      fail('Could not delete the task', e)
    }
  },
  clearDone: async () => {
    const before = get().tasks
    set({ tasks: before.filter((t) => !t.done) })
    try {
      const n = await call<number>('task_clear_done')
      toast.show(n === 1 ? '1 completed task removed' : `${n} completed tasks removed`)
    } catch (e) {
      set({ tasks: before })
      fail('Could not clear completed tasks', e)
    }
  },

  // ── projects ──
  addProject: async (name, path) => {
    try {
      const project = await call<Project>('project_add', { name, path })
      set((s) => ({ projects: [project, ...s.projects] }))
      return project
    } catch (e) {
      fail('Could not add the project', e)
      return null
    }
  },
  updateProject: async (id, name, path) => {
    try {
      const project = await call<Project>('project_update', { id, name, path })
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? project : p)) }))
      return true
    } catch (e) {
      fail('Could not update the project', e)
      return false
    }
  },
  setProjectArchived: async (id, archived) => {
    const before = get().projects
    set({ projects: before.map((p) => (p.id === id ? { ...p, archived } : p)) })
    try {
      await call<void>('project_set_archived', { id, archived })
    } catch (e) {
      set({ projects: before })
      fail('Could not update the project', e)
    }
  },
  deleteProject: async (id) => {
    const before = get()
    set({
      projects: before.projects.filter((p) => p.id !== id),
      tasks: before.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
      sessions: before.sessions.map((x) => (x.projectId === id ? { ...x, projectId: null } : x)),
    })
    try {
      await call<void>('project_delete', { id })
    } catch (e) {
      set({ projects: before.projects, tasks: before.tasks, sessions: before.sessions })
      fail('Could not delete the project', e)
    }
  },
  openProject: async (id) => {
    try {
      await call<void>('project_open', { id })
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, lastOpened: Date.now() } : p)) }))
    } catch (e) {
      fail('Could not open the project folder', e)
    }
  },

  // ── sessions ──
  addSession: async (s) => {
    try {
      const saved = await call<WorkSession>('session_add', s)
      set((st) => ({ sessions: [saved, ...st.sessions] }))
      return true
    } catch (e) {
      fail('Could not save the session', e)
      return false
    }
  },
  deleteSession: async (id) => {
    const before = get().sessions
    set({ sessions: before.filter((x) => x.id !== id) })
    try {
      await call<void>('session_delete', { id })
    } catch (e) {
      set({ sessions: before })
      fail('Could not delete the session', e)
    }
  },
}))
