import { create } from 'zustand'
import { normalizePixelArt, type PixelArtSettings } from '@/photo/pixelArt'

// 像素畫的設定。和調色參數分開、不進 undo 歷史，記住上次用的值
const STORAGE_KEY = 'tone-pixel-art'

function load(): PixelArtSettings {
  try {
    return normalizePixelArt(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return normalizePixelArt(null)
  }
}

interface PixelArtState {
  settings: PixelArtSettings
  update: (patch: Partial<PixelArtSettings>) => void
}

export const usePixelArt = create<PixelArtState>((set, get) => ({
  settings: load(),
  update: (patch) => {
    const settings = normalizePixelArt({ ...get().settings, ...patch })
    set({ settings })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // 存不了就只在這次開啟有效
    }
  },
}))
