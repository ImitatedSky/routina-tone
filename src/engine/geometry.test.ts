import { DEFAULT_ADJUSTMENTS, applyStyle, withoutGeometry } from './adjustments'
import {
  invertAffine,
  isValidCrop,
  largestCrop,
  limitCrop,
  mapPoint,
  orientedSize,
  outputSize,
  outputToSource,
  shrinkToFit,
  sourceBounds,
} from './geometry'

const image = { width: 400, height: 200 }
const adj = (patch: Partial<typeof DEFAULT_ADJUSTMENTS>) => ({ ...DEFAULT_ADJUSTMENTS, ...patch })

function expectPoint(actual: [number, number], expected: [number, number]) {
  expect(actual[0]).toBeCloseTo(expected[0], 6)
  expect(actual[1]).toBeCloseTo(expected[1], 6)
}

describe('outputToSource', () => {
  it('is the identity with no geometry', () => {
    const m = outputToSource(DEFAULT_ADJUSTMENTS, image)
    expectPoint(mapPoint(m, 0.25, 0.75), [0.25, 0.75])
  })

  it('maps a crop to the matching part of the source', () => {
    const m = outputToSource(adj({ cropX: 0.5, cropY: 0.25, cropW: 0.5, cropH: 0.5 }), image)
    expectPoint(mapPoint(m, 0, 0), [0.5, 0.25])
    expectPoint(mapPoint(m, 1, 1), [1, 0.75])
  })

  it('rotates 90° clockwise: the output top-left comes from the source bottom-left', () => {
    const a = adj({ rotation: 1 })
    expect(orientedSize(a, image)).toEqual({ width: 200, height: 400 })
    const m = outputToSource(a, image)
    expectPoint(mapPoint(m, 0, 0), [0, 1])
    expectPoint(mapPoint(m, 1, 0), [0, 0])
  })

  it('handles 180°, 270° and horizontal flip', () => {
    expectPoint(mapPoint(outputToSource(adj({ rotation: 2 }), image), 0, 0), [1, 1])
    expectPoint(mapPoint(outputToSource(adj({ rotation: 3 }), image), 0, 0), [1, 0])
    expectPoint(mapPoint(outputToSource(adj({ flipH: 1 }), image), 0, 0), [1, 0])
  })

  it('straightens around the center', () => {
    const m = outputToSource(adj({ straighten: 30 }), image)
    expectPoint(mapPoint(m, 0.5, 0.5), [0.5, 0.5])
  })
})

describe('crop constraints', () => {
  it('reports the full frame as invalid once the photo is rotated', () => {
    const tilted = adj({ straighten: 10 })
    expect(isValidCrop({ x: 0, y: 0, w: 1, h: 1 }, DEFAULT_ADJUSTMENTS, image)).toBe(true)
    expect(isValidCrop({ x: 0, y: 0, w: 1, h: 1 }, tilted, image)).toBe(false)
  })

  it('shrinks around the center until the crop fits the rotated photo', () => {
    const tilted = adj({ straighten: 10 })
    const crop = shrinkToFit({ x: 0, y: 0, w: 1, h: 1 }, tilted, image)
    expect(isValidCrop(crop, tilted, image)).toBe(true)
    expect(crop.w).toBeLessThan(1)
    expect(crop.x + crop.w / 2).toBeCloseTo(0.5)
    // 保持長寬比
    expect(crop.w / crop.h).toBeCloseTo(1)
  })

  it('stops a drag at the edge instead of rejecting it', () => {
    const from = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }
    const moved = limitCrop(from, { x: 0.8, y: 0.2, w: 0.5, h: 0.5 }, DEFAULT_ADJUSTMENTS, image)
    expect(moved.x).toBeCloseTo(0.5, 4)
  })

  it('builds the largest centered crop for an aspect ratio', () => {
    const square = largestCrop(1, DEFAULT_ADJUSTMENTS, image)
    const size = outputSize(adj({ cropX: square.x, cropY: square.y, cropW: square.w, cropH: square.h }), image)
    expect(size).toEqual({ width: 200, height: 200 })
  })
})

describe('sourceBounds', () => {
  it('covers a rotated tile', () => {
    const m = outputToSource(adj({ straighten: 45 }), { width: 100, height: 100 })
    const b = sourceBounds(m, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    expect(b.w).toBeCloseTo(Math.SQRT2 * 0.5, 4)
  })
})

describe('presets and geometry', () => {
  it('keeps the photo geometry when applying a style', () => {
    const current = adj({ cropW: 0.5, straighten: 5, exposure: 1 })
    const style = adj({ exposure: -1, cropW: 0.3 })
    const result = applyStyle(current, style)
    expect(result.exposure).toBe(-1)
    expect(result.cropW).toBe(0.5)
    expect(result.straighten).toBe(5)
    expect(withoutGeometry(current).cropW).toBe(1)
  })
})

describe('invertAffine', () => {
  it('undoes the output-to-source mapping', () => {
    const m = outputToSource(adj({ straighten: 12, rotation: 1, flipH: 1, cropX: 0.1, cropW: 0.6 }), image)
    const inv = invertAffine(m)
    const [sx, sy] = mapPoint(m, 0.3, 0.7)
    expectPoint(mapPoint(inv, sx, sy), [0.3, 0.7])
  })
})
