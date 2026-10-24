// Mirrors the serde(rename_all = "camelCase") structs in src-tauri/src/commands/system.rs

export interface SystemInfo {
  hostname: string
  osName: string
  osVersion: string
  cpuBrand: string
  physicalCores: number | null
  logicalCores: number
  totalMemory: number
}

export interface Snapshot {
  timestampMs: number
  cpuUsage: number
  perCore: number[]
  memoryUsed: number
  memoryTotal: number
  rxPerSec: number
  txPerSec: number
  uptimeSecs: number
}

export interface DiskInfo {
  name: string
  mountPoint: string
  fileSystem: string
  kind: 'SSD' | 'HDD' | 'Unknown'
  total: number
  available: number
  removable: boolean
}

export interface SessionInfo {
  username: string
  startedAtMs: number
}

export interface AppInfo {
  version: string
  dataDir: string
  dbPath: string
}

// ── Pulse (src-tauri/src/hardware.rs, commands/pulse.rs) ──

export interface GpuReading {
  name: string
  /** 0–100 */
  usage: number | null
  memoryUsed: number | null
  memoryTotal: number | null
  temperature: number | null
  powerWatts: number | null
}

export interface GpuSnapshot {
  status: 'pending' | 'ok' | 'unavailable'
  /** Where the numbers come from, or why there are none. */
  source: string
  gpus: GpuReading[]
}

export interface TempReading {
  label: string
  celsius: number
  max: number | null
  critical: number | null
}

export interface ProcessGroup {
  name: string
  count: number
  /** Share of total CPU capacity, 0–100. */
  cpu: number
  memory: number
}

export interface PulseSnapshot {
  timestampMs: number
  processes: ProcessGroup[]
  processCount: number
  diskReadPerSec: number | null
  diskWritePerSec: number | null
  temperatures: TempReading[]
  gpu: GpuSnapshot
}

// ── Orbit (src-tauri/src/apps.rs, commands/orbit.rs) ──

export type AppCategory =
  | 'Games'
  | 'Development'
  | 'Browsers'
  | 'Communication'
  | 'Media'
  | 'Productivity'
  | 'Utilities'
  | 'Other'

export interface AppRecord {
  id: string
  name: string
  kind: 'start' | 'custom'
  /** Full path for custom apps; empty for Start-menu apps. */
  path: string
  category: AppCategory
  categoryLocked: boolean
  icon: string | null
  favorite: boolean
  hidden: boolean
  launchCount: number
  lastLaunched: number | null
}

// ── Flow (src-tauri/src/flow.rs) ──

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  title: string
  done: boolean
  pinned: boolean
  /** Due date as epoch milliseconds, or null. */
  due: number | null
  projectId: string | null
  createdAt: number
  completedAt: number | null
}

export interface Project {
  id: string
  name: string
  path: string | null
  archived: boolean
  createdAt: number
  lastOpened: number | null
  openTasks: number
  focusSecs: number
}

export interface WorkSession {
  id: string
  label: string
  projectId: string | null
  startedAt: number
  durationSecs: number
  kind: 'stopwatch' | 'countdown'
}

// ── Vault (src-tauri/src/vault.rs) ──

export interface VaultEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modified: number | null
}

export interface VaultListing {
  path: string
  parent: string | null
  entries: VaultEntry[]
  truncated: boolean
}

export interface VaultRoot {
  label: string
  path: string
  kind: 'folder' | 'drive'
}

export interface SearchOutcome {
  hits: VaultEntry[]
  scanned: number
  truncated: boolean
  elapsedMs: number
}

export interface BreakdownItem {
  name: string
  path: string
  isDir: boolean
  size: number
  partial: boolean
}

export interface Breakdown {
  items: BreakdownItem[]
  total: number
  complete: boolean
}

export interface DupFile {
  path: string
  modified: number | null
}

export interface DupGroup {
  size: number
  wasted: number
  files: DupFile[]
}

export interface DupOutcome {
  groups: DupGroup[]
  scanned: number
  truncated: boolean
}

export type Preview =
  | { kind: 'text'; text: string; truncated: boolean; size: number }
  | { kind: 'image'; dataUrl: string; size: number }
  | { kind: 'none'; reason: string; size: number }

export interface TrashReport {
  moved: number
  failed: string[]
}

export interface FavFolder {
  path: string
  label: string
  exists: boolean
}

export interface RecentFile {
  path: string
  name: string
  openedAt: number
  exists: boolean
  isDir: boolean
}

export interface Collection {
  id: string
  name: string
  count: number
  createdAt: number
}

export interface CollectionItem {
  path: string
  name: string
  exists: boolean
  isDir: boolean
  size: number
}

// ── Spaces (src-tauri/src/spaces.rs) ──

export type SpaceIcon =
  | 'grid'
  | 'gamepad'
  | 'code'
  | 'coffee'
  | 'briefcase'
  | 'music'
  | 'palette'
  | 'book'
  | 'terminal'
  | 'rocket'
  | 'home'
  | 'star'

export type Shortcut =
  | { kind: 'app'; id: string }
  | { kind: 'folder'; path: string; label?: string | null }
  | { kind: 'url'; url: string; label?: string | null }

export interface Space {
  id: string
  name: string
  icon: SpaceIcon
  position: number
  layout: string | null
  prefs: string
  shortcuts: Shortcut[]
  createdAt: number
}

export interface SpacePrefs {
  density: 'comfortable' | 'compact'
  tagline: string
}

// ── Automations (src-tauri/src/automations.rs) ──

export type AutomationAction =
  | { type: 'launchApp'; appId: string }
  | { type: 'openFolder'; path: string }
  | { type: 'openProject'; projectId: string }
  | { type: 'openUrl'; url: string }

export interface Automation {
  id: string
  name: string
  spaceId: string
  actions: AutomationAction[]
  enabled: boolean
  createdAt: number
  lastRun: number | null
}

export interface AutomationPermissions {
  master: boolean
  apps: boolean
  folders: boolean
  urls: boolean
}

export interface ActionResult {
  label: string
  ok: boolean
  detail: string | null
}

export interface RunReport {
  automationId: string
  name: string
  results: ActionResult[]
}

export interface AutomationLogEntry {
  id: number
  automationId: string
  name: string
  ranAt: number
  ok: boolean
  detail: string
}

// ── Command (src-tauri/src/commands/command.rs) ──

export interface ShortcutInfo {
  accelerator: string
  registered: boolean
  error: string | null
}
