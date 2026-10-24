import { useMemo } from 'react'
import {
  Activity,
  ClipboardCopy,
  FilePlus2,
  Folder,
  FolderKanban,
  Globe,
  HardDrive,
  ListPlus,
  NotebookText,
  PanelLeft,
  SlidersHorizontal,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '../../components/ui/Toast'
import { formatBytes, formatUptime } from '../../lib/format'
import { NAV } from '../../lib/nav'
import { call } from '../../lib/tauri'
import { useFlow } from '../../store/flow'
import { useMonitor } from '../../store/monitor'
import { useNav } from '../../store/nav'
import { useOrbit } from '../../store/orbit'
import { usePrefs } from '../../store/prefs'
import { useSpaces } from '../../store/spaces'
import { useVault } from '../../store/vault'
import { buildSummary } from '../home/widgets/QuickActions'
import { useDashboardEdit } from '../home/editState'
import { iconFor } from '../orbit/icons'
import { iconOf } from '../spaces/model'
import { useVaultUi } from '../vault/ui'
import { looksLikePath, looksLikeUrl, rankItems, type Rankable } from './search'

export type Group = 'Create' | 'Spaces' | 'Applications' | 'Projects' | 'Notes' | 'Folders' | 'Go to' | 'System' | 'Actions'

/** Order groups appear in when the results are listed. */
export const GROUP_ORDER: readonly Group[] = ['Create', 'Spaces', 'Applications', 'Projects', 'Notes', 'Folders', 'Go to', 'System', 'Actions']

export interface CommandItem extends Rankable {
  id: string
  group: Group
  subtitle?: string
  icon: LucideIcon
  run: () => void | Promise<void>
}

const fail = (title: string, e: unknown) => toast.error(title, e instanceof Error ? e.message : undefined)

/**
 * Everything the palette can do, built from live stores (apps from Orbit, projects and
 * notes from Flow, folders from Vault, Spaces). Items with an empty query show a short,
 * useful default list; with a query they are fuzzy-ranked.
 */
export function useCommandItems(query: string): CommandItem[] {
  const apps = useOrbit((s) => s.apps)
  const spaces = useSpaces((s) => s.spaces)
  const activeId = useSpaces((s) => s.activeId)
  const projects = useFlow((s) => s.projects)
  const notes = useFlow((s) => s.notes)
  const favorites = useVault((s) => s.favorites)
  const roots = useVault((s) => s.roots)
  const cpu = useMonitor((s) => (s.snapshot ? Math.round(s.snapshot.cpuUsage) : null))
  const memUsed = useMonitor((s) => s.snapshot?.memoryUsed ?? null)
  const memTotal = useMonitor((s) => s.snapshot?.memoryTotal ?? null)
  const uptime = useMonitor((s) => s.snapshot?.uptimeSecs ?? null)

  const base = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = []

    for (const s of spaces ?? []) {
      items.push({
        id: `space:${s.id}`,
        group: 'Spaces',
        title: `Switch to ${s.name}`,
        subtitle: s.id === activeId ? 'Current space' : 'Space',
        keywords: `space ${s.name} workspace`,
        icon: iconOf(s.icon),
        boost: s.id === activeId ? 0 : 5,
        run: () => useSpaces.getState().switchTo(s.id),
      })
    }

    for (const a of apps ?? []) {
      if (a.hidden) continue
      items.push({
        id: `app:${a.id}`,
        group: 'Applications',
        title: a.name,
        subtitle: a.category,
        keywords: `launch open ${a.category}`,
        icon: iconFor(a.icon, a.category),
        boost: (a.favorite ? 10 : 0) + Math.min(a.launchCount, 10),
        run: () => useOrbit.getState().launch(a),
      })
    }

    for (const p of projects) {
      if (p.archived) continue
      items.push({
        id: `project:${p.id}`,
        group: 'Projects',
        title: p.name,
        subtitle: p.path ? 'Open project folder' : 'Show in Flow',
        keywords: 'project open',
        icon: FolderKanban,
        run: () => {
          if (p.path) return useFlow.getState().openProject(p.id)
          useFlow.getState().setTab('projects')
          useNav.getState().go('flow')
        },
      })
    }

    for (const n of notes.slice(0, 200)) {
      items.push({
        id: `note:${n.id}`,
        group: 'Notes',
        title: n.title.trim() || n.body.trim().split('\n')[0]?.slice(0, 60) || 'Untitled note',
        subtitle: 'Note',
        keywords: n.body.slice(0, 200),
        icon: NotebookText,
        run: () => {
          useFlow.getState().setTab('notes')
          useFlow.getState().selectNote(n.id)
          useNav.getState().go('flow')
        },
      })
    }

    const openFolder = (path: string) => () => {
      useVaultUi.getState().browse(path)
      useNav.getState().go('vault')
    }
    for (const f of favorites) {
      if (!f.exists) continue
      items.push({ id: `fav:${f.path}`, group: 'Folders', title: f.label, subtitle: f.path, keywords: 'folder directory favorite open', icon: Star, run: openFolder(f.path) })
    }
    for (const r of roots) {
      items.push({ id: `root:${r.path}`, group: 'Folders', title: r.label, subtitle: r.path, keywords: 'folder directory drive open', icon: r.kind === 'drive' ? HardDrive : Folder, run: openFolder(r.path) })
    }

    for (const n of NAV) {
      items.push({
        id: `go:${n.id}`,
        group: 'Go to',
        title: `Go to ${n.label}`,
        subtitle: n.descriptor,
        keywords: `${n.descriptor} open section`,
        icon: n.icon,
        run: () => useNav.getState().go(n.id),
      })
    }

    if (cpu !== null && memUsed !== null && memTotal !== null) {
      items.push({
        id: 'system:live',
        group: 'System',
        title: `CPU ${cpu}% · RAM ${formatBytes(memUsed)} of ${formatBytes(memTotal, 0)}${uptime !== null ? ` · up ${formatUptime(uptime)}` : ''}`,
        subtitle: 'Live reading — open Pulse for details',
        keywords: 'system info cpu memory ram uptime performance stats',
        icon: Activity,
        run: () => useNav.getState().go('pulse'),
      })
    }
    items.push({
      id: 'system:copy',
      group: 'System',
      title: 'Copy system summary',
      subtitle: 'Host, OS, CPU, memory, uptime',
      keywords: 'system info copy clipboard summary',
      icon: ClipboardCopy,
      run: async () => {
        const text = buildSummary()
        if (!text) return toast.error('No system data yet', 'Live readings are not available right now.')
        try {
          await navigator.clipboard.writeText(text)
          toast.success('System summary copied')
        } catch (e) {
          fail('Could not access the clipboard', e)
        }
      },
    })

    items.push(
      { id: 'act:sidebar', group: 'Actions', title: 'Toggle sidebar', subtitle: 'Ctrl B', keywords: 'collapse expand', icon: PanelLeft, run: () => usePrefs.getState().toggleSidebar() },
      {
        id: 'act:customize',
        group: 'Actions',
        title: 'Customize dashboard',
        subtitle: 'Rearrange and resize widgets',
        keywords: 'widgets layout edit',
        icon: SlidersHorizontal,
        run: () => {
          useNav.getState().go('home')
          useDashboardEdit.getState().setEditing(true)
        },
      },
    )

    return items
  }, [apps, spaces, activeId, projects, notes, favorites, roots, cpu, memUsed, memTotal, uptime])

  return useMemo(() => {
    const q = query.trim()
    const dynamic: CommandItem[] = []

    if (q) {
      if (looksLikePath(q)) {
        dynamic.push({
          id: 'dyn:path',
          group: 'Create',
          title: `Open ${q}`,
          subtitle: 'Folder or file on this PC',
          icon: Folder,
          boost: 100,
          run: () => useVault.getState().open(q),
        })
      }
      if (looksLikeUrl(q)) {
        dynamic.push({
          id: 'dyn:url',
          group: 'Create',
          title: `Open ${q}`,
          subtitle: 'Web link in your browser',
          icon: Globe,
          boost: 100,
          run: async () => {
            try {
              await call<void>('open_url', { url: q })
            } catch (e) {
              fail('Could not open that link', e)
            }
          },
        })
      }
      dynamic.push(
        {
          id: 'dyn:note',
          group: 'Create',
          title: `New note: “${q}”`,
          subtitle: 'Saved in Flow',
          icon: FilePlus2,
          run: async () => {
            const note = await useFlow.getState().createNote(q.slice(0, 80), '')
            if (!note) return
            useFlow.getState().setTab('notes')
            useFlow.getState().selectNote(note.id)
            useNav.getState().go('flow')
          },
        },
        {
          id: 'dyn:task',
          group: 'Create',
          title: `Add task: “${q}”`,
          subtitle: 'Saved in Flow',
          icon: ListPlus,
          run: async () => {
            const task = await useFlow.getState().addTask(q.slice(0, 200))
            if (task) toast.success('Task added', q.slice(0, 80))
          },
        },
      )
    } else {
      dynamic.push({
        id: 'dyn:new-note',
        group: 'Create',
        title: 'New note',
        subtitle: 'Start writing in Flow',
        icon: FilePlus2,
        run: async () => {
          const note = await useFlow.getState().createNote('', '')
          if (!note) return
          useFlow.getState().setTab('notes')
          useFlow.getState().selectNote(note.id)
          useNav.getState().go('flow')
        },
      })
    }

    const ranked = rankItems(base, q)
    if (q) return [...dynamic, ...ranked].slice(0, 40)

    // Empty query: a compact, useful starting list.
    const take = (group: Group, n: number) => ranked.filter((i) => i.group === group).slice(0, n)
    return [...dynamic, ...take('Spaces', 5), ...take('Applications', 6), ...take('Projects', 3), ...take('Folders', 4), ...take('System', 2), ...take('Actions', 2)]
  }, [base, query])
}
