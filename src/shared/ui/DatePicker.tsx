import { addDays, format, parseISO } from 'date-fns'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { today } from '../../domain'
import { IconButton } from './Buttons'

export function DatePicker({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return (
    <div className="date-picker">
      <IconButton
        label="Previous day"
        onClick={() => onChange(format(addDays(parseISO(date), -1), 'yyyy-MM-dd'))}
      >
        <ArrowLeft size={17} />
      </IconButton>
      <input
        aria-label="Selected date"
        type="date"
        value={date}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value)
        }}
      />
      <IconButton
        label="Next day"
        onClick={() => onChange(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))}
      >
        <ArrowRight size={17} />
      </IconButton>
      {date !== today() && (
        <button className="text-button" onClick={() => onChange(today())}>
          Today
        </button>
      )}
    </div>
  )
}
