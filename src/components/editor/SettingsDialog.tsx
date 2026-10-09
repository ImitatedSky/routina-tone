import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useView } from '@/editor/editorStore'
import { useLanguage, useT, type LanguagePref } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

// 語言名稱一律用該語言自己的寫法，切錯語言時也認得出要點哪個
const LANGUAGE_NAMES: Record<Exclude<LanguagePref, 'system'>, string> = {
  'zh-Hant': '繁體中文',
  en: 'English',
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const pref = useLanguage((s) => s.pref)
  const setPref = useLanguage((s) => s.setPref)
  const showHistogram = useView((s) => s.showHistogram)
  const toggleHistogram = useView((s) => s.toggleHistogram)

  const options: { value: LanguagePref; label: string }[] = [
    { value: 'system', label: t.editor.settings.system },
    { value: 'zh-Hant', label: LANGUAGE_NAMES['zh-Hant'] },
    { value: 'en', label: LANGUAGE_NAMES.en },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.editor.settings.title}</DialogTitle>
        </DialogHeader>
        <section>
          <h3 id="settings-language" className="mb-2 text-xs text-muted-foreground">
            {t.editor.settings.language}
          </h3>
          <div role="radiogroup" aria-labelledby="settings-language" className="divide-y rounded-lg border">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={pref === o.value}
                onClick={() => setPref(o.value)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50 pointer-coarse:py-3.5',
                  pref === o.value && 'text-primary',
                )}
              >
                {o.label}
                {pref === o.value && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </section>
        {/* 手機的工具列放不下直方圖按鈕，在這裡開關 */}
        <section>
          <h3 className="mb-2 text-xs text-muted-foreground">{t.editor.settings.display}</h3>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm pointer-coarse:py-3">
            {t.editor.settings.histogram}
            <button
              type="button"
              role="switch"
              aria-checked={showHistogram}
              aria-label={t.editor.settings.histogram}
              onClick={toggleHistogram}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                showHistogram ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 size-5 rounded-full bg-foreground transition-transform',
                  showHistogram && 'translate-x-5 bg-primary-foreground',
                )}
              />
            </button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
