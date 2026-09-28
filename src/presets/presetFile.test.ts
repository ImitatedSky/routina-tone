import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useLanguage } from '@/i18n/i18n'
import { parsePresetFile, serializePreset, PresetFileError } from './presetFile'

describe('preset file', () => {
  it('round-trips adjustments', () => {
    const adj = { ...DEFAULT_ADJUSTMENTS, temp: 12, exposure: 0.35, blacks: -20 }
    const parsed = parsePresetFile(serializePreset('暖色', adj))
    expect(parsed.name).toBe('暖色')
    expect(parsed.adjustments).toEqual(adj)
  })

  it('round-trips the group and leaves it out when there is none', () => {
    const text = serializePreset('暖色', DEFAULT_ADJUSTMENTS, 'Film')
    expect(JSON.parse(text)).toMatchObject({ version: 1, group: 'Film' })
    expect(parsePresetFile(text).group).toBe('Film')

    const plain = serializePreset('暖色', DEFAULT_ADJUSTMENTS)
    expect(JSON.parse(plain)).not.toHaveProperty('group')
    expect(parsePresetFile(plain).group).toBe('')
  })

  it('trims the group, caps its length and ignores invalid values', () => {
    const file = (group: unknown) =>
      JSON.stringify({ format: 'routina-tone-preset', version: 1, name: 'x', group, adjustments: {} })
    expect(parsePresetFile(file('  Film  ')).group).toBe('Film')
    expect(parsePresetFile(file('a'.repeat(100))).group).toBe('a'.repeat(60))
    expect(parsePresetFile(file(42)).group).toBe('')
    expect(parsePresetFile(file('   ')).group).toBe('')
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

  it('reports errors in English and names untitled presets in English', () => {
    useLanguage.getState().setPref('en')
    expect(() => parsePresetFile('{"hello":1}')).toThrow('This is not a Routina Tone preset file')
    const text = JSON.stringify({ format: 'routina-tone-preset', version: 1, name: ' ', adjustments: {} })
    expect(parsePresetFile(text).name).toBe('Untitled')
  })
})
