import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SliderSection, type SliderDef } from '@/components/editor/SliderSection'
import { BANDS, type Band, type ScalarKey } from '@/engine/adjustments'

type Property = 'hue' | 'sat' | 'lum'

const PROPERTIES: { value: Property; label: string }[] = [
  { value: 'hue', label: '色相' },
  { value: 'sat', label: '飽和度' },
  { value: 'lum', label: '明度' },
]

const BAND_LABELS: Record<Band, string> = {
  red: '紅色',
  orange: '橙色',
  yellow: '黃色',
  green: '綠色',
  aqua: '水綠色',
  blue: '藍色',
  purple: '紫色',
  magenta: '洋紅色',
}

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

function slidersFor(property: Property): SliderDef[] {
  return BANDS.map((band, i) => ({
    key: (property + band[0].toUpperCase() + band.slice(1)) as ScalarKey,
    label: BAND_LABELS[band],
    track: track(property, i),
  }))
}

const SLIDERS: Record<Property, SliderDef[]> = {
  hue: slidersFor('hue'),
  sat: slidersFor('sat'),
  lum: slidersFor('lum'),
}

// Lightroom 的混色器（HSL 模式）：一次顯示一種屬性的 8 個色帶
export function MixerPanel() {
  const [property, setProperty] = useState<Property>('hue')
  const label = PROPERTIES.find((p) => p.value === property)!.label

  return (
    <div>
      <Tabs value={property} onValueChange={(v) => setProperty(v as Property)} className="px-4 pt-2">
        <TabsList className="w-full">
          {PROPERTIES.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SliderSection key={property} title={label} sliders={SLIDERS[property]} />
    </div>
  )
}
