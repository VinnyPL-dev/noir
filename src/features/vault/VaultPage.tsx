import { useEffect } from 'react'
import { ChartBar, Copy, FolderHeart, FolderTree } from 'lucide-react'
import { NativeRequired } from '../../components/shell/NativeRequired'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { useVault } from '../../store/vault'
import { BrowseView } from './BrowseView'
import { CollectionsView } from './CollectionsView'
import { DuplicatesView } from './DuplicatesView'
import { StorageView } from './StorageView'
import { useVaultUi, type VaultTab } from './ui'

const TABS = [
  { value: 'browse', label: 'Browse', icon: FolderTree },
  { value: 'storage', label: 'Storage', icon: ChartBar },
  { value: 'duplicates', label: 'Duplicates', icon: Copy },
  { value: 'collections', label: 'Collections', icon: FolderHeart },
] as const

function Body() {
  const tab = useVaultUi((s) => s.tab)
  const setTab = useVaultUi((s) => s.setTab)
  const loaded = useVault((s) => s.loaded)

  useEffect(() => {
    void useVault.getState().load()
  }, [])

  return (
    <PageContainer>
      <PageHeader route="vault" description="Browse, preview and search your files. Nothing is deleted without your confirmation, and deleted items go to the Recycle Bin." />
      <div className="mb-5">
        <Tabs<VaultTab>
          label="Vault sections"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({
            value: t.value,
            ariaLabel: t.label,
            label: (
              <span className="inline-flex items-center gap-2">
                <t.icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t.label}
              </span>
            ),
          }))}
        />
      </div>
      {!loaded ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : tab === 'browse' ? (
        <BrowseView />
      ) : tab === 'storage' ? (
        <StorageView />
      ) : tab === 'duplicates' ? (
        <DuplicatesView />
      ) : (
        <CollectionsView />
      )}
    </PageContainer>
  )
}

export function VaultPage() {
  return (
    <NativeRequired route="vault" description="Browse, preview and search your files." what="Vault reads your real files and folders, so it">
      <Body />
    </NativeRequired>
  )
}
