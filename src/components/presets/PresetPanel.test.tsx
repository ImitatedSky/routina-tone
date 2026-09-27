import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { serializePreset } from '@/presets/presetFile'
import { addPreset, deletePreset, listPresets } from '@/storage/db'
import { PresetPanel } from './PresetPanel'

const writeText = vi.fn()

beforeEach(async () => {
  for (const p of await listPresets()) await deletePreset(p.id)
  useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS })
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

describe('PresetPanel', () => {
  it('copies a preset as JSON', async () => {
    const adjustments = { ...DEFAULT_ADJUSTMENTS, exposure: 0.5 }
    await addPreset('暖色', adjustments)
    render(<PresetPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '複製「暖色」的 JSON' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(serializePreset('暖色', adjustments)))
  })

  it('imports a pasted preset', async () => {
    render(<PresetPanel />)
    fireEvent.click(screen.getByRole('button', { name: '貼上文字' }))
    const text = serializePreset('貼上的', { ...DEFAULT_ADJUSTMENTS, contrast: 20 })
    fireEvent.change(screen.getByRole('textbox', { name: '貼上預設集' }), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: '匯入' }))
    await waitFor(async () => expect((await listPresets()).map((p) => p.name)).toEqual(['貼上的']))
    expect((await listPresets())[0].adjustments.contrast).toBe(20)
  })

  it('keeps the dialog open and the text when the paste is not a preset', async () => {
    render(<PresetPanel />)
    fireEvent.click(screen.getByRole('button', { name: '貼上文字' }))
    const box = screen.getByRole('textbox', { name: '貼上預設集' })
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: '匯入' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '匯入' })).toBeEnabled())
    expect(box).toHaveValue('hello')
    expect(await listPresets()).toEqual([])
  })
})
