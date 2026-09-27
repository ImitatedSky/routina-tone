import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@/editor/editorStore'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useLanguage } from '@/i18n/i18n'
import { MixerPanel } from './MixerPanel'

beforeEach(() => useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS }))

describe('MixerPanel', () => {
  it('shows hue, saturation and luminance for the selected color', () => {
    render(<MixerPanel />)
    expect(screen.getAllByRole('slider')).toHaveLength(3)
    expect(screen.getByRole('slider', { name: '色相' })).toHaveAttribute('id', 'adj-hueRed')

    fireEvent.click(screen.getByRole('button', { name: '洋紅色' }))
    expect(screen.getByRole('button', { name: '洋紅色' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('slider', { name: '飽和度' })).toHaveAttribute('id', 'adj-satMagenta')
  })

  it('updates the store from a slider', () => {
    render(<MixerPanel />)
    fireEvent.click(screen.getByRole('button', { name: '藍色' }))
    const slider = screen.getByRole('slider', { name: '明度' })
    for (let i = 0; i < 3; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useEditor.getState().adjustments.lumBlue).toBe(3)
  })

  it('renders English labels', () => {
    useLanguage.getState().setPref('en')
    render(<MixerPanel />)
    expect(screen.getByRole('group', { name: 'Choose color' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }))
    expect(screen.getByRole('slider', { name: 'Saturation' })).toHaveAttribute('id', 'adj-satBlue')
  })
})
