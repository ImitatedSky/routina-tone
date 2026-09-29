import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import {
  addPreset,
  deletePreset,
  listPresets,
  loadGroupOrder,
  loadSession,
  putPreset,
  saveGroupOrder,
  saveSessionAdjustments,
  saveSessionPhoto,
  setPresetOrders,
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

  it('reads old rows without group, favorite or order', async () => {
    // 模擬加上這些欄位之前存的資料：沒分組、不是常用、依建立時間排（新的在前）
    const old = { id: 'old', name: 'Old', adjustments: DEFAULT_ADJUSTMENTS, createdAt: 1 } as unknown as Preset
    const older = { id: 'older', name: 'Older', adjustments: DEFAULT_ADJUSTMENTS, createdAt: 0.5 } as unknown as Preset
    await putPreset(older)
    await putPreset(old)
    const list = await listPresets()
    expect(list[0]).toEqual({ ...old, group: '', favorite: false, order: -1 })
    expect(list.map((p) => p.id)).toEqual(['old', 'older'])
    await deletePreset('old')
    await deletePreset('older')
  })

  it('puts new presets first and saves favorites, orders and the group order', async () => {
    const a = await addPreset('A', DEFAULT_ADJUSTMENTS)
    const b = await addPreset('B', DEFAULT_ADJUSTMENTS)
    expect((await listPresets()).map((p) => p.name)).toEqual(['B', 'A'])
    await setPresetOrders([
      { id: a.id, order: b.order },
      { id: b.id, order: a.order },
    ])
    await updatePreset(a.id, { favorite: true })
    const list = await listPresets()
    expect(list.map((p) => p.name)).toEqual(['A', 'B'])
    expect(list[0].favorite).toBe(true)
    await saveGroupOrder(['Film', 'Blue'])
    expect(await loadGroupOrder()).toEqual(['Film', 'Blue'])
    await deletePreset(a.id)
    await deletePreset(b.id)
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
