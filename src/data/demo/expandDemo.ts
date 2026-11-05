import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import {
  dateSchema,
  foodSnapshot,
  goalSchema,
  mealSchema,
  routineSchema,
  stamp,
  weightSchema,
  workoutSchema,
  type SessionExercise,
} from '../../domain'
import { emptyJournal, type Journal } from '../schemas'
import { fixtureSchema, type DemoFixture } from './fixture'

export function expandDemo(
  input: DemoFixture,
  endDate: string,
  existing: Pick<Journal, 'categories' | 'goals' | 'weights'>,
) {
  const fixture = fixtureSchema.parse(input)
  dateSchema.parse(endDate)
  const shift = differenceInCalendarDays(parseISO(endDate), parseISO(fixture.endDate))
  const shiftedDate = (date: string) => format(addDays(parseISO(date), shift), 'yyyy-MM-dd')
  const record = (key: string) => ({ ...stamp(), id: `demo-${fixture.version}-${key}` })
  const journal = emptyJournal()
  journal.foods = fixture.foods.map((food) => ({
    ...food,
    ...record(`food-${food.id}`),
    archived: false,
  }))
  journal.exercises = fixture.exercises.map((exercise) => ({
    ...exercise,
    ...record(`exercise-${exercise.id}`),
    archived: false,
  }))
  const makeExercises = (routineId: string, prefix: string, adjustment = 0): SessionExercise[] => {
    const routine = fixture.routines.find((routine) => routine.id === routineId)!
    return routine.exercises.map((template, exerciseIndex) => {
      const exercise = journal.exercises.find(
        (exercise) => exercise.id === record(`exercise-${template.exerciseId}`).id,
      )!
      return {
        id: record(`${prefix}-exercise-${exerciseIndex}`).id,
        exerciseId: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        notes: '',
        sets: template.sets.map((set, setIndex) => ({
          ...set,
          id: record(`${prefix}-${exerciseIndex}-set-${setIndex}`).id,
          weight: set.weight + adjustment,
        })),
      }
    })
  }
  journal.routines = fixture.routines.map((routine) =>
    routineSchema.parse({
      ...record(`routine-${routine.id}`),
      name: routine.name,
      exercises: makeExercises(routine.id, `routine-${routine.id}`),
    }),
  )
  const categories = [...existing.categories]
  for (const [order, name] of ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].entries()) {
    if (!categories.some((category) => !category.archived && category.name === name)) {
      const category = { ...record(`category-${name}`), name, order, archived: false }
      journal.categories.push(category)
      categories.push(category)
    }
  }
  for (const day of fixture.days) {
    const date = shiftedDate(day.date)
    journal.meals.push(
      ...fixture.mealPlans[day.mealPlan].map((entry, index) => {
        const food = journal.foods.find((food) => food.id === record(`food-${entry.foodId}`).id)!
        const category = categories.find(
          (category) => !category.archived && category.name === entry.category,
        )!
        return mealSchema.parse({
          ...record(`meal-${day.date}-${index}`),
          date,
          time: entry.time,
          categoryId: category.id,
          categoryName: category.name,
          ...foodSnapshot(food, entry.quantity, entry.useServing ?? false),
        })
      }),
    )
    if (day.workout) {
      const workout = day.workout
      const routine = fixture.routines.find((routine) => routine.id === workout.routineId)!
      journal.workouts.push(
        workoutSchema.parse({
          ...record(`workout-${day.date}`),
          date,
          name: routine.name,
          duration: workout.duration,
          calories: workout.calories,
          notes: workout.notes,
          exercises: makeExercises(workout.routineId, day.date, workout.loadAdjustment),
        }),
      )
    }
    if (!existing.weights.some((weight) => weight.date === date))
      journal.weights.push(
        weightSchema.parse({ ...record(`weight-${day.date}`), date, weight: day.weight }),
      )
  }
  if (!existing.goals.length)
    journal.goals.push(
      goalSchema.parse({
        ...record('goals'),
        date: shiftedDate(fixture.startDate),
        nutrients: fixture.goals,
      }),
    )
  return journal
}
