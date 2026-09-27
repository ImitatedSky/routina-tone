import { FlipHorizontal2, RectangleHorizontal, RotateCcw, RotateCcwSquare, RotateCwSquare } from 'lucide-react'
import { TouchSlider } from '@/components/editor/TouchSlider'
import { Button } from '@/components/ui/button'
import { DEFAULT_ADJUSTMENTS, GEOMETRY_KEYS, type Adjustments } from '@/engine/adjustments'
import { cropOf, largestCrop, shrinkToFit, type CropRect } from '@/engine/geometry'
import { useEditor, useView } from '@/editor/editorStore'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

// 長寬比（寬 / 高）。null = 自由，'original' = 照片原本的比例
type AspectChoice = number | null | 'original'

const RATIOS: { label: string; value: number }[] = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
]

function cropPatch(crop: CropRect) {
  return { cropX: crop.x, cropY: crop.y, cropW: crop.w, cropH: crop.h }
}

export function CropPanel() {
  const t = useT()
  const text = t.editor.crop
  const photo = useEditor((s) => s.photo)
  const straighten = useEditor((s) => s.adjustments.straighten)
  const hasGeometry = useEditor((s) => GEOMETRY_KEYS.some((k) => s.adjustments[k] !== DEFAULT_ADJUSTMENTS[k]))
  const aspect = useView((s) => s.cropAspect)
  const setAspect = useView((s) => s.setCropAspect)
  const image = photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 }

  function orientedAspect(adj: Adjustments) {
    const turned = adj.rotation % 2 === 1
    return turned ? image.height / image.width : image.width / image.height
  }

  // 換長寬比、旋轉之後，裁切框改成置中、這個比例下最大的
  function applyGeometry(patch: Partial<Adjustments>, choice: AspectChoice) {
    const { adjustments, apply } = useEditor.getState()
    const next = { ...adjustments, ...patch }
    const ratio = choice === 'original' ? orientedAspect(next) : choice
    apply({ ...next, ...cropPatch(largestCrop(ratio, next, image)) })
  }

  function chooseAspect(choice: AspectChoice) {
    const ratio = choice === 'original' ? orientedAspect(useEditor.getState().adjustments) : choice
    setAspect(ratio)
    if (choice !== null) applyGeometry({}, choice)
  }

  function swapOrientation() {
    if (!aspect || aspect === 1) return
    setAspect(1 / aspect)
    applyGeometry({}, 1 / aspect)
  }

  function rotate(direction: 1 | -1) {
    const { adjustments } = useEditor.getState()
    const rotation = (adjustments.rotation + direction + 4) % 4
    // 轉 90° 之後直橫對調，鎖定的比例也跟著倒過來
    const nextAspect = aspect ? 1 / aspect : null
    setAspect(nextAspect)
    applyGeometry({ rotation }, nextAspect)
  }

  // 拉直時裁切框以中心縮到還在照片上，和 Lightroom 一樣
  function changeStraighten(value: number) {
    const { adjustments, setAdjustments } = useEditor.getState()
    const next = { ...adjustments, straighten: value }
    setAdjustments({ straighten: value, ...cropPatch(shrinkToFit(cropOf(next), next, image)) })
  }

  function reset() {
    const { adjustments, apply } = useEditor.getState()
    const next = { ...adjustments }
    for (const key of GEOMETRY_KEYS) next[key] = DEFAULT_ADJUSTMENTS[key]
    setAspect(null)
    apply(next)
  }

  const choices: { label: string; value: AspectChoice; active: boolean }[] = [
    { label: text.free, value: null, active: aspect === null },
    { label: text.original, value: 'original', active: false },
    ...RATIOS.map((r) => ({
      label: r.label,
      value: r.value,
      active: aspect !== null && (Math.abs(aspect - r.value) < 1e-6 || Math.abs(aspect - 1 / r.value) < 1e-6),
    })),
  ]

  return (
    <div className="space-y-4 px-4 py-3">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">{text.aspect}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text.swapOrientation}
            disabled={!aspect || aspect === 1}
            onClick={swapOrientation}
          >
            <RectangleHorizontal className={cn(aspect !== null && aspect < 1 && 'rotate-90')} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {choices.map((c) => (
            <Button
              key={c.label}
              variant={c.active ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={c.active}
              onClick={() => chooseAspect(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">{text.angle}</h2>
        <TouchSlider
          id="adj-straighten"
          value={straighten}
          min={-45}
          max={45}
          step={0.1}
          label={text.straighten}
          valueText={`${straighten > 0 ? '+' : ''}${straighten.toFixed(1)}°`}
          track="linear-gradient(to right, oklch(1 0 0 / 18%), oklch(1 0 0 / 18%))"
          onChange={changeStraighten}
          onCommit={() => useEditor.getState().commit()}
          onReset={() => {
            changeStraighten(0)
            useEditor.getState().commit()
          }}
        />
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" aria-label={text.rotateLeft} title={text.rotateLeft} onClick={() => rotate(-1)}>
            <RotateCcwSquare />
          </Button>
          <Button variant="outline" size="sm" aria-label={text.rotateRight} title={text.rotateRight} onClick={() => rotate(1)}>
            <RotateCwSquare />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={text.flip}
            title={text.flip}
            onClick={() => {
              const { adjustments, apply } = useEditor.getState()
              // 翻轉是整個畫面鏡射：裁切框跟著鏡射、拉直角度也要反過來，框住的內容才會剛好是鏡像
              apply({
                ...adjustments,
                flipH: adjustments.flipH ? 0 : 1,
                straighten: -adjustments.straighten,
                cropX: 1 - adjustments.cropX - adjustments.cropW,
              })
            }}
          >
            <FlipHorizontal2 />
          </Button>
        </div>
      </section>

      <Button variant="ghost" size="sm" className="w-full" disabled={!hasGeometry} onClick={reset}>
        <RotateCcw />
        {text.reset}
      </Button>
    </div>
  )
}
