import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { copyMeals, db, initialize, removeEntity, saveEntity } from './data'
import { FitnessDatabase } from './data/database'
import {
  calculateFoodNutrients,
  calculateWorkoutVolume,
  comparePeriods,
  dateSchema,
  foodSnapshot,
  nutrientsSchema,
  summarizeNutrition,
  goalsForDate,
  periodRange,
  stamp,
  workoutSchema,
  type Food,
  type Meal,
} from './domain'

const food: Food = {
  ...stamp(),
  name: 'Test food',
  unit: 'g',
  basis: 100,
  servingName: 'scoop',
  servingSize: 30,
  nutrients: { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2, sugar: 4 },
  favorite: false,
  archived: false,
}
afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
describe('nutrition snapshots', () => {
  it('scales all nutrients without premature rounding', () => {
    expect(calculateFoodNutrients(food.nutrients, 150, 100)).toEqual({
      calories: 300,
      protein: 15,
      carbs: 30,
      fat: 12,
      fiber: 3,
      sugar: 6,
    })
    expect(foodSnapshot(food, 0.5, true).nutrients.calories).toBeCloseTo(30)
    expect(foodSnapshot(food, 0.5, true).nutrients.sugar).toBeCloseTo(0.6)
    expect(foodSnapshot({ ...food, unit: 'ml' }, 250, false).nutrients.sugar).toBe(10)
    expect(foodSnapshot({ ...food, unit: 'serving', basis: 1 }, 2, false).nutrients.sugar).toBe(8)
    expect(foodSnapshot({ ...food, unit: 'ml' }, 250, false).nutrients.calories).toBe(500)
    expect(foodSnapshot({ ...food, unit: 'serving', basis: 1 }, 2, false).nutrients.calories).toBe(
      400,
    )
  })
  it('rejects invalid quantities and undefined conversions', () => {
    expect(() => calculateFoodNutrients({ ...food.nutrients, sugar: -1 }, 100, 100)).toThrow()
    expect(() => calculateFoodNutrients(food.nutrients, -1, 100)).toThrow()
    expect(() => calculateFoodNutrients(food.nutrients, Infinity, 100)).toThrow()
    expect(() => foodSnapshot({ ...food, servingSize: undefined }, 1, true)).toThrow()
  })
  it('keeps historical values after catalog edits and archive, and copies independently', async () => {
    await saveEntity('foods', food)
    const meal: Meal = {
      ...stamp(),
      date: '2026-11-02',
      time: '08:00',
      categoryId: 'breakfast',
      categoryName: 'Breakfast',
      ...foodSnapshot(food, 150, false),
    }
    await saveEntity('meals', meal)
    await saveEntity('foods', {
      ...food,
      name: 'Changed',
      nutrients: { ...food.nutrients, calories: 1, sugar: 0 },
    })
    await removeEntity('foods', food.id)
    expect((await db.meals.get(meal.id))?.nutrients.calories).toBe(300)
    expect((await db.meals.get(meal.id))?.nutrients.sugar).toBe(6)
    await copyMeals([meal], '2026-11-03')
    const copied = await db.meals.where('date').equals('2026-11-03').first()
    expect(copied?.id).not.toBe(meal.id)
    expect(copied?.foodName).toBe('Test food')
    expect(copied?.nutrients.sugar).toBe(6)
    expect(summarizeNutrition([meal, copied!]).sugar).toBe(12)
    db.close()
    await db.open()
    expect(await db.meals.count()).toBe(2)
  })
  it('defaults missing legacy sugar values to zero', () => {
    const legacy = { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 }
    expect(nutrientsSchema.parse(legacy).sugar).toBe(0)
    expect(calculateFoodNutrients(legacy, 150, 100).sugar).toBe(0)
    expect(summarizeNutrition([]).sugar).toBe(0)
  })
  it('upgrades legacy foods, meal snapshots and goals without changing recorded values', async () => {
    const databaseName = `sugar-upgrade-${stamp().id}`
    const legacy = new Dexie(databaseName)
    legacy.version(1).stores({
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
    const upgraded = new FitnessDatabase(databaseName)
    const nutrients = { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 }
    const oldFood = { ...food, nutrients }
    const oldMeal = {
      ...stamp(),
      date: '2026-11-02',
      time: '08:00',
      categoryId: 'breakfast',
      categoryName: 'Breakfast',
      ...foodSnapshot(food, 150, false),
      nutrients: { ...nutrients, calories: 300 },
      basisNutrients: nutrients,
    }
    const oldGoal = { ...stamp(), date: '2026-11-02', nutrients }
    const recordedFood = { ...food, id: stamp().id }
    try {
      await legacy.table('foods').bulkAdd([oldFood, recordedFood])
      await legacy.table('meals').add(oldMeal)
      await legacy.table('goals').add(oldGoal)
      legacy.close()
      await upgraded.open()
      expect(await upgraded.foods.get(oldFood.id)).toEqual({
        ...oldFood,
        nutrients: { ...nutrients, sugar: 0 },
      })
      expect(await upgraded.foods.get(recordedFood.id)).toEqual(recordedFood)
      expect(await upgraded.meals.get(oldMeal.id)).toEqual({
        ...oldMeal,
        nutrients: { ...oldMeal.nutrients, sugar: 0 },
        basisNutrients: { ...nutrients, sugar: 0 },
      })
      expect(await upgraded.goals.get(oldGoal.id)).toEqual({
        ...oldGoal,
        nutrients: { ...nutrients, sugar: 0 },
      })
    } finally {
      legacy.close()
      upgraded.close()
      await Dexie.delete(databaseName)
    }
  })
})
describe('workouts and dates', () => {
  it('calculates external-load volume and validates optional effort', () => {
    const exercises = [
      {
        id: '1',
        exerciseId: '1',
        name: 'Press',
        muscle: 'Chest',
        notes: '',
        sets: [
          { id: '1', reps: 10, weight: 20 },
          { id: '2', reps: 8, weight: 25 },
        ],
      },
    ]
    expect(calculateWorkoutVolume(exercises)).toBe(400)
    const workout = {
      ...stamp(),
      name: 'Workout',
      date: '2026-11-02',
      duration: 45,
      notes: '',
      exercises,
    }
    expect(workoutSchema.parse(workout).calories).toBeUndefined()
    expect(
      workoutSchema.safeParse({
        ...workout,
        exercises: [{ ...exercises[0], sets: [{ id: '1', reps: 10, weight: 20, rpe: 11 }] }],
      }).success,
    ).toBe(false)
  })
  it('uses Monday weeks and clamps incomplete and previous months', () => {
    expect(periodRange('week', '2026-11-01', '', '', '', '2026-11-02')).toMatchObject({
      start: '2026-10-26',
      end: '2026-11-01',
    })
    expect(periodRange('week', '2026-11-02', '', '', '', '2026-11-03')).toMatchObject({
      start: '2026-11-02',
      end: '2026-11-03',
      previousStart: '2026-10-26',
      previousEnd: '2026-10-27',
    })
    expect(periodRange('month', '2024-03-30', '', '', '', '2024-03-30').previousEnd).toBe(
      '2024-02-29',
    )
    expect(periodRange('month', '2026-02-01', '', '', '', '2026-11-02').previousEnd).toBe(
      '2026-01-31',
    )
    expect(periodRange('custom', '', '2026-12-30', '2027-01-02', '').previousEnd).toBe('2026-12-29')
    expect(() => periodRange('custom', '', '2026-11-03', '2026-11-01', '')).toThrow()
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false)
    expect(comparePeriods(100, 0)).toBeNull()
  })
  it('initializes once and applies goals prospectively', async () => {
    await initialize()
    await initialize()
    expect(await db.categories.count()).toBe(4)
    const goals = [{ ...stamp(), date: '2026-11-02', nutrients: food.nutrients }]
    expect(goalsForDate(goals, '2026-11-01')).toBeUndefined()
    expect(goalsForDate(goals, '2026-11-02')?.calories).toBe(200)
  })
})
