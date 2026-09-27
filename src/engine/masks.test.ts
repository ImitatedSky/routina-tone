import { DEFAULT_ADJUSTMENTS, applyStyle, normalizeAdjustments, withoutGeometry } from './adjustments'
import { MAX_MASKS, createMask, maskUniforms, normalizeMasks } from './masks'

describe('normalizeMasks', () => {
  it('drops unknown types, clamps values and caps the count', () => {
    const raw = [
      { type: 'linear', x0: 0.1, adjust: { exposure: 9, bogus: 3 } },
      { type: 'brush' },
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
    expect(Array.from(u.info.slice(4, 8))).toEqual([1, 0.2, 1, 0].map(Math.fround))
    expect(u.a[1]).toBeCloseTo(0.5)
    // 沒用到的格子是單位矩陣
    expect(Array.from(u.whiteBalance.slice(18, 27))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
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
