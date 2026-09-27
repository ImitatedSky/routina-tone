import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEditor } from '@/editor/editorStore'
import { exportJpeg } from '@/photo/exportJpeg'
import { baseName, safeFilename } from '@/lib/download'
import { saveFile } from '@/lib/saveFile'
import { useT } from '@/i18n/i18n'
import { TouchSlider } from './TouchSlider'

export function ExportDialog() {
  const t = useT()
  const labels = t.editor.export
  const photo = useEditor((s) => s.photo)
  const [open, setOpen] = useState(false)
  const [quality, setQuality] = useState(92)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!photo) return
    setBusy(true)
    try {
      const result = await exportJpeg(photo.file, useEditor.getState().adjustments, quality / 100)
      const saved = await saveFile(result.blob, `${safeFilename(baseName(photo.name))}-tone.jpg`, 'image')
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
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button disabled={busy} onClick={run}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              {busy ? labels.busy : labels.run}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
