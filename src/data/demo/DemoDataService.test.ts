import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { db, initialize, saveEntity } from '..'
import { stamp, zeroNutrients } from '../../domain'
import { demoDataService } from './DemoDataService'
import { demoFixture } from './fixture'

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})
it('imports exactly fourteen consecutive days, eight workouts, and preserves unknown burn', async () => {
  await initialize()
  await db.meta.put({ key: 'demo', value: '1' })
  expect(await demoDataService.load('2026-11-02')).toBe(true)
  const dates = [...new Set((await db.meals.toArray()).map((meal) => meal.date))].sort()
  expect(dates).toHaveLength(14)
  expect(dates[0]).toBe('2026-10-20')
  expect(dates.at(-1)).toBe('2026-11-02')
  expect(await db.workouts.count()).toBe(8)
  expect(await db.weights.count()).toBe(14)
  expect((await db.foods.where('name').equals('Whole milk').first())?.nutrients.sugar).toBe(5)
  const milkMeals = (await db.meals.toArray()).filter((meal) => meal.foodName === 'Whole milk')
  expect(milkMeals.length).toBeGreaterThan(0)
  expect(milkMeals.every((meal) => meal.nutrients.sugar === 12.5)).toBe(true)
  expect((await db.goals.toArray())[0].nutrients.sugar).toBe(60)
  expect(
    (await db.workouts.toArray()).filter((workout) => workout.calories === undefined),
  ).toHaveLength(1)
  const count = await db.meals.count()
  expect(await demoDataService.load()).toBe(false)
  expect(await db.meals.count()).toBe(count)
})
it('rebases the fixture and preserves existing measurements and targets', async () => {
  await initialize()
  const weight = { ...stamp(), date: '2027-01-02', weight: 90 }
  const goal = { ...stamp(), date: '2026-01-01', nutrients: { ...zeroNutrients(), calories: 2500 } }
  await saveEntity('weights', weight)
  await saveEntity('goals', goal)
  await demoDataService.load('2027-01-02')
  expect(await db.weights.get(weight.id)).toMatchObject({ weight: 90 })
  expect(await db.goals.count()).toBe(1)
  expect((await db.goals.get(goal.id))?.nutrients.calories).toBe(2500)
  const dates = (await db.meals.toArray()).map((meal) => meal.date).sort()
  expect(dates[0]).toBe('2026-12-20')
  expect(dates.at(-1)).toBe('2027-01-02')
})
it('rejects invalid fixture references before writing anything', async () => {
  const invalid = structuredClone(demoFixture)
  invalid.days[0].mealPlan = 'missing'
  await expect(demoDataService.load('2026-11-02', invalid)).rejects.toThrow()
  expect(await db.meals.count()).toBe(0)
  expect(await db.foods.count()).toBe(0)
})
