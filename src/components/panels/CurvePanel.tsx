import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SliderSection, type SliderDef } from '@/components/editor/SliderSection'
import { CURVE_CHANNELS, DEFAULT_CURVE, isIdentityCurve, type CurveChannel } from '@/engine/adjustments'
import { parametricCurve, pointCurve } from '@/engine/curves'
import { useEditor } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { CurveEditor, type GhostCurve } from './CurveEditor'
import { NumberField } from './NumberField'

const CHANNEL_COLORS: Record<CurveChannel, string> = {
  rgb: 'oklch(0.93 0 0)',
  red: 'oklch(0.68 0.2 25)',
  green: 'oklch(0.75 0.17 145)',
  blue: 'oklch(0.68 0.16 255)',
}

const REGION_KEYS = ['curveHighlights', 'curveLights', 'curveDarks', 'curveShadows'] as const

export function CurvePanel() {
  const t = useT()
  const text = t.panels.curve
  const [channel, setChannel] = useState<CurveChannel>('rgb')
  const [selected, setSelected] = useState<number | null>(null)
  const adjustments = useEditor((s) => s.adjustments)
  const setCurve = useEditor((s) => s.setCurve)
  const commit = useEditor((s) => s.commit)

  const regionSliders: SliderDef[] = [
    { key: 'curveHighlights', label: text.regions.highlights },
    { key: 'curveLights', label: text.regions.lights },
    { key: 'curveDarks', label: text.regions.darks },
    { key: 'curveShadows', label: text.regions.shadows },
  ]
  const splitSliders: SliderDef[] = [
    { key: 'curveShadowSplit', label: text.splitPoints.shadow },
    { key: 'curveMidtoneSplit', label: text.splitPoints.midtone },
    { key: 'curveHighlightSplit', label: text.splitPoints.highlight },
  ]

  const points = adjustments.curve[channel]
  // undo 之後點的數量可能變了
  const selectedPoint = selected !== null ? points[selected] : undefined
  const isEndpoint = selected === 0 || selected === points.length - 1

  // RGB 頻道畫的是參數式曲線再套點曲線，拉區域滑桿時才看得到效果
  const parametric = parametricCurve(adjustments)
  const rgb = pointCurve(adjustments.curve.rgb)
  const masterCurve = (x: number) => rgb(parametric(x / 255) * 255)
  const masterChanged =
    !isIdentityCurve(adjustments.curve.rgb) || REGION_KEYS.some((key) => adjustments[key] !== 0)

  const curve = channel === 'rgb' ? masterCurve : pointCurve(points)
  const ghosts: GhostCurve[] = []
  for (const c of CURVE_CHANNELS) {
    if (c === channel) continue
    if (c === 'rgb') {
      if (masterChanged) ghosts.push({ color: CHANNEL_COLORS.rgb, curve: masterCurve })
    } else if (!isIdentityCurve(adjustments.curve[c])) {
      ghosts.push({ color: CHANNEL_COLORS[c], curve: pointCurve(adjustments.curve[c]) })
    }
  }

  function selectChannel(c: CurveChannel) {
    setChannel(c)
    setSelected(null)
  }

  function reset() {
    setCurve(channel, DEFAULT_CURVE[channel])
    commit()
    setSelected(null)
  }

  // 直接打數字改選取的點：輸入值夾在左右兩點之間（端點也照樣保持順序），輸出值 0..255
  function setSelectedPoint(index: 0 | 1, value: number) {
    if (selected === null) return
    const next = points.map((p) => [...p] as [number, number])
    if (index === 0) {
      const lo = selected > 0 ? points[selected - 1][0] + 1 : 0
      const hi = selected < points.length - 1 ? points[selected + 1][0] - 1 : 255
      next[selected][0] = Math.min(hi, Math.max(lo, value))
    } else {
      next[selected][1] = Math.min(255, Math.max(0, value))
    }
    setCurve(channel, next)
    commit()
  }

  function removeSelected() {
    if (selected === null || isEndpoint) return
    setCurve(channel, points.filter((_, i) => i !== selected))
    commit()
    setSelected(null)
  }

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label={text.channelsLabel}>
          {CURVE_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === channel}
              onClick={() => selectChannel(c)}
              className={cn(
                'flex h-7 min-w-10 items-center pointer-coarse:h-9 justify-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors',
                c === channel && 'bg-background text-foreground shadow-sm',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: CHANNEL_COLORS[c] }} />
              {text.channels[c]}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" disabled={isIdentityCurve(points)} onClick={reset}>
          {t.common.reset}
        </Button>
      </div>

      <div className="px-4 py-2">
        {/* 曲線編輯器會攔下所有觸控，手機上兩側留空讓手指能捲動面板 */}
        <div className="mx-auto max-w-80 pointer-coarse:max-w-64">
          <CurveEditor
            points={points}
            color={CHANNEL_COLORS[channel]}
            curve={curve}
            ghosts={ghosts}
            selected={selectedPoint ? selected : null}
            onSelect={setSelected}
            onChange={(next) => setCurve(channel, next)}
            onCommit={commit}
          />
        </div>
        <div className="mt-2 flex min-h-7 items-center justify-between text-xs">
          {selectedPoint ? (
            <>
              <span className="flex items-center gap-2">
                <NumberField
                  label={text.input}
                  value={Math.round(selectedPoint[0])}
                  normalize={(v) => Math.min(255, Math.max(0, v))}
                  onSubmit={(v) => setSelectedPoint(0, v)}
                />
                <span className="text-muted-foreground">→</span>
                <NumberField
                  label={text.output}
                  value={Math.round(selectedPoint[1])}
                  normalize={(v) => Math.min(255, Math.max(0, v))}
                  onSubmit={(v) => setSelectedPoint(1, v)}
                />
              </span>
              <Button variant="ghost" size="xs" disabled={isEndpoint} onClick={removeSelected}>
                {t.common.delete}
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">{text.addPointHint}</span>
          )}
        </div>
      </div>

      <SliderSection title={text.region} sliders={regionSliders} />
      <SliderSection title={text.splits} sliders={splitSliders} />
    </div>
  )
}
