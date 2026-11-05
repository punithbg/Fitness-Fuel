import { LoaderCircle } from 'lucide-react'
import { type ReactNode } from 'react'

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function FormFooter({
  busy,
  error,
  onClose,
  label = 'Save',
}: {
  busy: boolean
  error: string
  onClose: () => void
  label?: string
}) {
  return (
    <>
      <ErrorMessage error={error} />
      <footer className="form-footer">
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="button" disabled={busy}>
          {busy && <LoaderCircle size={16} className="spin" />}
          {busy ? 'Saving...' : label}
        </button>
      </footer>
    </>
  )
}

export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null
}
