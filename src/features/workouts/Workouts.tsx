import { Clock3, Copy, Dumbbell, Flame, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { removeEntity, saveEntity, type FitnessData } from '../../data'
import { calculateWorkoutVolume, stamp, type Workout } from '../../domain'
import { number, prettyDate, useAction } from '../../shared'
import { AddButton, Empty, ErrorMessage, IconButton, PageTitle } from '../../shared/ui'
import { WorkoutEditor } from './components/WorkoutEditor'

export default function Workouts({ data, date }: { data: FitnessData; date: string }) {
  const [editor, setEditor] = useState<Workout | 'new' | null>(null)
  const action = useAction()
  const sessions = data.workouts.filter((workout) => workout.date === date)
  return (
    <>
      <PageTitle eyebrow="Training journal" title="Workouts">
        <AddButton onClick={() => setEditor('new')}>Log workout</AddButton>
      </PageTitle>
      <div className="section-heading">
        <h2>{prettyDate(date)}</h2>
        <span className="muted">{sessions.length} sessions</span>
      </div>
      <ErrorMessage error={action.error} />
      {!sessions.length && (
        <Empty icon={<Dumbbell />} title="No workouts recorded">
          <AddButton onClick={() => setEditor('new')}>Log workout</AddButton>
        </Empty>
      )}
      <div className="workout-list">
        {sessions.map((workout) => (
          <article className="workout-card" key={workout.id}>
            <div className="section-heading">
              <div className="icon-heading">
                <span className="tile-icon">
                  <Dumbbell size={23} />
                </span>
                <div>
                  <h2>{workout.name}</h2>
                  <span className="muted">
                    {workout.exercises.length} exercises ·{' '}
                    {workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)}{' '}
                    sets
                  </span>
                </div>
              </div>
              <div className="row-actions">
                <IconButton label={`Edit ${workout.name}`} onClick={() => setEditor(workout)}>
                  <Pencil size={17} />
                </IconButton>
                <IconButton
                  label={`Save ${workout.name} as routine`}
                  onClick={() => {
                    if (window.confirm(`Save ${workout.name} as a reusable routine?`))
                      void action.run(() =>
                        saveEntity('routines', {
                          ...stamp(),
                          name: workout.name,
                          exercises: structuredClone(workout.exercises),
                        }),
                      )
                  }}
                >
                  <Copy size={17} />
                </IconButton>
                <IconButton
                  label={`Delete ${workout.name}`}
                  onClick={() => {
                    if (window.confirm('Delete this workout?'))
                      void action.run(() => removeEntity('workouts', workout.id))
                  }}
                >
                  <Trash2 size={17} />
                </IconButton>
              </div>
            </div>
            <div className="workout-meta">
              <span>
                <Clock3 size={16} />
                {workout.duration} min
              </span>
              <span>
                <Flame size={16} />
                {workout.calories === undefined
                  ? 'Burn not recorded'
                  : `${number(workout.calories)} kcal recorded`}
              </span>
              <span>{number(calculateWorkoutVolume(workout.exercises))} kg volume</span>
            </div>
            {workout.exercises.map((exercise) => (
              <div className="logged-exercise" key={exercise.id}>
                <div>
                  <h3>{exercise.name}</h3>
                  <span className="muted">{exercise.muscle}</span>
                  {exercise.notes && <p>{exercise.notes}</p>}
                </div>
                <div className="set-chips">
                  {exercise.sets.map((set, index) => (
                    <span key={set.id}>
                      <small>{index + 1}</small>
                      {set.reps} × {set.weight} kg{set.rpe !== undefined && <em>RPE {set.rpe}</em>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {workout.notes && <p className="workout-notes">{workout.notes}</p>}
          </article>
        ))}
      </div>
      {editor && (
        <WorkoutEditor
          data={data}
          date={date}
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
