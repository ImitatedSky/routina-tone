import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { configure } from '@testing-library/react'
import { useLanguage } from '@/i18n/i18n'

// jsdom 的 navigator.language 是 en-US；測試一律用中文介面，查元件時才對得上中文名稱
beforeEach(() => useLanguage.getState().setPref('zh-Hant'))

// 整套測試平行跑時 IndexedDB 的來回比較慢，findBy / waitFor 預設 1 秒不夠
configure({ asyncUtilTimeout: 4000 })
