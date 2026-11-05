import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { id, type SessionExercise } from '../../../domain'
import { Field, IconButton } from '../../../shared/ui'

type Props = {
  exercise: SessionExercise
  index: number
  total: number
  onChange: (value: SessionExercise) => void
  onMove: (direction: number) => void
  onRemove: () => void
}

export function WorkoutExerciseEditor({
  exercise,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const updateSet = (setId: string, changes: Partial<SessionExercise['sets'][number]>) => {
    onChange({
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...changes } : set)),
    })
  }
  return (
    <section className="exercise-editor">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Exercise {index + 1}</span>
          <h3>{exercise.name}</h3>
        </div>
        <div className="row-actions">
          <IconButton
            label={`Move ${exercise.name} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={16} />
          </IconButton>
          <IconButton
            label={`Move ${exercise.name} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={16} />
          </IconButton>
          <IconButton label={`Remove ${exercise.name}`} onClick={onRemove}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>
      <div className="set-table">
        <div className="set-labels">
          <span>Set</span>
          <span>Reps</span>
          <span>Kg</span>
          <span>RPE</span>
          <span />
        </div>
        {exercise.sets.map((set, setIndex) => (
          <div className="set-row" key={set.id}>
            <span className="set-number">{setIndex + 1}</span>
            <input
              aria-label={`${exercise.name} set ${setIndex + 1} reps`}
              required
              type="number"
              min="1"
              step="1"
              value={set.reps || ''}
              onChange={(event) => updateSet(set.id, { reps: Number(event.target.value) })}
            />
            <input
              aria-label={`${exercise.name} set ${setIndex + 1} kg`}
              required
              type="number"
              min="0"
              step="any"
              value={set.weight}
              onChange={(event) => updateSet(set.id, { weight: Number(event.target.value) })}
            />
            <input
              aria-label={`${exercise.name} set ${setIndex + 1} RPE`}
              type="number"
              min="1"
              max="10"
              step="0.5"
              placeholder="-"
              value={set.rpe ?? ''}
              onChange={(event) =>
                updateSet(set.id, {
                  rpe: event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
            />
            <IconButton
              label={`Remove ${exercise.name} set ${setIndex + 1}`}
              onClick={() =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.filter((current) => current.id !== set.id),
                })
              }
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange({
            ...exercise,
            sets: [
              ...exercise.sets,
              { ...(exercise.sets.at(-1) ?? { reps: 10, weight: 0 }), id: id() },
            ],
          })
        }
      >
        <Plus size={15} />
        Add set
      </button>
      <Field label={`${exercise.name} notes`}>
        <input
          maxLength={2000}
          value={exercise.notes}
          onChange={(event) => onChange({ ...exercise, notes: event.target.value })}
          placeholder="Optional"
        />
      </Field>
    </section>
  )
}
