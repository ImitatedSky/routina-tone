import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import type { Preset } from '@/storage/db'
import { moveGroup, movePreset, orderedGroups, presetSections } from './ordering'

const preset = (id: string, group: string, order: number, favorite = false): Preset => ({
  id,
  name: id,
  group,
  favorite,
  order,
  adjustments: DEFAULT_ADJUSTMENTS,
  createdAt: 0,
})

const list = [preset('a', '', 1), preset('b', 'Film', 2, true), preset('c', 'Film', 3), preset('d', 'Blue', 4)]

describe('presetSections', () => {
  it('puts favorites first, then groups, then ungrouped', () => {
    const s = presetSections(list, [])
    expect(s.favorites.map((p) => p.id)).toEqual(['b'])
    expect(s.groups.map((g) => g.name)).toEqual(['Blue', 'Film'])
    expect(s.groups[1].presets.map((p) => p.id)).toEqual(['b', 'c'])
    expect(s.ungrouped.map((p) => p.id)).toEqual(['a'])
  })

  it('follows the saved group order and appends new groups by name', () => {
    expect(orderedGroups([...list, preset('e', 'Aqua', 5)], ['Film', 'Gone'])).toEqual(['Film', 'Aqua', 'Blue'])
  })
})

describe('moving', () => {
  it('swaps a preset with its neighbour in the section', () => {
    const film = list.filter((p) => p.group === 'Film')
    expect(movePreset(film, 'c', -1)).toEqual([
      { id: 'c', order: 2 },
      { id: 'b', order: 3 },
    ])
    expect(movePreset(film, 'b', -1)).toEqual([])
  })

  it('moves a group up or down and stops at the ends', () => {
    expect(moveGroup(['A', 'B', 'C'], 'C', -1)).toEqual(['A', 'C', 'B'])
    expect(moveGroup(['A', 'B', 'C'], 'A', -1)).toEqual(['A', 'B', 'C'])
  })
})
