import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      </DialogContent>
    </Dialog>
  )
}
