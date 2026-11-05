import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { saveEntity, type FitnessData } from '../../../data'
import { id, stamp, type Routine, type SessionExercise, type Workout } from '../../../domain'
import { useAction } from '../../../shared'
import { Field, FormFooter, Modal } from '../../../shared/ui'
import { WorkoutExerciseEditor } from './WorkoutExerciseEditor'

export function WorkoutEditor({
  data,
  date,
  initial,
  routineMode = false,
  onClose,
}: {
  data: FitnessData
  date: string
  initial?: Workout | Routine
  routineMode?: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Workout>(() => ({
    ...stamp(),
    date,
    duration: 60,
    calories: undefined,
    notes: '',
    name: '',
    exercises: [],
    ...initial,
  }))
  const [exerciseId, setExerciseId] = useState('')
  const action = useAction()
  const updateExercise = (
    exerciseIndex: number,
    transform: (exercise: SessionExercise) => SessionExercise,
  ) =>
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, index) =>
        index === exerciseIndex ? transform(exercise) : exercise,
      ),
    }))
  const move = (index: number, direction: number) =>
    setDraft((current) => {
      const exercises = [...current.exercises]
      ;[exercises[index], exercises[index + direction]] = [
        exercises[index + direction],
        exercises[index],
      ]
      return { ...current, exercises }
    })
  const applyRoutine = (routineId: string) => {
    const routine = data.routines.find((item) => item.id === routineId)
    if (!routine) return
    if (
      draft.exercises.length &&
      !window.confirm('Replace the exercises in this unsaved form with the selected routine?')
    )
      return
    setDraft((current) => ({
      ...current,
      name: routine.name,
      exercises: routine.exercises.map((exercise) => ({
        ...exercise,
        id: id(),
        sets: exercise.sets.map((set) => ({ ...set, id: id() })),
      })),
    }))
  }
  return (
    <Modal
      title={
        routineMode
          ? initial
            ? 'Edit routine'
            : 'New routine'
          : initial
            ? 'Edit workout'
            : 'Log workout'
      }
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void action.run(
            () =>
              routineMode
                ? saveEntity('routines', {
                    id: draft.id,
                    ownerId: draft.ownerId,
                    updatedAt: draft.updatedAt,
                    name: draft.name,
                    exercises: draft.exercises,
                  })
                : saveEntity('workouts', draft),
            onClose,
          )
        }}
      >
        {!routineMode && !initial && data.routines.length > 0 && (
          <Field label="Start from a routine">
            <select defaultValue="" onChange={(event) => applyRoutine(event.target.value)}>
              <option value="">Choose routine</option>
              {data.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>
                  {routine.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-grid">
          <Field label={routineMode ? 'Routine name' : 'Workout name'} className="full">
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Upper body strength"
            />
          </Field>
          {!routineMode && (
            <>
              <Field label="Workout date">
                <input
                  required
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                />
              </Field>
              <Field label="Duration (minutes)">
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={draft.duration || ''}
                  onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}
                />
              </Field>
              <Field label="Calories burned (optional)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.calories ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      calories: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  placeholder="Not recorded"
                />
              </Field>
            </>
          )}
        </div>
        <div className="exercise-editor-list">
          {draft.exercises.map((exercise, exerciseIndex) => (
            <WorkoutExerciseEditor
              key={exercise.id}
              exercise={exercise}
              index={exerciseIndex}
              total={draft.exercises.length}
              onChange={(updated) => updateExercise(exerciseIndex, () => updated)}
              onMove={(direction) => move(exerciseIndex, direction)}
              onRemove={() =>
                setDraft({
                  ...draft,
                  exercises: draft.exercises.filter((item) => item.id !== exercise.id),
                })
              }
            />
          ))}
        </div>
        <div className="add-exercise-row">
          <Field label="Exercise">
            <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>
              <option value="">Choose an exercise</option>
              {data.exercises
                .filter((exercise) => !exercise.archived)
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
            </select>
          </Field>
          <button
            type="button"
            className="button secondary"
            disabled={!exerciseId}
            onClick={() => {
              const exercise = data.exercises.find((item) => item.id === exerciseId)!
              setDraft({
                ...draft,
                exercises: [
                  ...draft.exercises,
                  {
                    id: id(),
                    exerciseId,
                    name: exercise.name,
                    muscle: exercise.muscle,
                    notes: '',
                    sets: [{ id: id(), reps: 10, weight: 0 }],
                  },
                ],
              })
              setExerciseId('')
            }}
          >
            <Plus size={16} />
            Add exercise
          </button>
        </div>
        {!data.exercises.some((exercise) => !exercise.archived) && (
          <p className="muted">
            Your exercise library is empty.{' '}
            <Link to="/library" onClick={onClose}>
              Add an exercise
            </Link>
          </p>
        )}
        {!routineMode && (
          <Field label="Session notes">
            <textarea
              rows={2}
              maxLength={4000}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </Field>
        )}
        <FormFooter
          {...action}
          onClose={onClose}
          label={routineMode ? 'Save routine' : 'Save workout'}
        />
      </form>
    </Modal>
  )
}
