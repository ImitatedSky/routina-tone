import { diffFromDefaults, normalizeAdjustments, type Adjustments, type AdjustmentsPatch } from '@/engine/adjustments'
import { t } from '@/i18n/i18n'

export const PRESET_FORMAT = 'routina-tone-preset'
export const PRESET_VERSION = 1
export const PRESET_EXTENSION = '.tone.json'
export const MAX_GROUP_LENGTH = 60

// 匯出檔的內容。adjustments 只存和預設值不同的欄位。
export interface PresetFile {
  format: typeof PRESET_FORMAT
  version: number
  name: string
  // 後來加的欄位，沒有分組就不寫；舊版 App 讀到會直接忽略
  group?: string
  adjustments: AdjustmentsPatch
}

export class PresetFileError extends Error {}

// 群組名稱：去掉前後空白、限制長度，不是字串就當作沒有分組
export function normalizeGroup(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_GROUP_LENGTH).trim() : ''
}

export function toPresetFile(name: string, adj: Adjustments, group = ''): PresetFile {
  return {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    name,
    ...(group ? { group } : {}),
    adjustments: diffFromDefaults(adj),
  }
}

export function serializePreset(name: string, adj: Adjustments, group = ''): string {
  return JSON.stringify(toPresetFile(name, adj, group), null, 2) + '\n'
}

export function parsePresetFile(text: string): { name: string; group: string; adjustments: Adjustments } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new PresetFileError(t().presets.invalidJson)
  }
  if (typeof data !== 'object' || data === null || (data as PresetFile).format !== PRESET_FORMAT) {
    throw new PresetFileError(t().presets.notPresetFile)
  }
  const file = data as PresetFile
  if (typeof file.version !== 'number' || file.version > PRESET_VERSION) {
    throw new PresetFileError(t().presets.newerVersion)
  }
  const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : t().presets.untitled
  return { name, group: normalizeGroup(file.group), adjustments: normalizeAdjustments(file.adjustments) }
}
