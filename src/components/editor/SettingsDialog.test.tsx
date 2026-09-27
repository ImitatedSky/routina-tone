import { fireEvent, render, screen } from '@testing-library/react'
import { useLanguage } from '@/i18n/i18n'
import { EditPanel } from './EditPanel'
import { Toolbar } from './Toolbar'

describe('language setting', () => {
  it('switches the interface to English and back', () => {
    render(
      <>
        <Toolbar />
        <EditPanel />
      </>,
    )
    expect(screen.getByRole('tab', { name: '光線' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '設定' }))
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(useLanguage.getState().locale).toBe('en')
    // 對話框開著時背景對輔助技術是隱藏的，先關掉
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.getByRole('tab', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Exposure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('radio', { name: '繁體中文' }))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.getByRole('tab', { name: '光線' })).toBeInTheDocument()
  })

  it('remembers the choice', () => {
    useLanguage.getState().setPref('en')
    expect(localStorage.getItem('tone-language')).toBe('en')
  })
})
