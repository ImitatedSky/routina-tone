import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor } from '@/editor/editorStore'
import { serializePreset } from '@/presets/presetFile'
import { addPreset, deletePreset, listPresets, loadGroupOrder, putPreset, saveGroupOrder } from '@/storage/db'
import { PresetPanel } from './PresetPanel'

const writeText = vi.fn()

beforeEach(async () => {
  localStorage.clear()
  await saveGroupOrder([])
  for (const p of await listPresets()) await deletePreset(p.id)
  useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS })
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

// 動作都收在 ⋯ 選單裡
async function menuAction(name: string, action: string) {
  fireEvent.click(await screen.findByRole('button', { name: `「${name}」的更多動作` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: action }))
}

// 群組標題的名稱包含數量，例如「Film2」
const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}\\s*\\d+$`) })

describe('PresetPanel', () => {
  it('copies a preset as JSON', async () => {
    const adjustments = { ...DEFAULT_ADJUSTMENTS, exposure: 0.5 }
    await addPreset('暖色', adjustments)
    render(<PresetPanel />)
    await menuAction('暖色', '複製 JSON')
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

  it('lists groups first and ungrouped presets last, with collapsible sections', async () => {
    // 同一段內照建立時間新到舊
    const put = (name: string, group: string, createdAt: number) =>
      putPreset({ id: name, name, group, favorite: false, order: -createdAt, adjustments: DEFAULT_ADJUSTMENTS, createdAt })
    await put('Film B', 'Film', 1)
    await put('Plain', '', 2)
    await put('Film A', 'Film', 3)
    await put('Cool', 'Blue', 4)
    render(<PresetPanel />)

    const headers = await screen.findAllByRole('button', { expanded: true })
    expect(headers.map((h) => h.textContent)).toEqual(['Blue1', 'Film2', '未分組1'])
    const names = screen.getAllByRole('listitem').map((li) => within(li).getAllByRole('button')[0].textContent)
    expect(names).toEqual(['Cool', 'Film A', 'Film B', 'Plain'])

    fireEvent.click(header('Film'))
    expect(screen.queryByRole('button', { name: 'Film A' })).not.toBeInTheDocument()
    expect(header('Film')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Cool' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('tone-preset-collapsed-groups')!)).toEqual(['Film'])

    fireEvent.click(header('Film'))
    expect(screen.getByRole('button', { name: 'Film A' })).toBeInTheDocument()
  })

  it('shows favorites in their own section at the top', async () => {
    await addPreset('Film A', DEFAULT_ADJUSTMENTS, 'Film')
    await addPreset('Plain', DEFAULT_ADJUSTMENTS)
    render(<PresetPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '標為常用「Film A」' }))
    await waitFor(() => expect(header('常用')).toBeInTheDocument())
    const headers = screen.getAllByRole('button', { expanded: true }).map((h) => h.textContent)
    expect(headers).toEqual(['常用1', 'Film1', '未分組1'])
    // 常用的也還在原本的群組裡
    expect(screen.getAllByRole('button', { name: 'Film A' })).toHaveLength(2)
    expect((await listPresets()).find((p) => p.name === 'Film A')?.favorite).toBe(true)

    fireEvent.click(screen.getAllByRole('button', { name: '取消常用「Film A」' })[0])
    await waitFor(() => expect(screen.queryByRole('button', { name: /^常用/ })).not.toBeInTheDocument())
  })

  it('reorders presets and groups', async () => {
    await addPreset('B1', DEFAULT_ADJUSTMENTS, 'Blue')
    await addPreset('F2', DEFAULT_ADJUSTMENTS, 'Film')
    await addPreset('F1', DEFAULT_ADJUSTMENTS, 'Film')
    render(<PresetPanel />)
    fireEvent.click(await screen.findByRole('button', { name: '調整順序' }))

    fireEvent.click(screen.getByRole('button', { name: '「F1」往下移' }))
    await waitFor(async () =>
      expect((await listPresets()).filter((p) => p.group === 'Film').map((p) => p.name)).toEqual(['F2', 'F1']),
    )

    fireEvent.click(screen.getByRole('button', { name: '「Film」往上移' }))
    await waitFor(() =>
      expect(screen.getAllByRole('button', { expanded: true }).map((h) => h.textContent)).toEqual(['Film2', 'Blue1']),
    )
    expect(await loadGroupOrder()).toEqual(['Film', 'Blue'])

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.queryByRole('button', { name: /往上移/ })).not.toBeInTheDocument()
  })

  it('remembers collapsed groups', async () => {
    localStorage.setItem('tone-preset-collapsed-groups', '["Film"]')
    await addPreset('Film A', DEFAULT_ADJUSTMENTS, 'Film')
    render(<PresetPanel />)
    await screen.findByRole('button', { name: '調整順序' })
    expect(header('Film')).toHaveAttribute('aria-expanded', 'false')
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
    await menuAction('暖色', '編輯')
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
    await waitFor(() => expect(header('Portrait')).toHaveTextContent('2'))
  })

  it('keeps the group when importing and copying', async () => {
    render(<PresetPanel />)
    fireEvent.click(screen.getByRole('button', { name: '貼上文字' }))
    const text = serializePreset('貼上的', DEFAULT_ADJUSTMENTS, 'Film')
    fireEvent.change(screen.getByRole('textbox', { name: '貼上預設集' }), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: '匯入' }))
    await waitFor(async () => expect(await listPresets()).toMatchObject([{ name: '貼上的', group: 'Film' }]))

    await menuAction('貼上的', '複製 JSON')
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(text))
  })
})
