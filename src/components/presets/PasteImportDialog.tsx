import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 回傳 true 表示匯入成功，對話框就關掉
  onImport: (text: string) => Promise<boolean>
}

// 貼上預設集的文字來匯入。用文字框讓使用者自己長按貼上，不必向 WebView 要剪貼簿讀取權限
export function PasteImportDialog({ open, onOpenChange, onImport }: Props) {
  const m = useT().presets
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    const ok = await onImport(text)
    setBusy(false)
    if (ok) {
      setText('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.pasteTitle}</DialogTitle>
          <DialogDescription>{m.pasteDescription}</DialogDescription>
        </DialogHeader>
        <textarea
          aria-label={m.pasteTitle}
          className="h-40 w-full resize-none rounded-lg border border-input bg-input/30 p-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder={m.pastePlaceholder}
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button disabled={!text.trim() || busy} onClick={() => void submit()}>
            {m.pasteSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
