import { create } from 'zustand'
import { common } from './messages/common'
import { editor } from './messages/editor'
import { masks } from './messages/masks'
import { panels } from './messages/panels'
import { photo } from './messages/photo'
import { presets } from './messages/presets'

// 介面語言。字串依功能分檔放在 messages/，每個檔案的英文版用 `satisfies typeof zh`
// 綁住中文版的鍵，少翻或多一個鍵都會編譯失敗。

export type Locale = 'zh-Hant' | 'en'
export type LanguagePref = 'system' | Locale

const NAMESPACES = { common, editor, masks, panels, photo, presets }

export type Messages = { [K in keyof typeof NAMESPACES]: (typeof NAMESPACES)[K]['zh-Hant'] }

function build(locale: Locale): Messages {
  return Object.fromEntries(
    Object.entries(NAMESPACES).map(([name, ns]) => [name, ns[locale]]),
  ) as Messages
}

const MESSAGES: Record<Locale, Messages> = { 'zh-Hant': build('zh-Hant'), en: build('en') }

// 中文（不分繁簡）顯示繁中，其他一律英文
export function systemLocale(): Locale {
  const languages = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  return languages.some((l) => l?.toLowerCase().startsWith('zh')) ? 'zh-Hant' : 'en'
}

const STORAGE_KEY = 'tone-language'

function loadPref(): LanguagePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'zh-Hant' || value === 'en' || value === 'system') return value
  } catch {
    // 無痕模式等拿不到 storage 的情況：跟隨系統
  }
  return 'system'
}

function resolve(pref: LanguagePref): Locale {
  return pref === 'system' ? systemLocale() : pref
}

interface LanguageState {
  pref: LanguagePref
  locale: Locale
  setPref: (pref: LanguagePref) => void
}

export const useLanguage = create<LanguageState>((set) => {
  const pref = loadPref()
  return {
    pref,
    locale: resolve(pref),
    setPref: (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // 存不了就只在這次開啟有效
      }
      set({ pref: next, locale: resolve(next) })
    },
  }
})

// React 元件用：語言切換時會重新渲染
export function useT(): Messages {
  return MESSAGES[useLanguage((s) => s.locale)]
}

// 非 React 的程式（錯誤訊息、toast）用：取當下的語言
export function t(): Messages {
  return MESSAGES[useLanguage.getState().locale]
}
