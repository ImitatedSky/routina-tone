import { ChartColumn, Eye, ImagePlus, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditor, useView } from '@/editor/editorStore'
import { ExportDialog } from './ExportDialog'
import { OpenPhotoButton } from './OpenPhotoButton'

export function Toolbar() {
  const photo = useEditor((s) => s.photo)
  const canUndo = useEditor((s) => s.past.length > 0 || s.adjustments !== s.committed)
  const canRedo = useEditor((s) => s.future.length > 0)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const setShowOriginal = useView((s) => s.setShowOriginal)
  const showHistogram = useView((s) => s.showHistogram)
  const toggleHistogram = useView((s) => s.toggleHistogram)

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
      <span className="px-1.5 text-sm font-semibold sm:px-2">Tone</span>
      <OpenPhotoButton variant="ghost" size="sm">
        <ImagePlus />
        <span className="hidden sm:inline">開啟</span>
      </OpenPhotoButton>
      <span className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">{photo?.name}</span>
      <Button variant="ghost" size="icon" aria-label="復原" disabled={!canUndo} onClick={undo}>
        <Undo2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label="重做" disabled={!canRedo} onClick={redo}>
        <Redo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={showHistogram ? '隱藏直方圖' : '顯示直方圖'}
        aria-pressed={showHistogram}
        disabled={!photo}
        onClick={toggleHistogram}
        className={showHistogram ? 'text-foreground' : 'text-muted-foreground'}
      >
        <ChartColumn />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="按住看原圖"
        title="按住看原圖"
        disabled={!photo}
        onPointerDown={() => setShowOriginal(true)}
        onPointerUp={() => setShowOriginal(false)}
        onPointerLeave={() => setShowOriginal(false)}
        onPointerCancel={() => setShowOriginal(false)}
      >
        <Eye />
      </Button>
      <ExportDialog />
    </header>
  )
}
