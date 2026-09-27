import { diffFromDefaults, normalizeAdjustments, type Adjustments, type AdjustmentsPatch } from '@/engine/adjustments'

export const PRESET_FORMAT = 'routina-tone-preset'
export const PRESET_VERSION = 1
export const PRESET_EXTENSION = '.tone.json'

// 匯出檔的內容。adjustments 只存和預設值不同的欄位。
export interface PresetFile {
  format: typeof PRESET_FORMAT
  version: number
  name: string
  adjustments: AdjustmentsPatch
}

export class PresetFileError extends Error {}

export function toPresetFile(name: string, adj: Adjustments): PresetFile {
  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name,
    adjustments: diffFromDefaults(adj),
  }
}

export function serializePreset(name: string, adj: Adjustments): string {
  return JSON.stringify(toPresetFile(name, adj), null, 2) + '\n'
}

export function parsePresetFile(text: string): { name: string; adjustments: Adjustments } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new PresetFileError('檔案不是有效的 JSON')
  }
  if (typeof data !== 'object' || data === null || (data as PresetFile).format !== PRESET_FORMAT) {
    throw new PresetFileError('這不是 Routina Tone 的預設集檔案')
  }
  const file = data as PresetFile
  if (typeof file.version !== 'number' || file.version > PRESET_VERSION) {
    throw new PresetFileError('這個預設集來自較新版本的 Routina Tone，請先更新 App')
  }
  const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : '未命名'
  return { name, adjustments: normalizeAdjustments(file.adjustments) }
}
