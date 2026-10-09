import { useState } from 'react'
import { ChartColumn, Eye, ImagePlus, Redo2, Settings, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditor, useView, type Workspace } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { ExportDialog } from './ExportDialog'
import { OpenPhotoButton } from './OpenPhotoButton'
import { SettingsDialog } from './SettingsDialog'

export function Toolbar() {
  const t = useT()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const photo = useEditor((s) => s.photo)
  const canUndo = useEditor((s) => s.past.length > 0 || s.adjustments !== s.committed)
  const canRedo = useEditor((s) => s.future.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const setShowOriginal = useView((s) => s.setShowOriginal)
  const showHistogram = useView((s) => s.showHistogram)
  const toggleHistogram = useView((s) => s.toggleHistogram)
  const workspace = useView((s) => s.workspace)
  const setWorkspace = useView((s) => s.setWorkspace)
  const labels = t.editor.toolbar

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
      <span className="hidden px-2 text-sm font-semibold sm:inline">Tone</span>
      <OpenPhotoButton variant="ghost" size="sm" aria-label={labels.open}>
        <ImagePlus />
        <span className="hidden sm:inline">{labels.open}</span>
      </OpenPhotoButton>
      <div role="group" aria-label={t.editor.workspaces.label} className="flex shrink-0 rounded-md bg-muted p-0.5">
        {(['develop', 'tools'] as Workspace[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={workspace === id}
            disabled={!photo}
            onClick={() => setWorkspace(id)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
              workspace === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t.editor.workspaces[id]}
          </button>
        ))}
      </div>
      {/* 手機上放不下檔名，只留著撐開右邊的按鈕 */}
      <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">
        <span className="hidden md:inline">{photo?.name}</span>
      </span>
      <Button variant="ghost" size="icon" aria-label={labels.undo} disabled={!canUndo} onClick={undo}>
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label={labels.redo} disabled={!canRedo} onClick={redo}>
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={showHistogram ? labels.hideHistogram : labels.showHistogram}
        aria-pressed={showHistogram}
        disabled={!photo}
        onClick={toggleHistogram}
        // 手機上放不下，改在設定裡開關
        className={cn('hidden sm:inline-flex', showHistogram ? 'text-foreground' : 'text-muted-foreground')}
      >
        <ChartColumn />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.holdForOriginal}
        title={labels.holdForOriginal}
        disabled={!photo}
        onPointerDown={() => setShowOriginal(true)}
        onPointerUp={() => setShowOriginal(false)}
        onPointerLeave={() => setShowOriginal(false)}
        onPointerCancel={() => setShowOriginal(false)}
        // 手機上放不下；按住照片一樣能看原圖
        className="hidden sm:inline-flex"
      >
        <Eye />
      </Button>
      <Button variant="ghost" size="icon" aria-label={labels.settings} onClick={() => setSettingsOpen(true)}>
        <Settings />
      </Button>
      <ExportDialog />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}
