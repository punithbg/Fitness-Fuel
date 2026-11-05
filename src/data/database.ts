import Dexie, { type Table } from 'dexie'
import {
  type Category,
  type Exercise,
  type Food,
  type Goal,
  type Meal,
  type Routine,
  type Weight,
  type Workout,
} from '../domain'

export class FitnessDatabase extends Dexie {
  foods!: Table<Food, string>
  exercises!: Table<Exercise, string>
  categories!: Table<Category, string>
  meals!: Table<Meal, string>
  workouts!: Table<Workout, string>
  routines!: Table<Routine, string>
  goals!: Table<Goal, string>
  weights!: Table<Weight, string>
  meta!: Table<{ key: string; value: string }, string>
  constructor(databaseName = 'fitness-tracker') {
    super(databaseName)
    this.version(1).stores({
      foods: 'id, ownerId, name',
      exercises: 'id, ownerId, name',
      categories: 'id',
      meals: 'id, date, foodId, categoryId',
      workouts: 'id, date',
      routines: 'id, name',
      goals: 'id, &date',
      weights: 'id, &date',
      meta: 'key',
    })
    this.version(2)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table<Food>('foods')
          .toCollection()
          .modify((food) => {
            food.nutrients.sugar ??= 0
          })
        await transaction
          .table<Meal>('meals')
          .toCollection()
          .modify((meal) => {
            meal.nutrients.sugar ??= 0
            meal.basisNutrients.sugar ??= 0
          })
        await transaction
          .table<Goal>('goals')
          .toCollection()
          .modify((goal) => {
            goal.nutrients.sugar ??= 0
          })
      })
  }
}

export const db = new FitnessDatabase()
