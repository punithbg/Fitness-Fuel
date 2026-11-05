import { Plus } from 'lucide-react'
import { type ReactNode } from 'react'

export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function AddButton({
  children,
  onClick,
  secondary = false,
}: {
  children: ReactNode
  onClick: () => void
  secondary?: boolean
}) {
  return (
    <button type="button" className={secondary ? 'button secondary' : 'button'} onClick={onClick}>
      <Plus size={17} />
      {children}
    </button>
  )
}
