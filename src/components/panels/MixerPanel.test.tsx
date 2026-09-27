import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@/editor/editorStore'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { MixerPanel } from './MixerPanel'

beforeEach(() => useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS }))

describe('MixerPanel', () => {
  it('shows eight hue sliders and switches to saturation', () => {
    render(<MixerPanel />)
    expect(screen.getAllByRole('slider')).toHaveLength(8)
    expect(screen.getByLabelText('紅色')).toHaveAttribute('id', 'adj-hueRed')

    fireEvent.click(screen.getByRole('tab', { name: '飽和度' }))
    expect(screen.getAllByRole('slider')).toHaveLength(8)
    expect(screen.getByRole('slider', { name: '洋紅色' })).toBeInTheDocument()
  })

  it('updates the store from a slider', () => {
    render(<MixerPanel />)
    fireEvent.click(screen.getByRole('tab', { name: '明度' }))
    const slider = screen.getByRole('slider', { name: '藍色' })
    for (let i = 0; i < 3; i++) fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(useEditor.getState().adjustments.lumBlue).toBe(3)
  })
})
