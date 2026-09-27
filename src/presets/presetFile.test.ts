import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { parsePresetFile, serializePreset, PresetFileError } from './presetFile'

describe('preset file', () => {
  it('round-trips adjustments', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, temp: 12, exposure: 0.35, blacks: -20 }
    const parsed = parsePresetFile(serializePreset('暖色', adj))
    expect(parsed.name).toBe('暖色')
    expect(parsed.adjustments).toEqual(adj)
  })

  it('stores only values that differ from the defaults', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, contrast: 30 }
    expect(JSON.parse(serializePreset('x', adj)).adjustments).toEqual({ contrast: 30 })
  })

  it('fills missing fields, drops unknown ones and clamps out-of-range values', () => {
    const text = JSON.stringify({
      format: 'routina-tone-preset',
      version: 1,
      name: 'x',
      adjustments: { exposure: 9, saturation: 'a lot', futureThing: 5 },
    })
    const { adjustments } = parsePresetFile(text)
    expect(adjustments).toEqual({ ...DEFAULT_ADJUSTMENTS, exposure: 5 })
  })

  it('rejects files that are not presets', () => {
    expect(() => parsePresetFile('not json')).toThrow(PresetFileError)
    expect(() => parsePresetFile('{"hello":1}')).toThrow('不是 Routina Tone')
  })

  it('rejects presets from a newer version', () => {
    const text = JSON.stringify({ format: 'routina-tone-preset', version: 99, name: 'x', adjustments: {} })
    expect(() => parsePresetFile(text)).toThrow('較新版本')
  })
})
