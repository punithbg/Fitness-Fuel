import { format, parseISO, startOfMonth } from 'date-fns'
import { Pencil, Scale, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { removeEntity, type FitnessData } from '../../data'
import {
  calculateWorkoutVolume,
  comparePeriods,
  inRange,
  nutrientKeys,
  nutrientLabels,
  periodRange,
  summarizeNutrition,
  today,
  type Period,
  type Weight,
} from '../../domain'
import { number, prettyDate, useAction } from '../../shared'
import { NutritionChart, TrendChart } from '../../shared/charts/FitnessCharts'
import { AddButton, ErrorMessage, Field, IconButton, PageTitle, Stat } from '../../shared/ui'
import { WeightEditor } from './components/WeightEditor'

export default function Progress({ data, date }: { data: FitnessData; date: string }) {
  const [period, setPeriod] = useState<Period>('week')
  const [start, setStart] = useState(format(startOfMonth(parseISO(date)), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(date)
  const [metric, setMetric] = useState<(typeof nutrientKeys)[number]>('calories')
  const [exerciseId, setExerciseId] = useState('')
  const [exerciseMetric, setExerciseMetric] = useState<'volume' | 'weight' | 'reps'>('weight')
  const [weightEditor, setWeightEditor] = useState<Weight | 'new' | null>(null)
  const action = useAction()
  const earliest =
    [...data.meals, ...data.workouts, ...data.weights].map((item) => item.date).sort()[0] ?? today()
  let range: ReturnType<typeof periodRange> | undefined
  let rangeError = ''
  try {
    range = periodRange(period, date, start, end, earliest)
  } catch (error) {
    rangeError = error instanceof Error ? error.message : 'Invalid dates'
  }
  const meals = range ? data.meals.filter((meal) => inRange(meal.date, range.start, range.end)) : []
  const workouts = range
    ? data.workouts.filter((workout) => inRange(workout.date, range.start, range.end))
    : []
  const weights = range
    ? data.weights
        .filter((weight) => inRange(weight.date, range.start, range.end))
        .sort((left, right) => left.date.localeCompare(right.date))
    : []
  const previousMeals = range
    ? data.meals.filter((meal) => inRange(meal.date, range.previousStart, range.previousEnd))
    : []
  const previousWorkouts = range
    ? data.workouts.filter((workout) =>
        inRange(workout.date, range.previousStart, range.previousEnd),
      )
    : []
  const days = new Set(meals.map((meal) => meal.date)).size
  const previousDays = new Set(previousMeals.map((meal) => meal.date)).size
  const average = days ? summarizeNutrition(meals).calories / days : 0
  const change = previousDays
    ? comparePeriods(average, summarizeNutrition(previousMeals).calories / previousDays)
    : null
  const exerciseOptions = [
    ...new Map(
      data.workouts
        .flatMap((workout) => workout.exercises)
        .map((exercise) => [exercise.exerciseId, exercise.name]),
    ).entries(),
  ]
  const selectedExercise = exerciseId || exerciseOptions[0]?.[0] || ''
  const exercisePoints = workouts
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((workout) => {
      const exercises = workout.exercises.filter(
        (exercise) => exercise.exerciseId === selectedExercise,
      )
      if (!exercises.length) return []
      const sets = exercises.flatMap((exercise) => exercise.sets)
      return [
        {
          date: workout.date,
          value:
            exerciseMetric === 'volume'
              ? calculateWorkoutVolume(exercises)
              : Math.max(
                  ...sets.map((set) => (exerciseMetric === 'weight' ? set.weight : set.reps)),
                ),
        },
      ]
    })
  const recordedBurn = workouts.filter((workout) => workout.calories !== undefined)
  return (
    <>
      <PageTitle eyebrow="The bigger picture" title="Progress">
        <AddButton onClick={() => setWeightEditor('new')}>Log weight</AddButton>
      </PageTitle>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Report period">
          {(['week', 'month', 'custom', 'all'] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={period === value}
              onClick={() => setPeriod(value)}
            >
              {value === 'all' ? 'All time' : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="date-range">
            <Field label="From">
              <input
                required
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="To">
              <input
                required
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
        )}
      </div>
      <ErrorMessage error={rangeError || action.error} />
      {range && (
        <p className="range-caption">
          {prettyDate(range.start)} - {prettyDate(range.end)}
          {period !== 'all' && (
            <span>
              {' '}
              · compared with {prettyDate(range.previousStart)} - {prettyDate(range.previousEnd)}
            </span>
          )}
        </p>
      )}
      <div className="stats-grid">
        <Stat
          label="Average food intake"
          value={days ? number(average) : '-'}
          unit="kcal"
          detail={`${days} logged days${period !== 'all' && days ? ` · ${change === null ? 'No baseline' : `${change > 0 ? '+' : ''}${number(change, 1)}%`}` : ''}`}
        />
        <Stat
          label="Workouts"
          value={workouts.length}
          detail={
            period !== 'all'
              ? `${previousWorkouts.length} in previous period`
              : `${workouts.reduce((total, workout) => total + workout.duration, 0)} minutes`
          }
          tone="coral"
        />
        <Stat
          label="Recorded gym burn"
          value={
            recordedBurn.length
              ? number(recordedBurn.reduce((total, workout) => total + workout.calories!, 0))
              : '-'
          }
          unit="kcal"
          detail={`${recordedBurn.length} of ${workouts.length} sessions recorded`}
          tone="gold"
        />
        <Stat
          label="Latest body weight"
          value={weights.length ? number(weights.at(-1)!.weight, 1) : '-'}
          unit="kg"
          detail={
            weights.length > 1
              ? `${number(weights.at(-1)!.weight - weights[0].weight, 1)} kg from first record`
              : `${weights.length} measurements`
          }
          tone="blue"
        />
      </div>
      <section className="report-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nutrition</p>
            <h2>Daily intake</h2>
          </div>
          <select
            aria-label="Nutrition chart metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value as typeof metric)}
          >
            {nutrientKeys.map((key) => (
              <option value={key} key={key}>
                {nutrientLabels[key]}
              </option>
            ))}
          </select>
        </div>
        <NutritionChart meals={meals} metric={metric} />
        <div className="nutrition-totals">
          {nutrientKeys.map((key) => (
            <span key={key}>
              {nutrientLabels[key]}{' '}
              <strong>
                {number(summarizeNutrition(meals)[key], 1)} {key === 'calories' ? 'kcal' : 'g'}
              </strong>
            </span>
          ))}
        </div>
      </section>
      <section className="report-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Strength</p>
            <h2>Exercise progress</h2>
          </div>
          <div className="report-selects">
            <select
              aria-label="Progress exercise"
              value={selectedExercise}
              onChange={(event) => setExerciseId(event.target.value)}
            >
              {!exerciseOptions.length && <option value="">No exercises logged</option>}
              {exerciseOptions.map(([exerciseId, name]) => (
                <option key={exerciseId} value={exerciseId}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Exercise chart metric"
              value={exerciseMetric}
              onChange={(event) => setExerciseMetric(event.target.value as typeof exerciseMetric)}
            >
              <option value="weight">Maximum load (kg)</option>
              <option value="reps">Maximum reps</option>
              <option value="volume">External-load volume (kg)</option>
            </select>
          </div>
        </div>
        <TrendChart
          points={exercisePoints}
          metric={
            exerciseMetric === 'volume'
              ? 'External-load volume'
              : exerciseMetric === 'weight'
                ? 'Maximum load'
                : 'Maximum reps'
          }
          unit={exerciseMetric === 'reps' ? 'reps' : 'kg'}
          color="var(--coral)"
        />
      </section>
      <section className="report-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Body</p>
            <h2>Weight trend</h2>
          </div>
          <Scale size={22} />
        </div>
        <TrendChart
          points={weights.map((weight) => ({ date: weight.date, value: weight.weight }))}
          metric="Body weight"
          unit="kg"
          color="var(--blue)"
        />
        {weights.length > 0 && (
          <details className="weight-history">
            <summary>Measurements ({weights.length})</summary>
            {[...weights].reverse().map((weight) => (
              <div className="list-row" key={weight.id}>
                <span>{prettyDate(weight.date)}</span>
                <strong>{number(weight.weight, 1)} kg</strong>
                <div className="row-actions">
                  <IconButton
                    label={`Edit weight ${weight.date}`}
                    onClick={() => setWeightEditor(weight)}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Delete weight ${weight.date}`}
                    onClick={() => {
                      if (window.confirm('Delete this weight measurement?'))
                        void action.run(() => removeEntity('weights', weight.id))
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            ))}
          </details>
        )}
      </section>
      {weightEditor && (
        <WeightEditor
          data={data}
          date={date}
          initial={weightEditor === 'new' ? undefined : weightEditor}
          onClose={() => setWeightEditor(null)}
        />
      )}
    </>
  )
}
