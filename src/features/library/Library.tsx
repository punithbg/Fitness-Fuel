import { Apple, Dumbbell, ListChecks, Pencil, Search, Star, Trash2 } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { removeEntity, saveEntity, type FitnessData } from '../../data'
import {
  nutrientKeys,
  nutrientLabels,
  today,
  type Exercise,
  type Food,
  type Routine,
} from '../../domain'
import { number, useAction } from '../../shared'
import { AddButton, Empty, ErrorMessage, IconButton, PageTitle } from '../../shared/ui'
import { WorkoutEditor } from '../workouts'
import { ExerciseEditor } from './components/ExerciseEditor'
import { FoodEditor } from './components/FoodEditor'

export default function Library({ data }: { data: FitnessData }) {
  const [tab, setTab] = useState<'foods' | 'exercises' | 'routines'>('foods')
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.toLowerCase().trim())
  const [favorites, setFavorites] = useState(false)
  const [foodEditor, setFoodEditor] = useState<Food | 'new' | null>(null)
  const [exerciseEditor, setExerciseEditor] = useState<Exercise | 'new' | null>(null)
  const [routineEditor, setRoutineEditor] = useState<Routine | 'new' | null>(null)
  const action = useAction()
  const foods = data.foods
    .filter(
      (food) =>
        !food.archived && food.name.toLowerCase().includes(query) && (!favorites || food.favorite),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
  const exercises = data.exercises
    .filter(
      (exercise) =>
        !exercise.archived && `${exercise.name} ${exercise.muscle}`.toLowerCase().includes(query),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
  const routines = data.routines.filter((routine) => routine.name.toLowerCase().includes(query))
  const add = () =>
    tab === 'foods'
      ? setFoodEditor('new')
      : tab === 'exercises'
        ? setExerciseEditor('new')
        : setRoutineEditor('new')
  return (
    <>
      <PageTitle eyebrow="Your essentials" title="Library">
        <AddButton onClick={add}>
          {tab === 'foods' ? 'New food' : tab === 'exercises' ? 'New exercise' : 'New routine'}
        </AddButton>
      </PageTitle>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Library category">
          {(
            [
              { key: 'foods', label: 'Foods', Icon: Apple },
              { key: 'exercises', label: 'Exercises', Icon: Dumbbell },
              { key: 'routines', label: 'Routines', Icon: ListChecks },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              role="tab"
              aria-selected={tab === key}
              key={key}
              onClick={() => {
                setTab(key)
                setSearch('')
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search library"
            placeholder="Search library"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {tab === 'foods' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={favorites}
              onChange={(event) => setFavorites(event.target.checked)}
            />
            Favorites
          </label>
        )}
      </div>
      <ErrorMessage error={action.error} />
      {tab === 'foods' && (
        <div className="catalog-grid">
          {foods.map((food) => (
            <article className="catalog-card" key={food.id}>
              <div className="section-heading">
                <span className="tile-icon">
                  <Apple size={22} />
                </span>
                <div className="row-actions">
                  <IconButton
                    label={`${food.favorite ? 'Unfavorite' : 'Favorite'} ${food.name}`}
                    onClick={() => {
                      void action.run(() =>
                        saveEntity('foods', { ...food, favorite: !food.favorite }),
                      )
                    }}
                  >
                    <Star size={17} fill={food.favorite ? 'currentColor' : 'none'} />
                  </IconButton>
                  <IconButton label={`Edit ${food.name}`} onClick={() => setFoodEditor(food)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Archive ${food.name}`}
                    onClick={() => {
                      if (window.confirm(`Archive ${food.name}? Past logs will be kept.`))
                        void action.run(() => removeEntity('foods', food.id))
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
              <h3>{food.name}</h3>
              <p className="muted">
                Per {food.basis} {food.unit === 'serving' ? food.servingName : food.unit}
              </p>
              <div className="catalog-calories">
                {number(food.nutrients.calories)} <span>kcal</span>
              </div>
              <div className="macro-list">
                {nutrientKeys
                  .filter((key) => key !== 'calories')
                  .map((key) => (
                    <span key={key}>
                      {nutrientLabels[key]}
                      <strong>{number(food.nutrients[key], 1)} g</strong>
                    </span>
                  ))}
              </div>
              {food.servingSize && (
                <p className="serving-equivalent">
                  1 {food.servingName || 'serving'} = {food.servingSize} {food.unit}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === 'exercises' && (
        <div className="catalog-grid">
          {exercises.map((exercise) => (
            <article className="catalog-card" key={exercise.id}>
              <div className="section-heading">
                <span className="tile-icon coral">
                  <Dumbbell size={22} />
                </span>
                <div className="row-actions">
                  <IconButton
                    label={`Edit ${exercise.name}`}
                    onClick={() => setExerciseEditor(exercise)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Archive ${exercise.name}`}
                    onClick={() => {
                      if (window.confirm(`Archive ${exercise.name}? Past workouts will be kept.`))
                        void action.run(() => removeEntity('exercises', exercise.id))
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
              <h3>{exercise.name}</h3>
              <span className="badge">{exercise.muscle}</span>
              {exercise.notes && <p className="muted">{exercise.notes}</p>}
            </article>
          ))}
        </div>
      )}
      {tab === 'routines' && (
        <div className="catalog-grid">
          {routines.map((routine) => (
            <article className="catalog-card" key={routine.id}>
              <div className="section-heading">
                <span className="tile-icon gold">
                  <ListChecks size={22} />
                </span>
                <div className="row-actions">
                  <IconButton
                    label={`Edit ${routine.name}`}
                    onClick={() => setRoutineEditor(routine)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Delete ${routine.name}`}
                    onClick={() => {
                      if (window.confirm('Delete this routine? Saved workouts will be kept.'))
                        void action.run(() => removeEntity('routines', routine.id))
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
              <h3>{routine.name}</h3>
              <p className="muted">
                {routine.exercises.length} exercises ·{' '}
                {routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets
              </p>
              <ul className="routine-exercises">
                {routine.exercises.map((exercise) => (
                  <li key={exercise.id}>
                    {exercise.name}
                    <span>{exercise.sets.length} sets</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {(tab === 'foods'
        ? !foods.length
        : tab === 'exercises'
          ? !exercises.length
          : !routines.length) && (
        <Empty title={search ? 'No matches' : `No ${tab} yet`}>
          <AddButton onClick={add}>
            {tab === 'foods' ? 'New food' : tab === 'exercises' ? 'New exercise' : 'New routine'}
          </AddButton>
        </Empty>
      )}
      {foodEditor && (
        <FoodEditor
          food={foodEditor === 'new' ? undefined : foodEditor}
          onClose={() => setFoodEditor(null)}
        />
      )}
      {exerciseEditor && (
        <ExerciseEditor
          exercise={exerciseEditor === 'new' ? undefined : exerciseEditor}
          onClose={() => setExerciseEditor(null)}
        />
      )}
      {routineEditor && (
        <WorkoutEditor
          routineMode
          data={data}
          date={today()}
          initial={routineEditor === 'new' ? undefined : routineEditor}
          onClose={() => setRoutineEditor(null)}
        />
      )}
    </>
  )
}
