import { DEFAULT_ADJUSTMENTS, applyStyle, normalizeAdjustments, withoutGeometry } from './adjustments'
import { MAX_MASKS, createMask, maskUniforms, normalizeMasks } from './masks'

describe('normalizeMasks', () => {
  it('drops unknown types, clamps values and caps the count', () => {
    const raw = [
      { type: 'linear', x0: 0.1, adjust: { exposure: 9, bogus: 3 } },
      { type: 'lasso' },
      ...Array.from({ length: 12 }, () => ({ type: 'radial', feather: 500 })),
    ]
    const masks = normalizeMasks(raw)
    expect(masks).toHaveLength(MAX_MASKS)
    expect(masks[0].type).toBe('linear')
    expect(masks[0].x0).toBe(0.1)
    expect(masks[0].adjust.exposure).toBe(4)
    expect('bogus' in masks[0].adjust).toBe(false)
    expect(masks[1].feather).toBe(100)
  })

  it('round-trips through normalizeAdjustments', () => {
    const mask = { ...createMask('radial', 'm1'), cx: 0.3, adjust: { ...createMask('radial').adjust, exposure: 1 } }
    const adj = normalizeAdjustments({ masks: [mask] })
    expect(adj.masks).toEqual([mask])
  })
})

describe('maskUniforms', () => {
  it('packs shape, type and local adjustments', () => {
    const linear = { ...createMask('linear'), adjust: { ...createMask('linear').adjust, contrast: 50 } }
    const radial = { ...createMask('radial'), invert: true, feather: 20 }
    const u = maskUniforms([linear, radial])
    expect(u.count).toBe(2)
    expect(Array.from(u.shape.slice(0, 4))).toEqual([0.5, 0.15, 0.5, 0.5].map(Math.fround))
    // 第 4 個數字是筆刷貼圖的層，等於遮罩的位置
    expect(Array.from(u.info.slice(4, 8))).toEqual([1, 0.2, 1, 1].map(Math.fround))
    expect(u.a[1]).toBeCloseTo(0.5)
    // 沒用到的格子是單位矩陣
    expect(Array.from(u.whiteBalance.slice(18, 27))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})

describe('brush masks', () => {
  it('keeps valid strokes and drops broken ones', () => {
    const [mask] = normalizeMasks([
      {
        type: 'brush',
        strokes: [
          { points: [0.1, 0.2, 0.3, 0.4], size: 0.1, feather: 30, erase: true },
          { points: [0.5] },
          { points: 'nope' },
          { points: [0.2, 0.2], size: 99 },
        ],
      },
    ])
    expect(mask.strokes).toEqual([
      { points: [0.1, 0.2, 0.3, 0.4], size: 0.1, feather: 30, erase: true },
      { points: [0.2, 0.2], size: 1, feather: 50, erase: false },
    ])
  })

  it('marks brush masks as type 2', () => {
    const u = maskUniforms([createMask('brush')])
    expect(u.info[0]).toBe(2)
  })
})

describe('presets and masks', () => {
  it('never saves masks into a preset and keeps the photo masks when applying one', () => {
    const current = { ...DEFAULT_ADJUSTMENTS, masks: [createMask('radial')] }
    expect(withoutGeometry(current).masks).toEqual([])
    const styled = applyStyle(current, { ...DEFAULT_ADJUSTMENTS, exposure: 1 })
    expect(styled.masks).toBe(current.masks)
    expect(styled.exposure).toBe(1)
  })
})
