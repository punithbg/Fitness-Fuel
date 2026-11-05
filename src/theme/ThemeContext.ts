import { createContext, useContext } from 'react'
import type { EffectiveTheme, ThemePreference } from './theme'

export const ThemeContext = createContext<{
  preference: ThemePreference
  resolved: EffectiveTheme
  setPreference: (value: ThemePreference) => void
} | null>(null)
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('Theme controls require a ThemeProvider')
  return context
}
