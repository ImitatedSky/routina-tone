import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { normalizeAdjustments, diffFromDefaults, type Adjustments, type AdjustmentsPatch } from '@/engine/adjustments'

export interface Preset {
  id: string
  name: string
  // '' 表示沒有分組
  group: string
  // 標為常用，會另外列在最上面
  favorite: boolean
  // 排序用，越小越前面。每個區段（常用、各群組、未分組）各自依這個值排
  order: number
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
// group、favorite、order 是後來加的欄位，舊資料沒有：group 當成 ''、favorite 當成 false，
// order 用 -createdAt，舊的預設集維持原本「新的在前面」的順序
interface StoredPreset {
  id: string
  name: string
  group?: string
  favorite?: boolean
  order?: number
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
  // 群組的順序（名稱陣列）等小設定
  meta: { key: 'groupOrder'; value: string[] }
}

let dbPromise: Promise<IDBPDatabase<ToneDB>> | null = null

function db() {
  // 版本 2 只新增 meta，不動既有資料
  dbPromise ??= openDB<ToneDB>('routina-tone', 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('presets', { keyPath: 'id' })
        database.createObjectStore('session')
      }
      if (oldVersion < 2) database.createObjectStore('meta')
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
      favorite: row.favorite === true,
      order: typeof row.order === 'number' && Number.isFinite(row.order) ? row.order : -row.createdAt,
      adjustments: normalizeAdjustments(row.adjustments),
    }))
    .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt)
}

// 新的預設集排在最前面
export async function addPreset(name: string, adjustments: Adjustments, group = ''): Promise<Preset> {
  const existing = await listPresets()
  const first = existing.length > 0 ? existing[0].order : 0
  const preset: Preset = {
    id: crypto.randomUUID(),
    name,
    group,
    favorite: false,
    order: first - 1,
    adjustments,
    createdAt: Date.now(),
  }
  await putPreset(preset)
  return preset
}

// 也用來復原剛刪掉的預設集（保留原本的 id 與建立時間）
export async function putPreset(preset: Preset): Promise<void> {
  await (await db()).put('presets', { ...preset, adjustments: diffFromDefaults(preset.adjustments) })
}

export async function updatePreset(
  id: string,
  changes: { name?: string; group?: string; favorite?: boolean; order?: number },
): Promise<void> {
  const tx = (await db()).transaction('presets', 'readwrite')
  const row = await tx.store.get(id)
  if (row) await tx.store.put({ ...row, ...changes })
  await tx.done
}

// 一次寫入多個預設集的新順序（調整順序時用）
export async function setPresetOrders(orders: { id: string; order: number }[]): Promise<void> {
  const tx = (await db()).transaction('presets', 'readwrite')
  for (const { id, order } of orders) {
    const row = await tx.store.get(id)
    if (row) await tx.store.put({ ...row, order })
  }
  await tx.done
}

export async function loadGroupOrder(): Promise<string[]> {
  const value = await (await db()).get('meta', 'groupOrder')
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
}

export async function saveGroupOrder(order: string[]): Promise<void> {
  await (await db()).put('meta', order, 'groupOrder')
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
