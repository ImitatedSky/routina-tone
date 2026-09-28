import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeAdjustments, diffFromDefaults, type Adjustments, type AdjustmentsPatch } from '@/engine/adjustments'

export interface Preset {
  id: string
  name: string
  // '' 表示沒有分組
  group: string
  adjustments: Adjustments
  createdAt: number
}

// 目前正在編輯的照片，重新整理或關掉 App 再開都還在
export interface Session {
  photo: Blob
  photoName: string
  adjustments: Adjustments
}

// 參數一律存成「和預設值的差異」，讀出來再補預設值，之後新增參數時舊資料照樣能用
// group 是後來加的欄位，舊資料沒有，讀出來當成 ''
interface StoredPreset {
  id: string
  name: string
  group?: string
  adjustments: AdjustmentsPatch
  createdAt: number
}

interface StoredPhoto {
  photo: Blob
  photoName: string
}

// 照片和參數分開存：拖一次滑桿只要寫參數，不用每次都重寫整張照片
interface ToneDB extends DBSchema {
  presets: { key: string; value: StoredPreset }
  session: { key: 'photo' | 'adjustments'; value: StoredPhoto | AdjustmentsPatch }
}

let dbPromise: Promise<IDBPDatabase<ToneDB>> | null = null

function db() {
  dbPromise ??= openDB<ToneDB>('routina-tone', 1, {
    upgrade(database) {
      database.createObjectStore('presets', { keyPath: 'id' })
      database.createObjectStore('session')
    },
  })
  return dbPromise
}

export async function listPresets(): Promise<Preset[]> {
  const rows = await (await db()).getAll('presets')
  return rows
    .map((row) => ({
      ...row,
      group: typeof row.group === 'string' ? row.group : '',
      adjustments: normalizeAdjustments(row.adjustments),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function addPreset(name: string, adjustments: Adjustments, group = ''): Promise<Preset> {
  const preset: Preset = { id: crypto.randomUUID(), name, group, adjustments, createdAt: Date.now() }
  await putPreset(preset)
  return preset
}

// 也用來復原剛刪掉的預設集（保留原本的 id 與建立時間）
export async function putPreset(preset: Preset): Promise<void> {
  await (await db()).put('presets', { ...preset, adjustments: diffFromDefaults(preset.adjustments) })
}

export async function updatePreset(id: string, changes: { name?: string; group?: string }): Promise<void> {
  const tx = (await db()).transaction('presets', 'readwrite')
  const row = await tx.store.get(id)
  if (row) await tx.store.put({ ...row, ...changes })
  await tx.done
}

export async function deletePreset(id: string): Promise<void> {
  await (await db()).delete('presets', id)
}

export async function loadSession(): Promise<Session | null> {
  const database = await db()
  const photo = (await database.get('session', 'photo')) as StoredPhoto | undefined
  if (!photo) return null
  const adjustments = await database.get('session', 'adjustments')
  return { ...photo, adjustments: normalizeAdjustments(adjustments) }
}

export async function saveSessionPhoto(photo: Blob, photoName: string): Promise<void> {
  await (await db()).put('session', { photo, photoName }, 'photo')
}

export async function saveSessionAdjustments(adjustments: Adjustments): Promise<void> {
  await (await db()).put('session', diffFromDefaults(adjustments), 'adjustments')
}
