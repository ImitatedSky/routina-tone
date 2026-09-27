import { useId, useState, type KeyboardEvent } from 'react'

interface Props {
  label: string
  value: number
  unit?: string
  // 把輸入的數字轉成合法值（夾在範圍內、色相繞回 0..359 等）
  normalize: (value: number) => number
  onSubmit: (value: number) => void
}

// 可以直接打數字的小欄位。輸入中只改草稿，按 Enter 或離開欄位才套用（一次套用算一步 undo）；
// 上下鍵每次 ±1 並立即套用
export function NumberField({ label, value, unit, normalize, onSubmit }: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  function submit(text: string) {
    setDraft(null)
    const parsed = Number(text.trim())
    if (text.trim() === '' || !Number.isFinite(parsed)) return
    const next = normalize(Math.round(parsed))
    if (next !== value) onSubmit(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = normalize(value + (e.key === 'ArrowUp' ? 1 : -1))
      setDraft(null)
      if (next !== value) onSubmit(next)
    }
  }

  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={label}
        className="h-7 w-12 rounded-md border border-input bg-input/30 px-1.5 text-center text-sm text-foreground tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-9 pointer-coarse:w-14"
        value={draft ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => submit(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      {unit}
    </label>
  )
}
