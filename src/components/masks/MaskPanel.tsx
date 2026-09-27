import { Brush, Circle, Eraser, RotateCcw, Trash2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TouchSlider } from '@/components/editor/TouchSlider'
import { PRESENCE_SLIDERS, WHITE_BALANCE_SLIDERS } from '@/components/editor/sliders'
import { LOCAL_KEYS, LOCAL_RANGES, MAX_MASKS, type LocalKey, type Mask, type MaskType } from '@/engine/masks'
import { useEditor, useView } from '@/editor/editorStore'
import { useT, type Messages } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

const GROUPS: { title: keyof Messages['masks']['groups']; keys: LocalKey[] }[] = [
  { title: 'light', keys: ['exposure', 'contrast', 'highlights', 'shadows'] },
  { title: 'color', keys: ['temp', 'tint', 'saturation'] },
  { title: 'effects', keys: ['clarity', 'texture', 'dehaze'] },
]

// 色溫、色調、飽和度沿用整體滑桿的軌道顏色
const TRACKS: Partial<Record<string, string>> = Object.fromEntries(
  [...WHITE_BALANCE_SLIDERS, ...PRESENCE_SLIDERS].map((s) => [s.key, s.track]),
)

function formatValue(key: LocalKey, value: number) {
  const text = value.toFixed(key === 'exposure' ? 2 : 0)
  return value > 0 ? `+${text}` : text
}

function maskName(t: Messages, mask: Mask, index: number) {
  return t.masks.name[mask.type](index + 1)
}

