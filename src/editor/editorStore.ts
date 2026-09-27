import { create } from 'zustand'
import {
  DEFAULT_ADJUSTMENTS,
  clampAdjustment,
  sameAdjustments,
  type AdjustmentKey,
  type Adjustments,
} from '@/engine/adjustments'

export interface Photo {
  file: Blob
  name: string
  preview: ImageBitmap
}

const HISTORY_LIMIT = 100

interface EditorState {
  photo: Photo | null
  // 畫面上正在顯示的值（拖曳滑桿時每一格都會變）
  adjustments: Adjustments
  // 最後一次提交的值；拖曳放開才提交，所以一次拖曳只算一步 undo
  committed: Adjustments
  past: Adjustments[]
  future: Adjustments[]

  openPhoto: (photo: Photo, adjustments?: Adjustments) => void
  setAdjustment: (key: AdjustmentKey, value: number) => void
  commit: () => void
  apply: (adjustments: Adjustments) => void
  undo: () => void
  redo: () => void
}

export const useEditor = create<EditorState>((set, get) => ({
  photo: null,
  adjustments: DEFAULT_ADJUSTMENTS,
  committed: DEFAULT_ADJUSTMENTS,
  past: [],
  future: [],

  openPhoto: (photo, adjustments = DEFAULT_ADJUSTMENTS) => {
    get().photo?.preview.close()
    set({ photo, adjustments, committed: adjustments, past: [], future: [] })
  },

  setAdjustment: (key, value) => {
    set((s) => ({ adjustments: { ...s.adjustments, [key]: clampAdjustment(key, value) } }))
  },

  commit: () => {
    const { adjustments, committed, past } = get()
    if (sameAdjustments(adjustments, committed)) return
    set({ committed: adjustments, past: [...past, committed].slice(-HISTORY_LIMIT), future: [] })
  },

  apply: (adjustments) => {
    set({ adjustments })
    get().commit()
  },

  undo: () => {
    get().commit()
    const { past, committed, future } = get()
    const previous = past.at(-1)
    if (!previous) return
    set({ adjustments: previous, committed: previous, past: past.slice(0, -1), future: [committed, ...future] })
  },

  redo: () => {
    const { past, committed, future } = get()
    const [next, ...rest] = future
    if (!next) return
    set({ adjustments: next, committed: next, past: [...past, committed], future: rest })
  },
}))

// 按住比較時顯示原圖；只是畫面狀態，不進 undo 歷史
interface ViewState {
  showOriginal: boolean
  setShowOriginal: (value: boolean) => void
}

export const useView = create<ViewState>((set) => ({
  showOriginal: false,
  setShowOriginal: (showOriginal) => set({ showOriginal }),
}))
