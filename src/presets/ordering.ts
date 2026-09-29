import type { Preset } from '@/storage/db'

export interface PresetSections {
  favorites: Preset[]
  groups: { name: string; presets: Preset[] }[]
  ungrouped: Preset[]
}

// 群組的順序：先照使用者排過的順序，沒排過的（新群組）依名稱接在後面
export function orderedGroups(presets: Preset[], savedOrder: string[]): string[] {
  const names = new Set(presets.map((p) => p.group).filter(Boolean))
  const known = savedOrder.filter((g) => names.has(g))
  const rest = [...names].filter((g) => !known.includes(g)).sort((a, b) => a.localeCompare(b))
  return [...known, ...rest]
}

// 畫面上的分段：常用在最上面（也還會出現在原本的群組裡），接著各群組，沒分組的在最下面。
// presets 已經依 order 排好
export function presetSections(presets: Preset[], savedOrder: string[]): PresetSections {
  return {
    favorites: presets.filter((p) => p.favorite),
    groups: orderedGroups(presets, savedOrder).map((name) => ({ name, presets: presets.filter((p) => p.group === name) })),
    ungrouped: presets.filter((p) => !p.group),
  }
}

// 在一個區段裡把某個預設集往上 / 往下移一格。回傳要寫回去的新 order；移不動時是空陣列。
// 只和區段裡的相鄰那一個交換 order，其他預設集的順序都不受影響
export function movePreset(section: Preset[], id: string, direction: -1 | 1): { id: string; order: number }[] {
  const index = section.findIndex((p) => p.id === id)
  const other = section[index + direction]
  if (index < 0 || !other) return []
  const a = section[index]
  // 兩個 order 一樣時（理論上不會，保險起見）先拉開再交換
  const [oa, ob] = a.order === other.order ? [other.order + direction, a.order] : [other.order, a.order]
  return [
    { id: a.id, order: oa },
    { id: other.id, order: ob },
  ]
}

export function moveGroup(order: string[], name: string, direction: -1 | 1): string[] {
  const index = order.indexOf(name)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.length) return order
  const next = [...order]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
