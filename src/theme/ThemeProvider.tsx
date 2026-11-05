import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import {
  normalizePreference,
  readPreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState(readPreference)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMediaChange = () => setSystemDark(media.matches)
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        updatePreference(normalizePreference(event.newValue))
    }
    media.addEventListener('change', onMediaChange)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onMediaChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#202024' : '#f6f6f8')
  }, [resolved])
  const setPreference = (value: ThemePreference) => {
    updatePreference(value)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value)
    } catch {
      return
    }
  }
  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
