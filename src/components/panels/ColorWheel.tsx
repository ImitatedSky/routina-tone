import type { PointerEvent } from 'react'
import { useT } from '@/i18n/i18n'
import { NumberField } from './NumberField'
import { WHEEL_BACKGROUND, hueSatToPoint, pointToHueSat, tintColor } from './wheelMath'

interface Props {
  hue: number
  sat: number
  onChange: (hue: number, sat: number) => void
  onCommit: () => void
  onReset: () => void
  label: string
  // 最大寬度，窄的時候會跟著縮小
  size?: number
}

// 色相繞回 0..359（370 → 10、-10 → 350），飽和度夾在 0..100
const wrapHue = (v: number) => ((v % 360) + 360) % 360
const clampSat = (v: number) => Math.min(100, Math.max(0, v))

// 拖曳色輪任何地方都能選色相與飽和度，也可以在下面直接輸入數字；雙擊重設
export function ColorWheel({ hue, sat, onChange, onCommit, onReset, label, size = 240 }: Props) {
  const t = useT()
  const handle = hueSatToPoint(hue, sat)

  function update(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2
    const x = (e.clientX - rect.left - radius) / radius
    const y = (e.clientY - rect.top - radius) / radius
    const next = pointToHueSat(x, y)
    onChange(Math.round(next.hue) % 360, Math.round(next.sat))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    update(e)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e)
  }

  return (
    // 色輪會攔下所有觸控（二維拖曳分不出是不是要捲動），手機上縮小一點，兩側留空讓手指能捲動面板
    <div className="mx-auto w-full pointer-coarse:max-w-56!" style={{ maxWidth: size }}>
      <div
        role="group"
        aria-label={label}
        className="relative aspect-square w-full cursor-crosshair rounded-full"
        style={{ background: WHEEL_BACKGROUND, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onDoubleClick={onReset}
      >
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          style={{
            left: `${50 + handle.x * 50}%`,
            top: `${50 + handle.y * 50}%`,
            background: tintColor(hue, sat),
          }}
        />
      </div>
      <div className="mt-2 flex justify-center gap-4">
        <NumberField
          label={t.panels.wheel.hue}
          unit="°"
          value={Math.round(hue)}
          normalize={wrapHue}
          onSubmit={(h) => {
            onChange(h, sat)
            onCommit()
          }}
        />
        <NumberField
          label={t.panels.wheel.sat}
          value={Math.round(sat)}
          normalize={clampSat}
          onSubmit={(s) => {
            onChange(hue, s)
            onCommit()
          }}
        />
      </div>
    </div>
  )
}
