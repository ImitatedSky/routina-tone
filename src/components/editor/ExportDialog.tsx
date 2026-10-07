import { useState } from 'react'
import { Download, Images, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEditor } from '@/editor/editorStore'
import { outputSize } from '@/engine/geometry'
import { exportImage } from '@/photo/exportImage'
import { gridSize } from '@/photo/pixelArt'
import { exportName } from '@/lib/download'
import { saveFile } from '@/lib/saveFile'
import { useT } from '@/i18n/i18n'
import { BatchDialog } from './BatchDialog'
import { TouchSlider } from './TouchSlider'

export function ExportDialog() {
  const t = useT()
  const labels = t.editor.export
  const photo = useEditor((s) => s.photo)
  const [open, setOpen] = useState(false)
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const adjustments = useEditor((s) => s.adjustments)

  // 像素畫輸出 PNG，沒有 JPEG 品質可調，改成說明輸出尺寸
  let pixelInfo: string | null = null
  if (photo && adjustments.pixelOn) {
    const out = outputSize(adjustments, photo)
    const grid = gridSize(adjustments, out.width, out.height)
    const k = adjustments.pixelScale
    pixelInfo = t.pixel.exportPng(grid.width * k, grid.height * k, k)
  }

  async function run() {
    if (!photo) return
    setBusy(true)
    try {
      const result = await exportImage(photo.file, useEditor.getState().adjustments, quality / 100)
      const saved = await saveFile(result.blob, exportName(photo.name, result.blob), 'image')
      if (saved.status === 'cancelled') return
      toast.success(labels.done(result.width, result.height), { description: saved.message })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" disabled={!photo} onClick={() => setOpen(true)}>
        <Download />
        {labels.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{pixelInfo ?? labels.description}</DialogDescription>
          </DialogHeader>
          {!pixelInfo && (
            <TouchSlider
              value={quality}
              min={60}
              max={100}
              step={1}
              label={labels.quality}
              valueText={String(quality)}
              onChange={setQuality}
              onCommit={() => {}}
              onReset={() => setQuality(92)}
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setBatchOpen(true)
              }}
            >
              <Images />
              {t.editor.batch.open}
            </Button>
            <Button disabled={busy} onClick={run}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              {busy ? labels.busy : pixelInfo ? t.pixel.run : labels.run}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BatchDialog open={batchOpen} onOpenChange={setBatchOpen} />
    </>
  )
}
