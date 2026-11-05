export type ThemePreference = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'form-and-fuel-theme'
export const normalizePreference = (value: string | null): ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'dark'
export function readPreference(): ThemePreference {
  try {
    return normalizePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'dark'
  }
}
