import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEditor } from '@/editor/editorStore'
import { exportJpeg } from '@/photo/exportJpeg'
import { baseName, downloadBlob, safeFilename } from '@/lib/download'

export function ExportDialog() {
  const photo = useEditor((s) => s.photo)
  const [open, setOpen] = useState(false)
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!photo) return
    setBusy(true)
    try {
      const result = await exportJpeg(photo.file, useEditor.getState().adjustments, quality / 100)
      downloadBlob(result.blob, `${safeFilename(baseName(photo.name))}-tone.jpg`)
      toast.success(`已匯出 ${result.width}×${result.height}`)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '匯出失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" disabled={!photo} onClick={() => setOpen(true)}>
        <Download />
        匯出
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>匯出照片</DialogTitle>
            <DialogDescription>以原始尺寸輸出 JPEG（sRGB）。</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex justify-between text-xs">
              <label htmlFor="export-quality" className="text-muted-foreground">
                品質
              </label>
              <span className="tabular-nums">{quality}</span>
            </div>
            <input
              id="export-quality"
              type="range"
              className="tone-range"
              min={60}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            />
          </div>
          <DialogFooter>
            <Button disabled={busy} onClick={run}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              {busy ? '處理中…' : '匯出 JPEG'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
