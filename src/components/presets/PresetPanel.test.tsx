import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { serializePreset } from '@/presets/presetFile'
import { addPreset, deletePreset, listPresets, putPreset } from '@/storage/db'
import { PresetPanel } from './PresetPanel'

const writeText = vi.fn()

beforeEach(async () => {
  localStorage.clear()
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

  it('lists ungrouped presets first, then collapsible groups sorted by name', async () => {
    // 群組內照建立時間新到舊
    const put = (name: string, group: string, createdAt: number) =>
      putPreset({ id: name, name, group, adjustments: DEFAULT_ADJUSTMENTS, createdAt })
    await put('Film B', 'Film', 1)
    await put('Plain', '', 2)
    await put('Film A', 'Film', 3)
    await put('Cool', 'Blue', 4)
    render(<PresetPanel />)

    const headers = await screen.findAllByRole('button', { expanded: true })
    expect(headers.map((h) => h.textContent)).toEqual(['Blue1', 'Film2'])
    const names = screen.getAllByRole('listitem').map((li) => within(li).getAllByRole('button')[0].textContent)
    expect(names).toEqual(['Plain', 'Cool', 'Film A', 'Film B'])

    fireEvent.click(screen.getByRole('button', { name: /^Film\s*\d+$/ }))
    expect(screen.queryByRole('button', { name: 'Film A' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Film\s*\d+$/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Cool' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('tone-preset-collapsed-groups')!)).toEqual(['Film'])

    fireEvent.click(screen.getByRole('button', { name: /^Film\s*\d+$/ }))
    expect(screen.getByRole('button', { name: 'Film A' })).toBeInTheDocument()
  })

  it('remembers collapsed groups', async () => {
    localStorage.setItem('tone-preset-collapsed-groups', '["Film"]')
    await addPreset('Film A', DEFAULT_ADJUSTMENTS, 'Film')
    render(<PresetPanel />)
    expect(await screen.findByRole('button', { name: /^Film\s*\d+$/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Film A' })).not.toBeInTheDocument()
  })

  it('saves a preset into a group', async () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, contrast: 10 } })
    render(<PresetPanel />)
    fireEvent.change(screen.getByLabelText('名稱'), { target: { value: '新的' } })
    fireEvent.change(screen.getByLabelText('群組'), { target: { value: ' Film ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    await waitFor(async () => expect(await listPresets()).toMatchObject([{ name: '新的', group: 'Film' }]))
  })

  it('renames and regroups a preset from the edit dialog', async () => {
    await addPreset('Other', DEFAULT_ADJUSTMENTS, 'Portrait')
    await addPreset('暖色', DEFAULT_ADJUSTMENTS)
    render(<PresetPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '編輯「暖色」' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('名稱')
    const groupInput = within(dialog).getByLabelText('群組')
    expect(nameInput).toHaveValue('暖色')
    expect(groupInput).toHaveValue('')
    // 既有群組會出現在選單裡
    const options = document.getElementById(groupInput.getAttribute('list')!)!.querySelectorAll('option')
    expect([...options].map((o) => o.value)).toEqual(['Portrait'])

    fireEvent.change(nameInput, { target: { value: '暖色 2' } })
    fireEvent.change(groupInput, { target: { value: 'Portrait' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const saved = (await listPresets()).find((p) => p.name === '暖色 2')
    expect(saved?.group).toBe('Portrait')
    expect(await screen.findByRole('button', { name: /^Portrait\s*\d+$/ })).toHaveTextContent('2')
  })

  it('keeps the group when importing and copying', async () => {
    render(<PresetPanel />)
    fireEvent.click(screen.getByRole('button', { name: '貼上文字' }))
    const text = serializePreset('貼上的', DEFAULT_ADJUSTMENTS, 'Film')
    fireEvent.change(screen.getByRole('textbox', { name: '貼上預設集' }), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: '匯入' }))
    await waitFor(async () => expect(await listPresets()).toMatchObject([{ name: '貼上的', group: 'Film' }]))

    fireEvent.click(await screen.findByRole('button', { name: '複製「貼上的」的 JSON' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(text))
  })
})
