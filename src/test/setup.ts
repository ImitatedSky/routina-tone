import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { useLanguage } from '@/i18n/i18n'

// jsdom 的 navigator.language 是 en-US；測試一律用中文介面，查元件時才對得上中文名稱
beforeEach(() => useLanguage.getState().setPref('zh-Hant'))
