import { create } from 'zustand'
import {
  DEFAULT_ADJUSTMENTS,
  clampAdjustment,
  normalizeCurvePoints,
  sameAdjustments,
  type Adjustments,
  type CurveChannel,
  type CurvePoint,
  type ScalarKey,
} from '@/engine/adjustments'
import { MAX_MASKS, createMask, type Mask, type MaskType } from '@/engine/masks'
import type { Histogram } from '@/engine/renderer'

export interface Photo {
  file: Blob
  name: string
  preview: ImageBitmap
  // 原圖（轉正後）的尺寸
  width: number
  height: number
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
  setAdjustment: (key: ScalarKey, value: number) => void
  // 一次改多個數值（例如裁切框的四個邊），拖曳中即時更新，放開後一樣呼叫 commit()
  setAdjustments: (values: Partial<Record<ScalarKey, number>>) => void
  // 點曲線即時更新（拖曳中），放開後一樣呼叫 commit()
  setCurve: (channel: CurveChannel, points: CurvePoint[]) => void
  // 局部遮罩。add / remove 直接提交；update 是拖曳中的即時更新，放開後呼叫 commit()
  addMask: (type: MaskType) => string | null
  updateMask: (id: string, patch: Partial<Omit<Mask, 'id' | 'type'>>) => void
  removeMask: (id: string) => void
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

  setAdjustments: (values) => {
    set((s) => {
      const next = { ...s.adjustments }
      for (const [key, value] of Object.entries(values) as [ScalarKey, number][]) next[key] = clampAdjustment(key, value)
      return { adjustments: next }
    })
  },

  addMask: (type) => {
    const { adjustments, apply } = get()
    if (adjustments.masks.length >= MAX_MASKS) return null
    const mask = createMask(type)
    apply({ ...adjustments, masks: [...adjustments.masks, mask] })
    return mask.id
  },

  updateMask: (id, patch) => {
    set((s) => ({
      adjustments: {
        ...s.adjustments,
        masks: s.adjustments.masks.map((m) =>
          m.id === id ? { ...m, ...patch, adjust: { ...m.adjust, ...patch.adjust } } : m,
        ),
      },
    }))
  },

  removeMask: (id) => {
    const { adjustments, apply } = get()
    apply({ ...adjustments, masks: adjustments.masks.filter((m) => m.id !== id) })
  },

  setCurve: (channel, points) => {
    set((s) => ({
      adjustments: { ...s.adjustments, curve: { ...s.adjustments.curve, [channel]: normalizeCurvePoints(points) } },
    }))
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

// 調色（和 Lightroom 一樣的編修）或工具（像素畫這類非調色的功能，拿調好色的畫面再加工）
export type Workspace = 'develop' | 'tools'
export type Tool = 'pixel'

// 只是畫面狀態，不進 undo 歷史
interface ViewState {
  workspace: Workspace
  // 工具頁裡打開的工具；null = 工具清單
  tool: Tool | null
  // 按住比較時顯示原圖
  showOriginal: boolean
  showHistogram: boolean
  histogram: Histogram | null
  // 在裁切分頁時顯示整個畫框與裁切框
  cropMode: boolean
  // 裁切的長寬比：null = 自由；其他是像素的寬 / 高
  cropAspect: number | null
  // 在遮罩分頁時顯示遮罩的把手；showMask 會把遮罩範圍塗成紅色
  maskMode: boolean
  selectedMask: string | null
  showMask: boolean
  // 筆刷工具：直徑（原圖長邊的比例）、羽化 0..100、是否是橡皮擦
  brushSize: number
  brushFeather: number
  brushErase: boolean
  // 收起下方（桌機是右側）的操作面板，讓照片佔滿畫面
  panelCollapsed: boolean
  setPanelCollapsed: (value: boolean) => void
  setWorkspace: (value: Workspace) => void
  setTool: (value: Tool | null) => void
  setShowOriginal: (value: boolean) => void
  setBrush: (patch: Partial<{ brushSize: number; brushFeather: number; brushErase: boolean }>) => void
  setMaskMode: (value: boolean) => void
  selectMask: (id: string | null) => void
  setShowMask: (value: boolean) => void
  setCropMode: (value: boolean) => void
  setCropAspect: (value: number | null) => void
  toggleHistogram: () => void
  setHistogram: (histogram: Histogram | null) => void
}

export const useView = create<ViewState>((set) => ({
  workspace: 'develop',
  tool: null,
  showOriginal: false,
  showHistogram: true,
  histogram: null,
  cropMode: false,
  cropAspect: null,
  maskMode: false,
  selectedMask: null,
  showMask: false,
  brushSize: 0.08,
  brushFeather: 50,
  brushErase: false,
  panelCollapsed: false,
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  setWorkspace: (workspace) => set({ workspace }),
  setTool: (tool) => set({ tool }),
  setShowOriginal: (showOriginal) => set({ showOriginal }),
  setBrush: (patch) => set(patch),
  setMaskMode: (maskMode) => set({ maskMode }),
  selectMask: (selectedMask) => set({ selectedMask }),
  setShowMask: (showMask) => set({ showMask }),
  setCropMode: (cropMode) => set({ cropMode }),
  setCropAspect: (cropAspect) => set({ cropAspect }),
  toggleHistogram: () => set((s) => ({ showHistogram: !s.showHistogram })),
  setHistogram: (histogram) => set({ histogram }),
}))