// 局部調整分頁：新增 / 選取 / 刪除遮罩，調整選取遮罩的數值
export function MaskPanel() {
  const t = useT()
  const masks = useEditor((s) => s.adjustments.masks)
  const selectedId = useView((s) => s.selectedMask)
  const showMask = useView((s) => s.showMask)

  const selectedIndex = masks.findIndex((m) => m.id === selectedId)
  const selected = selectedIndex >= 0 ? masks[selectedIndex] : null
  const isFull = masks.length >= MAX_MASKS

  function add(type: MaskType) {
    const id = useEditor.getState().addMask(type)
    if (id) useView.getState().selectMask(id)
  }

  function remove(id: string) {
    const index = masks.findIndex((m) => m.id === id)
    useEditor.getState().removeMask(id)
    if (id !== selectedId) return
    // 刪掉選取中的遮罩：改選同位置的下一個，沒有就選前一個
    const rest = masks.filter((m) => m.id !== id)
    useView.getState().selectMask(rest[Math.min(index, rest.length - 1)]?.id ?? null)
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex flex-col gap-2 px-4">
        <Button variant="outline" size="sm" disabled={isFull} onClick={() => add('linear')}>
          <TrendingUp />
          {t.masks.addLinear}
        </Button>
        <Button variant="outline" size="sm" disabled={isFull} onClick={() => add('radial')}>
          <Circle />
          {t.masks.addRadial}
        </Button>
        <Button variant="outline" size="sm" disabled={isFull} onClick={() => add('brush')}>
          <Brush />
          {t.masks.addBrush}
        </Button>
        {isFull && <p className="text-xs text-muted-foreground">{t.masks.full(MAX_MASKS)}</p>}
      </div>

      {masks.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground">{t.masks.empty}</p>
      ) : (
        <>
          <ul aria-label={t.masks.list} className="flex flex-col gap-1 px-4">
            {masks.map((mask, i) => {
              const name = maskName(t, mask, i)
              const isSelected = mask.id === selectedId
              return (
                <li
                  key={mask.id}
                  className={cn(
                    'flex items-center gap-1 rounded-lg pr-1',
                    isSelected ? 'bg-primary/15 ring-1 ring-primary/50' : 'hover:bg-muted/50',
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className="flex h-8 flex-1 items-center gap-2 rounded-lg px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60 pointer-coarse:h-10"
                    onClick={() => useView.getState().selectMask(mask.id)}
                  >
                    {mask.type === 'linear' ? (
                      <TrendingUp className="size-4" />
                    ) : mask.type === 'radial' ? (
                      <Circle className="size-4" />
                    ) : (
                      <Brush className="size-4" />
                    )}
                    {name}
                  </button>
                  <Button variant="ghost" size="icon-sm" aria-label={t.masks.deleteMask(name)} onClick={() => remove(mask.id)}>
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>

          <div className="px-4">
            <Toggle label={t.masks.showOverlay} pressed={showMask} onChange={(v) => useView.getState().setShowMask(v)} />
          </div>

          {selected ? (
            <MaskEditor key={selected.id} mask={selected} name={maskName(t, selected, selectedIndex)} />
          ) : (
            <p className="px-4 text-sm text-muted-foreground">{t.masks.selectHint}</p>
          )}
        </>
      )}
    </div>
  )
}

function MaskEditor({ mask, name }: { mask: Mask; name: string }) {
  const t = useT()
  const updateMask = useEditor((s) => s.updateMask)
  const commit = useEditor((s) => s.commit)
  const isChanged = LOCAL_KEYS.some((k) => mask.adjust[k] !== 0)

  function setAdjust(key: LocalKey, value: number) {
    updateMask(mask.id, { adjust: { [key]: value } as Record<LocalKey, number> })
  }

  function resetAll() {
    const zero = Object.fromEntries(LOCAL_KEYS.map((k) => [k, 0])) as Record<LocalKey, number>
    updateMask(mask.id, { adjust: zero })
    commit()
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-2 px-4">
        <div>
          <h2 className="text-sm font-medium">{name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.masks.moveHint[mask.type]}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t.masks.resetAdjust(name)} disabled={!isChanged} onClick={resetAll}>
          <RotateCcw />
        </Button>
      </div>

      {mask.type === 'brush' && <BrushControls mask={mask} />}

      {mask.type === 'radial' && (
        <section className="px-4 py-2">
          <TouchSlider
            id="mask-feather"
            value={mask.feather}
            min={0}
            max={100}
            step={1}
            label={t.masks.feather}
            valueText={String(mask.feather)}
            onChange={(v) => updateMask(mask.id, { feather: v })}
            onCommit={commit}
            onReset={() => {
              updateMask(mask.id, { feather: 50 })
              commit()
            }}
          />
          <Toggle
            label={t.masks.invert}
            pressed={mask.invert}
            onChange={(v) => {
              updateMask(mask.id, { invert: v })
              commit()
            }}
          />
        </section>
      )}

      {GROUPS.map((group) => (
        <section key={group.title} className="px-4 py-2">
          <h3 className="text-sm font-medium">{t.masks.groups[group.title]}</h3>
          {group.keys.map((key) => {
            const { min, max, step } = LOCAL_RANGES[key]
            return (
              <TouchSlider
                key={key}
                id={`mask-${key}`}
                value={mask.adjust[key]}
                min={min}
                max={max}
                step={step}
                label={t.editor.adj[key]}
                valueText={formatValue(key, mask.adjust[key])}
                track={TRACKS[key]}
                onChange={(v) => setAdjust(key, v)}
                onCommit={commit}
                onReset={() => {
                  setAdjust(key, 0)
                  commit()
                }}
              />
            )
          })}
        </section>
      ))}
    </div>
  )
}

// 開關樣式的按鈕
// 筆刷工具的大小、羽化、橡皮擦（是工具設定，不是遮罩本身的資料），加上清除畫過的範圍
function BrushControls({ mask }: { mask: Mask }) {
  const t = useT()
  const size = useView((s) => s.brushSize)
  const feather = useView((s) => s.brushFeather)
  const erase = useView((s) => s.brushErase)
  const setBrush = useView((s) => s.setBrush)
  const percent = Math.round(size * 100)

  return (
    <section className="px-4 py-2">
      <h3 className="text-sm font-medium">{t.masks.brush.title}</h3>
      <TouchSlider
        id="brush-size"
        value={percent}
        min={1}
        max={50}
        step={1}
        label={t.masks.brush.size}
        valueText={`${percent}%`}
        onChange={(v) => setBrush({ brushSize: v / 100 })}
        onCommit={() => {}}
        onReset={() => setBrush({ brushSize: 0.08 })}
      />
      <TouchSlider
        id="brush-feather"
        value={feather}
        min={0}
        max={100}
        step={1}
        label={t.masks.brush.feather}
        valueText={String(feather)}
        onChange={(v) => setBrush({ brushFeather: v })}
        onCommit={() => {}}
        onReset={() => setBrush({ brushFeather: 50 })}
      />
      <div className="mt-1 flex items-center gap-2">
        <Button
          variant={erase ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={erase}
          className="flex-1"
          onClick={() => setBrush({ brushErase: !erase })}
        >
          <Eraser />
          {t.masks.brush.erase}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={mask.strokes.length === 0}
          onClick={() => {
            useEditor.getState().updateMask(mask.id, { strokes: [] })
            useEditor.getState().commit()
          }}
        >
          {t.masks.brush.clear}
        </Button>
      </div>
    </section>
  )
}

function Toggle({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className="flex h-8 w-full items-center justify-between rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60 pointer-coarse:h-10"
      onClick={() => onChange(!pressed)}
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          pressed ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow transition-transform',
            pressed && 'translate-x-4',
          )}
        />
      </span>
    </button>
  )
}
