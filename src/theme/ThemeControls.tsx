import { Moon, Sun } from 'lucide-react'
import { Field, IconButton } from '../shared/ui'
import { useTheme } from './ThemeContext'
import type { ThemePreference } from './theme'

export function ThemeToggle() {
  const { resolved, setPreference } = useTheme()
  return (
    <IconButton
      label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
      onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
    >
      {resolved === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </IconButton>
  )
}
export function ThemeSelector() {
  const { preference, setPreference } = useTheme()
  return (
    <Field label="Color mode">
      <select
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </Field>
  )
}
