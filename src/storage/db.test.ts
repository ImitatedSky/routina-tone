import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import {
  addPreset,
  deletePreset,
  listPresets,
  loadSession,
  putPreset,
  saveSessionAdjustments,
  saveSessionPhoto,
  updatePreset,
  type Preset,
} from './db'

describe('db', () => {
  it('adds, lists newest first and deletes presets', async () => {
    const a = await addPreset('A', { ...DEFAULT_ADJUSTMENTS, temp: 10 })
    await new Promise((r) => setTimeout(r, 2))
    const b = await addPreset('B', DEFAULT_ADJUSTMENTS)

    const list = await listPresets()
    expect(list.map((p) => p.name)).toEqual(['B', 'A'])
    expect(list[1].adjustments).toEqual({ ...DEFAULT_ADJUSTMENTS, temp: 10 })

    await deletePreset(a.id)
    await deletePreset(b.id)
    expect(await listPresets()).toEqual([])
  })

  it('stores the group and renames or regroups a preset', async () => {
    const a = await addPreset('A', { ...DEFAULT_ADJUSTMENTS, temp: 10 }, 'Film')
    expect((await listPresets())[0].group).toBe('Film')

    await updatePreset(a.id, { name: 'A2', group: 'Portrait' })
    let [row] = await listPresets()
    expect(row).toMatchObject({ id: a.id, name: 'A2', group: 'Portrait', createdAt: a.createdAt })
    expect(row.adjustments).toEqual({ ...DEFAULT_ADJUSTMENTS, temp: 10 })

    await updatePreset(a.id, { group: '' })
    ;[row] = await listPresets()
    expect(row).toMatchObject({ name: 'A2', group: '' })
    await deletePreset(a.id)
  })

  it('reads old rows without a group as ungrouped', async () => {
    // 模擬加上群組之前存的資料
    const old = { id: 'old', name: 'Old', adjustments: DEFAULT_ADJUSTMENTS, createdAt: 1 } as unknown as Preset
    await putPreset(old)
    expect(await listPresets()).toEqual([{ ...old, group: '' }])
    await deletePreset('old')
  })

  it('saves and loads the session', async () => {
    expect(await loadSession()).toBeNull()
    const adjustments = { ...DEFAULT_ADJUSTMENTS, exposure: -1 }
    await saveSessionPhoto(new Blob(['x']), 'a.jpg')
    await saveSessionAdjustments(adjustments)
    const session = await loadSession()
    expect(session?.photoName).toBe('a.jpg')
    expect(session?.adjustments).toEqual(adjustments)
  })
})
