import { TouchSlider } from '@/components/editor/TouchSlider'
import { Button } from '@/components/ui/button'
import { outputSize } from '@/engine/geometry'
import { FIXED_PALETTES, PALETTE_IDS } from '@/engine/pixel/palettes'
import { useEditor } from '@/editor/editorStore'
import { usePixelArt } from '@/editor/pixelArtStore'
import { useT } from '@/i18n/i18n'
import { DEFAULT_PIXEL_ART, DITHERS, PIXEL_RANGES, gridSize, type PixelNumberKey } from '@/photo/pixelArt'

// 像素畫工具：格數、調色盤、色數、抖色、匯出倍率
export function PixelPanel() {
  const t = useT()
  const p = t.pixel
  const photo = useEditor((s) => s.photo)
  const adj = useEditor((s) => s.adjustments)
  const settings = usePixelArt((s) => s.settings)
  const update = usePixelArt((s) => s.update)

  const image = photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 }
  const out = outputSize(adj, image)
  const grid = gridSize(settings, out.width, out.height)
  const palette = settings.palette
  const fixed = palette === 'gameboy' || palette === 'pico8' || palette === 'nes' ? FIXED_PALETTES[palette] : null

  function slider(key: PixelNumberKey, label: string, valueText: string) {
    const { min, max, step } = PIXEL_RANGES[key]
    return (
      <TouchSlider
        id={`pixel-${key}`}
        value={settings[key]}
        min={min}
        max={max}
        step={step}
        label={label}
        valueText={valueText}
        onChange={(v) => update({ [key]: v })}
        onCommit={() => {}}
        onReset={() => update({ [key]: DEFAULT_PIXEL_ART[key] })}
      />
    )
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <p className="text-xs text-muted-foreground">{p.intro}</p>

      {slider('width', p.grid, p.gridValue(grid.width, grid.height))}

      <section>
        <h3 className="mb-2 text-sm font-medium">{p.palette}</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {PALETTE_IDS.map((id) => (
            <Button
              key={id}
              variant={id === palette ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={id === palette}
              onClick={() => update({ palette: id })}
            >
              {p.palettes[id]}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{p.paletteHint[palette]}</p>
        {fixed && (
          <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
            {fixed.map(([r, g, b], i) => (
              <span key={i} className="size-4 rounded-sm border border-white/10" style={{ background: `rgb(${r} ${g} ${b})` }} />
            ))}
          </div>
        )}
      </section>

      {!fixed && slider('colors', p.colors, String(settings.colors))}

      <section>
        <h3 className="mb-2 text-sm font-medium">{p.dither}</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {DITHERS.map((id) => (
            <Button
              key={id}
              variant={id === settings.dither ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={id === settings.dither}
              onClick={() => update({ dither: id })}
            >
              {p.dithers[id]}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{p.ditherHint}</p>
      </section>

      {slider('scale', p.scale, p.scaleValue(settings.scale, grid.width * settings.scale, grid.height * settings.scale))}
    </div>
  )
}
