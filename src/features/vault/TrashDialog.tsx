import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { toast } from '../../components/ui/Toast'
import { formatBytes } from '../../lib/format'
import { call } from '../../lib/tauri'
import type { TrashReport } from '../../lib/types'
import { folderName } from '../../lib/launch'

export interface TrashTarget {
  path: string
  isDir: boolean
  size: number
}

interface Props {
  targets: TrashTarget[] | null
  onClose: () => void
  /** Called after the move finishes, with the paths that actually moved. */
  onDone: (movedAll: boolean) => void
}

/** The only way Vault deletes anything: an explicit confirmation, then the Recycle Bin (never permanent). */
export function TrashDialog({ targets, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const list = targets ?? []
  const total = list.reduce((n, t) => n + t.size, 0)
  const folders = list.filter((t) => t.isDir).length

  const confirm = async () => {
    setBusy(true)
    try {
      const report = await call<TrashReport>('vault_trash', { paths: list.map((t) => t.path), confirmed: true })
      if (report.failed.length === 0) toast.success(`Moved ${report.moved} ${report.moved === 1 ? 'item' : 'items'} to the Recycle Bin`, 'You can restore them from there.')
      else toast.error(`${report.failed.length} of ${list.length} could not be moved`, report.failed[0])
      onDone(report.failed.length === 0)
    } catch (e) {
      toast.error('Nothing was deleted', e instanceof Error ? e.message : undefined)
      onDone(false)
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Modal
      open={targets !== null}
      onClose={() => !busy && onClose()}
      title={`Move ${list.length} ${list.length === 1 ? 'item' : 'items'} to the Recycle Bin?`}
      description={
        folders > 0
          ? `Includes ${folders} ${folders === 1 ? 'folder' : 'folders'} and everything inside. You can restore them from the Recycle Bin.`
          : 'You can restore them from the Recycle Bin.'
      }
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} data-autofocus onClick={() => void confirm()}>
            Move to Recycle Bin
          </Button>
        </>
      }
    >
      <ul className="max-h-[200px] overflow-y-auto rounded-ctl border border-noir-line">
        {list.slice(0, 50).map((t) => (
          <li key={t.path} className="flex items-center gap-3 border-b border-noir-line/60 px-3 py-2 last:border-0">
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-noir-paper" title={t.path}>
              {folderName(t.path)}
            </span>
            {!t.isDir && <span className="shrink-0 font-mono text-[10.5px] text-noir-silver">{formatBytes(t.size)}</span>}
          </li>
        ))}
        {list.length > 50 && <li className="px-3 py-2 text-[12px] text-noir-silver">…and {list.length - 50} more</li>}
      </ul>
      {total > 0 && <p className="mt-3 font-mono text-[11px] text-noir-silver">{formatBytes(total)} in files{folders > 0 ? ' (folder contents not counted)' : ''}</p>}
    </Modal>
  )
}
