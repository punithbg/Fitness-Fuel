import { format, parseISO, startOfWeek } from 'date-fns'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Database,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { FitnessData } from '../../data'
import { loadSampleData } from '../../data/demo/loadSampleData'
import {
  goalsForDate,
  inRange,
  nutrientKeys,
  nutrientLabels,
  summarizeNutrition,
} from '../../domain'
import { number, prettyDate, useAction } from '../../shared'
import { Empty, ErrorMessage, PageTitle, Stat } from '../../shared/ui'
import { NutritionChart } from '../progress'

export default function Dashboard({ data, date }: { data: FitnessData; date: string }) {
  const meals = data.meals
    .filter((meal) => meal.date === date)
    .sort((left, right) => {
      const leftOrder =
        data.categories.find((category) => category.id === left.categoryId)?.order ?? 999
      const rightOrder =
        data.categories.find((category) => category.id === right.categoryId)?.order ?? 999
      return leftOrder - rightOrder || left.time.localeCompare(right.time)
    })
  const workouts = data.workouts.filter((workout) => workout.date === date)
  const totals = summarizeNutrition(meals)
  const goals = goalsForDate(data.goals, date)
  const weekStart = format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekMeals = data.meals.filter((meal) => inRange(meal.date, weekStart, date))
  const weekWorkouts = data.workouts.filter((workout) => inRange(workout.date, weekStart, date))
  const weight = data.weights
    .filter((entry) => entry.date <= date)
    .sort((left, right) => right.date.localeCompare(left.date))[0]
  const burn = workouts.filter((workout) => workout.calories !== undefined)
  const action = useAction()
  const percentage = goals?.calories ? Math.min(100, (totals.calories / goals.calories) * 100) : 0
  const mealGroups = [
    ...new Map(meals.map((meal) => [meal.categoryId, meal.categoryName])).entries(),
  ]
  return (
    <>
      <PageTitle eyebrow={prettyDate(date)} title="Your daily overview">
        <Link className="button secondary" to="/workouts">
          <Dumbbell size={17} />
          Log workout
        </Link>
        <Link className="button" to="/food">
          <Plus size={17} />
          Log food
        </Link>
      </PageTitle>
      <ErrorMessage error={action.error} />
      {!data.meals.length && !data.workouts.length && (
        <div className="welcome-strip">
          <div>
            <h2>A fresh start.</h2>
            <span className="muted">No records yet.</span>
          </div>
          <Link className="button secondary" to="/library">
            <Plus size={17} />
            Build your library
          </Link>
          {!data.demoLoaded && (
            <button
              className="text-button"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Load fictional meals, workouts, and body measurements for testing?',
                  )
                )
                  void action.run(loadSampleData)
              }}
            >
              <Database size={16} />
              Load sample data
            </button>
          )}
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Food intake"
          value={number(totals.calories)}
          unit="kcal"
          detail={
            goals
              ? `${number(Math.max(0, goals.calories - totals.calories))} kcal remaining`
              : 'No daily target'
          }
        />
        <Stat
          label="Protein"
          value={number(totals.protein, 1)}
          unit="g"
          detail={goals ? `of ${number(goals.protein)} g target` : 'No daily target'}
          tone="coral"
        />
        <Stat
          label="Recorded gym burn"
          value={
            burn.length ? number(burn.reduce((sum, workout) => sum + workout.calories!, 0)) : '-'
          }
          unit="kcal"
          detail={`${burn.length} of ${workouts.length} sessions recorded`}
          tone="gold"
        />
        <Stat
          label="Body weight"
          value={weight ? number(weight.weight, 1) : '-'}
          unit="kg"
          detail={weight ? prettyDate(weight.date) : 'No measurements'}
          tone="blue"
        />
      </div>
      <div className="dashboard-columns">
        <section className="daily-nutrition">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Food & fuel</p>
              <h2>Daily nutrition</h2>
            </div>
            <Link className="subtle-link" to="/settings">
              Goals
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="nutrition-overview">
            <div
              className="calorie-ring"
              style={{
                background: `conic-gradient(var(--chart-green) ${percentage}%, var(--subtle-surface) 0)`,
              }}
            >
              <div>
                <Flame size={22} />
                <strong>{number(totals.calories)}</strong>
                <span>{goals ? `of ${number(goals.calories)} kcal` : 'kcal logged'}</span>
              </div>
            </div>
            <div className="nutrient-bars">
              {nutrientKeys
                .filter((key) => key !== 'calories')
                .map((key, index) => (
                  <div className={`nutrient-bar tone-${index}`} key={key}>
                    <div>
                      <span>
                        <i />
                        {nutrientLabels[key]}
                      </span>
                      <strong>
                        {number(totals[key], 1)}
                        <small> / {goals ? number(goals[key]) : '-'} g</small>
                      </strong>
                    </div>
                    <progress
                      aria-label={`${nutrientLabels[key]} goal progress`}
                      value={goals?.[key] ? Math.min(100, (totals[key] / goals[key]) * 100) : 0}
                      max={100}
                    />
                  </div>
                ))}
            </div>
          </div>
        </section>
        <section className="weekly-overview">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Consistency</p>
              <h2>This week</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          <div className="week-metrics">
            <div>
              <span className="tile-icon">
                <Utensils size={20} />
              </span>
              <strong>
                {new Set(weekMeals.map((meal) => meal.date)).size}
                <span>food days logged</span>
              </strong>
            </div>
            <div>
              <span className="tile-icon coral">
                <Dumbbell size={20} />
              </span>
              <strong>
                {weekWorkouts.length}
                <span>gym sessions</span>
              </strong>
            </div>
            <div>
              <span className="tile-icon blue">
                <Clock3 size={20} />
              </span>
              <strong>
                {weekWorkouts.reduce((sum, workout) => sum + workout.duration, 0)}
                <span>training minutes</span>
              </strong>
            </div>
          </div>
          <Link className="text-button" to="/progress">
            View progress
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="dashboard-chart report-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Week to date</p>
            <h2>Food intake</h2>
          </div>
          <span className="chart-legend">
            <i />
            Calories
          </span>
        </div>
        <NutritionChart meals={weekMeals} />
      </section>
      <div className="dashboard-columns lower">
        <section>
          <div className="section-heading">
            <h2>On your plate</h2>
            <Link className="subtle-link" to="/food">
              Food diary
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {mealGroups.length ? (
            mealGroups.map(([categoryId, categoryName], index) => {
              const entries = meals.filter((meal) => meal.categoryId === categoryId)
              return (
                <Link to="/food" className="meal-summary" key={categoryId}>
                  <span className={`meal-visual visual-${index % 3}`}>
                    <Utensils size={22} />
                  </span>
                  <div>
                    <h3>{categoryName}</h3>
                    <p>{entries.map((meal) => meal.foodName).join(', ')}</p>
                  </div>
                  <strong>
                    {number(summarizeNutrition(entries).calories)}
                    <small>kcal</small>
                  </strong>
                  <ArrowUpRight size={17} />
                </Link>
              )
            })
          ) : (
            <Empty title="No meals logged">
              <Link to="/food" className="text-button">
                <Plus size={16} />
                Add food
              </Link>
            </Empty>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>Training today</h2>
            <Link className="subtle-link" to="/workouts">
              Gym journal
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {workouts.length ? (
            workouts.map((workout) => (
              <Link to="/workouts" className="training-summary" key={workout.id}>
                <img className="training-image" src="/gym.jpg" alt="" width="60" height="80" />
                <div>
                  <h3>{workout.name}</h3>
                  <p>
                    {workout.exercises.length} exercises · {workout.duration} min
                  </p>
                  <span className="badge">
                    {workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)}{' '}
                    sets recorded
                  </span>
                </div>
                <ArrowUpRight size={17} />
              </Link>
            ))
          ) : (
            <Empty title="No workouts logged">
              <Link to="/workouts" className="text-button">
                <Plus size={16} />
                Log workout
              </Link>
            </Empty>
          )}
          <Link className="weight-link" to="/progress">
            <Scale size={19} />
            <span>Body measurements</span>
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </>
  )
}
