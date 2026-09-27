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
    expect(screen.getByText('色相 40°')).toBeInTheDocument()
    expect(screen.getByLabelText('明度')).toHaveAttribute('id', 'adj-gradeHighlightLum')
  })

  it('renders English labels', () => {
    useLanguage.getState().setPref('en')
    useEditor.setState({ adjustments: { ...DEFAULT_ADJUSTMENTS, gradeHighlightHue: 40, gradeHighlightSat: 25 } })
    render(<GradingPanel />)
    fireEvent.click(screen.getByRole('tab', { name: 'Highlights' }))
    expect(screen.getByRole('group', { name: 'Highlights wheel' })).toBeInTheDocument()
    expect(screen.getByText('Hue 40°')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Highlights' })).toBeEnabled()
    expect(screen.getByLabelText('Luminance')).toHaveAttribute('id', 'adj-gradeHighlightLum')
  })
})
