import { useState } from 'react'
import { SliderSection, type SliderDef } from '@/components/editor/SliderSection'
import { BANDS, DEFAULT_ADJUSTMENTS, type Band, type ScalarKey } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

type Property = 'hue' | 'sat' | 'lum'

const PROPERTIES: Property[] = ['hue', 'sat', 'lum']

const BAND_COLORS: Record<Band, string> = {
  red: '#e5484d',
  orange: '#f08c2e',
  yellow: '#e8d23a',
  green: '#46a758',
  aqua: '#3cc7c7',
  blue: '#3e7ce0',
  purple: '#8e4ec6',
  magenta: '#d6409f',
}

function mix(color: string, other: string, percent: number) {
  return `color-mix(in oklab, ${color}, ${other} ${percent}%)`
}

function track(property: Property, index: number) {
  const color = BAND_COLORS[BANDS[index]]
  if (property === 'hue') {
    // 往左偏向前一個色帶、往右偏向下一個（紅色的前一個是洋紅）
    const prev = BAND_COLORS[BANDS[(index + BANDS.length - 1) % BANDS.length]]
    const next = BAND_COLORS[BANDS[(index + 1) % BANDS.length]]
    return `linear-gradient(to right, ${mix(prev, color, 30)}, ${color}, ${mix(next, color, 30)})`
  }
  if (property === 'sat') return `linear-gradient(to right, #8a8a8a, ${color})`
  return `linear-gradient(to right, ${mix(color, 'black', 65)}, ${color}, ${mix(color, 'white', 65)})`
}

function keyOf(property: Property, band: Band) {
  return (property + band[0].toUpperCase() + band.slice(1)) as ScalarKey
}

// Lightroom 混色器的「顏色」模式：先點選一個顏色，下面是它的色相／飽和度／明度
export function MixerPanel() {
  const t = useT()
  const [band, setBand] = useState<Band>('red')
  // 回傳字串而不是陣列：selector 每次回傳新陣列會讓 zustand 以為一直在變
  const adjusted = useEditor((s) =>
    BANDS.filter((b) => PROPERTIES.some((p) => s.adjustments[keyOf(p, b)] !== DEFAULT_ADJUSTMENTS[keyOf(p, b)])).join(','),
  ).split(',')

  // 選中顏色的三條滑桿：色相、飽和度、明度
  const bandIndex = BANDS.indexOf(band)
  const sliders: SliderDef[] = PROPERTIES.map((p) => ({
    key: keyOf(p, band),
    label: t.panels.properties[p],
    track: track(p, bandIndex),
  }))

  return (
    <div>
      <div className="grid grid-cols-8 gap-1.5 px-4 pt-3" role="group" aria-label={t.panels.mixer.chooseColor}>
        {BANDS.map((b) => (
          <button
            key={b}
            type="button"
            aria-label={t.panels.mixer.bands[b]}
            aria-pressed={b === band}
            onClick={() => setBand(b)}
            className={cn(
              'relative mx-auto aspect-square w-full max-w-10 rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring',
              b === band && 'ring-2 ring-foreground',
            )}
            style={{ background: BAND_COLORS[b] }}
          >
            {/* 這個顏色調過的話，右上角點一下提醒 */}
            {adjusted.includes(b) && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-foreground" />
            )}
          </button>
        ))}
      </div>
      <SliderSection key={band} title={t.panels.mixer.bands[band]} sliders={sliders} />
    </div>
  )
}
