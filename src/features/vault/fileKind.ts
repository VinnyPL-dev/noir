import {
  Archive,
  File,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  Cog,
  Sheet,
  type LucideIcon,
} from 'lucide-react'
import type { VaultEntry } from '../../lib/types'

const GROUPS: readonly [LucideIcon, readonly string[]][] = [
  [FileImage, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'heic', 'tiff']],
  [FileVideo, ['mp4', 'mkv', 'mov', 'avi', 'webm', 'wmv', 'flv', 'm4v']],
  [FileAudio, ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus']],
  [Archive, ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso']],
  [FileCode, ['js', 'ts', 'tsx', 'jsx', 'json', 'rs', 'py', 'lua', 'luau', 'cs', 'cpp', 'c', 'h', 'java', 'go', 'html', 'css', 'xml', 'yml', 'yaml', 'toml', 'sh', 'ps1', 'bat', 'sql']],
  [FileText, ['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt', 'log', 'ini', 'cfg']],
  [Sheet, ['xls', 'xlsx', 'csv', 'ods', 'tsv']],
  [Cog, ['exe', 'msi', 'dll', 'sys']],
]

const BY_EXT = new Map<string, LucideIcon>(GROUPS.flatMap(([icon, exts]) => exts.map((e) => [e, icon] as const)))

export const extOf = (name: string): string => {
  const i = name.lastIndexOf('.')
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : ''
}

export const iconForEntry = (entry: Pick<VaultEntry, 'name' | 'isDir'>): LucideIcon =>
  entry.isDir ? Folder : (BY_EXT.get(extOf(entry.name)) ?? File)

export function formatModified(ms: number | null): string {
  if (ms === null) return '—'
  const d = new Date(ms)
  const now = new Date()
  return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Splits a Windows path into clickable crumbs: "C:\\Users\\me" -> C:\\, C:\\Users, C:\\Users\\me. */
export function crumbsOf(path: string): { label: string; path: string }[] {
  const sep = path.includes('\\') ? '\\' : '/'
  const parts = path.split(/[\\/]+/).filter(Boolean)
  const out: { label: string; path: string }[] = []
  let acc = ''
  parts.forEach((part, i) => {
    acc = i === 0 ? (sep === '\\' ? `${part}\\` : `/${part}`) : `${acc.replace(/[\\/]$/, '')}${sep}${part}`
    out.push({ label: part, path: acc })
  })
  return out
}
