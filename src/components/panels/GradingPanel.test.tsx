import { fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@/editor/editorStore'
import { DEFAULT_ADJUSTMENTS } from '@/engine/adjustments'
import { useLanguage } from '@/i18n/i18n'
import { GradingPanel } from './GradingPanel'

beforeEach(() => useEditor.setState({ adjustments: DEFAULT_ADJUSTMENTS, committed: DEFAULT_ADJUSTMENTS }))

describe('GradingPanel', () => {
  it('shows the wheel and luminance of the selected range', () => {
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, gradeHighlightHue: 40, gradeHighlightSat: 25 } })
    render(<GradingPanel />)
    expect(screen.getByRole('group', { name: '陰影色輪' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '亮部' }))
    expect(screen.getByRole('group', { name: '亮部色輪' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '色相' })).toHaveValue('40')
    expect(screen.getByLabelText('明度')).toHaveAttribute('id', 'adj-gradeHighlightLum')
  })

  it('accepts typed hue and saturation values', () => {
    render(<GradingPanel />)
    const hue = screen.getByRole('textbox', { name: '色相' })
    fireEvent.change(hue, { target: { value: '370' } })
    // 輸入中只是草稿，還沒套用
    expect(useEditor.getState().adjustments.gradeShadowHue).toBe(0)
    fireEvent.keyDown(hue, { key: 'Enter' })
    fireEvent.blur(hue)
    expect(useEditor.getState().adjustments.gradeShadowHue).toBe(10)

    const sat = screen.getByRole('textbox', { name: '飽和度' })
    fireEvent.change(sat, { target: { value: '150' } })
    fireEvent.blur(sat)
    expect(useEditor.getState().adjustments.gradeShadowSat).toBe(100)
    expect(useEditor.getState().past).toHaveLength(2)

    // 亂打的內容不套用，欄位回到原本的值
    fireEvent.change(sat, { target: { value: 'abc' } })
    fireEvent.blur(sat)
    expect(sat).toHaveValue('100')
  })

  it('renders English labels', () => {
    useLanguage.getState().setPref('en')
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, gradeHighlightHue: 40, gradeHighlightSat: 25 } })
    render(<GradingPanel />)
    fireEvent.click(screen.getByRole('tab', { name: 'Highlights' }))
    expect(screen.getByRole('group', { name: 'Highlights wheel' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Hue' })).toHaveValue('40')
    expect(screen.getByRole('button', { name: 'Reset Highlights' })).toBeEnabled()
    expect(screen.getByLabelText('Luminance')).toHaveAttribute('id', 'adj-gradeHighlightLum')
  })
})
