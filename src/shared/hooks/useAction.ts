import { useState } from 'react'
import { ZodError } from 'zod'

export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await operation()
      after?.()
    } catch (caught) {
      setError(
        caught instanceof ZodError
          ? caught.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
          : caught instanceof Error
            ? caught.message
            : 'Unable to save. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}
