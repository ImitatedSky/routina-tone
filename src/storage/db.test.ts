import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { addPreset, deletePreset, listPresets, loadSession, saveSessionAdjustments, saveSessionPhoto } from './db'

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
