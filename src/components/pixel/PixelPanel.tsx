import { TouchSlider } from '@/components/editor/TouchSlider'
import { Button } from '@/components/ui/button'
import { ADJUSTMENT_RANGES, type ScalarKey } from '@/engine/adjustments'
import { outputSize } from '@/engine/geometry'
import { FIXED_PALETTES, PALETTE_IDS } from '@/engine/pixel/palettes'
import { useEditor } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { gridSize } from '@/photo/pixelArt'

const DITHERS = ['none', 'ordered', 'diffusion'] as const

// 像素畫分頁：開關、格數、調色盤、色數、抖色、匯出倍率
export function PixelPanel() {
  const t = useT()
  const p = t.pixel
  const photo = useEditor((s) => s.photo)
  const adj = useEditor((s) => s.adjustments)
  const setAdjustment = useEditor((s) => s.setAdjustment)
  const commit = useEditor((s) => s.commit)

  const image = photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 }
  const out = outputSize(adj, image)
  const grid = gridSize(adj, out.width, out.height)
  const paletteId = PALETTE_IDS[adj.pixelPalette] ?? 'auto'
  const fixed = paletteId === 'gameboy' || paletteId === 'pico8' || paletteId === 'nes' ? FIXED_PALETTES[paletteId] : null

  function set(key: ScalarKey, value: number) {
    setAdjustment(key, value)
    commit()
  }

  function slider(key: ScalarKey, label: string, valueText: string) {
    const { min, max, step } = ADJUSTMENT_RANGES[key]
    return (
      <TouchSlider
        id={`pixel-${key}`}
        value={adj[key]}
        min={min}
        max={max}
        step={step}
        label={label}
        valueText={valueText}
        onChange={(v) => setAdjustment(key, v)}
        onCommit={commit}
      />
    )
  }

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{p.enable}</span>
        <button
          type="button"
          role="switch"
          aria-checked={adj.pixelOn === 1}
          aria-label={p.enable}
          onClick={() => set('pixelOn', adj.pixelOn ? 0 : 1)}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            adj.pixelOn ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-5 rounded-full bg-foreground transition-transform',
              adj.pixelOn && 'translate-x-5 bg-primary-foreground',
            )}
          />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{p.intro}</p>

      {adj.pixelOn === 1 && (
        <div className="space-y-4">
          {slider('pixelWidth', p.grid, p.gridValue(grid.width, grid.height))}

          <section>
            <h3 className="mb-2 text-sm font-medium">{p.palette}</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {PALETTE_IDS.map((id, index) => (
                <Button
                  key={id}
                  variant={index === adj.pixelPalette ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={index === adj.pixelPalette}
                  onClick={() => set('pixelPalette', index)}
                >
                  {p.palettes[id]}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{p.paletteHint[paletteId]}</p>
            {fixed && (
              <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
                {fixed.map(([r, g, b], i) => (
                  <span key={i} className="size-4 rounded-sm border border-white/10" style={{ background: `rgb(${r} ${g} ${b})` }} />
                ))}
              </div>
            )}
          </section>

          {!fixed && slider('pixelColors', p.colors, String(adj.pixelColors))}

          <section>
            <h3 className="mb-2 text-sm font-medium">{p.dither}</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {DITHERS.map((id, index) => (
                <Button
                  key={id}
                  variant={index === adj.pixelDither ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={index === adj.pixelDither}
                  onClick={() => set('pixelDither', index)}
                >
                  {p.dithers[id]}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{p.ditherHint}</p>
          </section>

          {slider(
            'pixelScale',
            p.scale,
            p.scaleValue(adj.pixelScale, grid.width * adj.pixelScale, grid.height * adj.pixelScale),
          )}
        </div>
      )}
    </div>
  )
}
