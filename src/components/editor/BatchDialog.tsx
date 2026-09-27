import { useEffect, useRef, useState } from 'react'
import { Check, Images, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useEditor } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { runBatch, type BatchProgress } from '@/photo/batch'
import { listPresets, type Preset } from '@/storage/db'
import { TouchSlider } from './TouchSlider'

const CURRENT = 'current'

export function BatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const text = t.editor.batch
  const hasPhoto = useEditor((s) => s.photo !== null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [choice, setChoice] = useState<string>(CURRENT)
  const [quality, setQuality] = useState(92)
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const cancelled = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const running = progress !== null

  useEffect(() => {
    if (!open) return
    listPresets().then(setPresets, () => setPresets([]))
  }, [open])

  // 沒開照片時「目前的設定」沒有意義，改成第一個預設集
  const effectiveChoice = !hasPhoto && choice === CURRENT ? presets[0]?.id : choice
  const canStart = effectiveChoice !== undefined && !running

  async function start(files: File[]) {
    const settings =
      effectiveChoice === CURRENT
        ? useEditor.getState().adjustments
        : presets.find((p) => p.id === effectiveChoice)?.adjustments
    if (!settings || files.length === 0) return
    cancelled.current = false
    setProgress({ done: 0, total: files.length, current: '' })
    const result = await runBatch(files, settings, quality / 100, {
      onProgress: setProgress,
      isCancelled: () => cancelled.current,
    })
    setProgress(null)
    const summary = result.cancelled ? text.stopped(result.saved) : text.done(result.saved)
    if (result.failures.length > 0) {
      toast.warning(`${summary} · ${text.failed(result.failures.length)}`, {
        description: result.failures.map((f) => `${f.name}: ${f.message}`).join('\n'),
      })
    } else {
      toast.success(summary)
    }
    if (!result.cancelled) onOpenChange(false)
  }

  const options = [
    ...(hasPhoto ? [{ id: CURRENT, name: text.current }] : []),
    ...presets.map((p) => ({ id: p.id, name: p.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>

        <section>
          <h3 id="batch-settings" className="mb-2 text-xs text-muted-foreground">
            {text.settings}
          </h3>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">{text.noPresets}</p>
          ) : (
            <div role="radiogroup" aria-labelledby="batch-settings" className="max-h-48 divide-y overflow-y-auto rounded-lg border">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={effectiveChoice === o.id}
                  disabled={running}
                  onClick={() => setChoice(o.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50 pointer-coarse:py-3.5',
                    effectiveChoice === o.id && 'text-primary',
                  )}
                >
                  <span className="truncate">{o.name}</span>
                  {effectiveChoice === o.id && <Check className="size-4 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </section>

        <TouchSlider
          value={quality}
          min={60}
          max={100}
          step={1}
          label={t.editor.export.quality}
          valueText={String(quality)}
          onChange={setQuality}
          onCommit={() => {}}
          onReset={() => setQuality(92)}
        />

        {running && (
          <div aria-live="polite" className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{text.progress(progress.done, progress.total)}</span>
              <span className="ml-2 truncate">{progress.current}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={() => (cancelled.current = true)}>
              <Loader2 className="animate-spin" />
              {text.cancel}
            </Button>
          ) : (
            <Button disabled={!canStart} onClick={() => fileRef.current?.click()}>
              <Images />
              {text.choose}
            </Button>
          )}
        </DialogFooter>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void start(files)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
