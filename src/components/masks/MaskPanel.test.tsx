import { fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useEditor, useView } from '@/editor/editorStore'
import { useLanguage } from '@/i18n/i18n'
import { MaskPanel } from './MaskPanel'

beforeEach(() => {
  useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS, past: [], future: [] })
  useView.setState({ selectedMask: null, showMask: false })
})

describe('MaskPanel', () => {
  it('shows the empty state', () => {
    render(<MaskPanel />)
    expect(screen.getByText(/在照片的一部分套用調整/)).toBeInTheDocument()
  })

  it('adds a linear mask and selects it', () => {
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: '新增線性漸層' }))
    const masks = useEditor.getState().adjustments.masks
    expect(masks).toHaveLength(1)
    expect(masks[0].type).toBe('linear')
    expect(useView.getState().selectedMask).toBe(masks[0].id)
    expect(screen.getByRole('button', { name: /線性 1/, pressed: true })).toBeInTheDocument()
    expect(useEditor.getState().past).toHaveLength(1)
  })

  it('moves a local slider with the keyboard and commits once', () => {
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: '新增線性漸層' }))
    const slider = document.getElementById('mask-exposure')!
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(useEditor.getState().adjustments.masks[0].adjust.exposure).toBe(0.05)
    expect(slider).toHaveAttribute('aria-valuetext', '+0.05')
    expect(useEditor.getState().past).toHaveLength(2)
  })

  it('shows feather and invert only for radial masks', () => {
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: '新增線性漸層' }))
    expect(document.getElementById('mask-feather')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '新增放射狀漸層' }))
    expect(document.getElementById('mask-feather')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '反轉', pressed: false }))
    expect(useEditor.getState().adjustments.masks[1].invert).toBe(true)
  })

  it('toggles the overlay', () => {
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: '新增放射狀漸層' }))
    fireEvent.click(screen.getByRole('button', { name: '顯示遮罩範圍' }))
    expect(useView.getState().showMask).toBe(true)
  })

  it('deletes the selected mask and selects the remaining one', () => {
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: '新增線性漸層' }))
    fireEvent.click(screen.getByRole('button', { name: '新增放射狀漸層' }))
    fireEvent.click(screen.getByRole('button', { name: '刪除放射狀 2' }))
    const masks = useEditor.getState().adjustments.masks
    expect(masks).toHaveLength(1)
    expect(useView.getState().selectedMask).toBe(masks[0].id)
    fireEvent.click(screen.getByRole('button', { name: '刪除線性 1' }))
    expect(useEditor.getState().adjustments.masks).toHaveLength(0)
    expect(useView.getState().selectedMask).toBeNull()
  })

  it('renders in English', () => {
    useLanguage.getState().setPref('en')
    render(<MaskPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Radial Gradient' }))
    expect(screen.getByRole('button', { name: /Radial 1/, pressed: true })).toBeInTheDocument()
    expect(screen.getByText('Feather')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invert' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show overlay' })).toBeInTheDocument()
    expect(screen.getByText('Exposure')).toBeInTheDocument()
  })
})
