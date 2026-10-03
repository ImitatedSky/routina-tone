import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useT } from '@/i18n/i18n'

interface Props {
  id?: string
  value: number
  min: number
  max: number
  step: number
  label: ReactNode
  valueText: string
  // 軌道的 CSS 背景，例如色溫的藍到黃
  track?: string
  onChange: (value: number) => void
  // 一次操作結束（放開、按鍵放開）時呼叫一次，一次拖曳只算一步 undo
  onCommit: () => void
  onReset?: () => void
}

// 手指要先往水平方向移動這麼多，才算是在調滑桿
const LOCK_DISTANCE = 8

interface Gesture {
  pointerId: number
  startX: number
  startY: number
  startValue: number
  // pending：還不知道是要捲動還是要調；relative：手指拖曳（相對移動）；absolute：滑鼠（跳到點的位置）
  mode: 'pending' | 'relative' | 'absolute'
  changed: boolean
}

/**
 * 修圖用的滑桿，照 Lightroom 手機版的手感：
 * - 手指往上下滑是捲動面板，不會動到數值；要先往左右拖才開始調
 * - 手指拖曳是「相對」的：從按下的地方開始算位移，數值不會先跳到手指的位置
 * - 輕點不改數值，雙擊歸零
 * - 滑鼠照一般滑桿：點哪裡跳到哪裡
 * 整列（標籤、數值、軌道）都能拖，不用瞄準細細的軌道。
 * 點右邊的數字可以直接打數值。
 */
export function TouchSlider({ id, value, min, max, step, label, valueText, track, onChange, onCommit, onReset }: Props) {
  const labelId = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  function snap(v: number) {
    const snapped = Math.round((v - min) / step) * step + min
    // 去掉浮點誤差（0.1 * 3 = 0.30000000000000004）
    const clean = Number(snapped.toFixed(4))
    return Math.min(max, Math.max(min, clean))
  }

  function valueAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return value
    return snap(min + ((clientX - rect.left) / rect.width) * (max - min))
  }

  function update(next: number) {
    if (next === value) return
    onChange(next)
    if (gesture.current) gesture.current.changed = true
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const isMouse = e.pointerType === 'mouse'
    gesture.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startValue: value,
      mode: isMouse ? 'absolute' : 'pending',
      changed: false,
    }
    if (isMouse) {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      update(valueAt(e.clientX))
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    if (g.mode === 'absolute') {
      update(valueAt(e.clientX))
      return
    }
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (g.mode === 'pending') {
      if (Math.abs(dy) > LOCK_DISTANCE && Math.abs(dy) >= Math.abs(dx)) {
        // 是捲動，交給瀏覽器
        gesture.current = null
        return
      }
      if (Math.abs(dx) <= LOCK_DISTANCE) return
      // 從鎖定的這一刻起算位移，數值不會因為前面那幾個像素跳一下
      g.mode = 'relative'
      g.startX = e.clientX
      e.currentTarget.setPointerCapture?.(e.pointerId)
      return
    }
    const width = trackRef.current?.getBoundingClientRect().width ?? 0
    if (width === 0) return
    update(snap(g.startValue + ((e.clientX - g.startX) / width) * (max - min)))
  }

  function endGesture(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    gesture.current = null
    if (g.changed) onCommit()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const big = step * 10
    const next: Record<string, number> = {
      ArrowLeft: value - step,
      ArrowDown: value - step,
      ArrowRight: value + step,
      ArrowUp: value + step,
      PageDown: value - big,
      PageUp: value + big,
      Home: min,
      End: max,
    }
    if (!(e.key in next)) return
    e.preventDefault()
    const v = snap(next[e.key])
    if (v !== value) onChange(v)
  }

  const percent = ((value - min) / (max - min)) * 100

  // 外層接拖曳手勢（整列都能拖）；滑桿角色、鍵盤操作在軌道那層，數字輸入框才不會被包在滑桿裡
  return (
    <div
      className="cursor-pointer touch-pan-y rounded-md py-2 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={onReset}
    >
      <div className="flex items-center justify-between text-xs">
        <span id={labelId} className="text-muted-foreground">
          {label}
        </span>
        <ValueInput
          value={value}
          step={step}
          valueText={valueText}
          label={label}
          onSubmit={(v) => {
            const next = snap(v)
            if (next !== value) {
              onChange(next)
              onCommit()
            }
          }}
        />
      </div>
      <div
        ref={trackRef}
        id={id}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="relative mt-2 h-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onKeyDown={onKeyDown}
        onKeyUp={onCommit}
      >
        <div
          className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{ background: track ?? 'oklch(1 0 0 / 18%)' } as CSSProperties}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// 數值的小數位數跟著 step
function decimals(step: number) {
  return step >= 1 ? 0 : step >= 0.1 ? 1 : 2
}

// 右上角的數字：點一下變成輸入框，Enter 或離開欄位套用，Esc 取消
function ValueInput({
  value,
  step,
  valueText,
  label,
  onSubmit,
}: {
  value: number
  step: number
  valueText: string
  label: ReactNode
  onSubmit: (value: number) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const name = typeof label === 'string' ? label : ''
  // 輸入框裡的操作不要被外層當成拖曳、雙擊歸零或滑桿的方向鍵
  const stop = { onPointerDown: (e: PointerEvent) => e.stopPropagation(), onDoubleClick: (e: { stopPropagation: () => void }) => e.stopPropagation() }

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={t.common.typeValue(name)}
        className="-mr-1 rounded px-1 tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 pointer-coarse:py-1"
        {...stop}
        onClick={() => setDraft(value.toFixed(decimals(step)))}
      >
        {valueText}
      </button>
    )
  }

  function submit(text: string) {
    setDraft(null)
    const parsed = Number(text.trim().replace(',', '.'))
    if (text.trim() !== '' && Number.isFinite(parsed)) onSubmit(parsed)
  }

  return (
    <input
      autoFocus
      type="text"
      inputMode="decimal"
      aria-label={t.common.typeValue(name)}
      className="h-6 w-16 rounded border border-ring bg-input/30 px-1 text-right text-xs text-foreground tabular-nums outline-none pointer-coarse:h-8"
      value={draft}
      {...stop}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => submit(e.currentTarget.value)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}
