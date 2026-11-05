import { describe, expect, it } from 'vitest'
import { foodSchema, stamp } from '../../domain'
import { createFoodDirectory, decodeFoodDirectory, foodJournal } from './foods'
import { createBackup, previewMerge } from './model'
import { starterFoods } from '../foods/starter'
import { decodeWorkbook, encodeWorkbook } from './workbook'

const food = foodSchema.parse({
  ...stamp(),
  name: 'Apple, raw',
  category: 'Fruit',
  preparation: 'Raw',
  notes: 'Edible portion only.',
  source: 'Reference estimate',
  unit: 'g',
  basis: 100,
  servingName: 'medium apple',
  servingSize: 182,
  favorite: false,
  archived: false,
  nutrients: { calories: 52, protein: 0.26, carbs: 13.81, fat: 0.17, fiber: 2.4, sugar: 10.39 },
})

describe('food directory backup', () => {
  it('ships a complete starter catalog with distinct preparations and explicit bone portions', () => {
    expect(starterFoods.length).toBeGreaterThanOrEqual(50)
    expect(foodJournal(starterFoods).foods).toHaveLength(starterFoods.length)
    for (const category of ['Fruit', 'Vegetable', 'Chicken', 'Fish', 'Mutton', 'Egg'])
      expect(starterFoods.some((entry) => entry.category === category)).toBe(true)
    for (const entry of starterFoods) {
      expect(entry.basis).toBe(100)
      expect(entry.unit).toBe('g')
      expect(Object.keys(entry.nutrients)).toHaveLength(6)
      if (entry.name.includes('bone-in')) expect(entry.notes).toContain('Exclude bones')
    }
  })

  it('preserves directory metadata in the full Excel backup', async () => {
    const backup = createBackup(foodJournal(starterFoods), { uid: 'alice' })
    expect((await decodeWorkbook(await encodeWorkbook(backup))).journal.foods).toEqual(starterFoods)
  })

  it('round trips every food field including archived records and serving equivalents', () => {
    const foods = [food, { ...food, id: 'archived-food', archived: true }]
    expect(decodeFoodDirectory(JSON.stringify(createFoodDirectory(foods))).foods).toEqual(foods)
  })

  it('contains no diary records and is included in a complete backup', () => {
    const journal = foodJournal([food])
    expect(journal.meals).toEqual([])
    expect(journal.workouts).toEqual([])
    expect(createBackup(journal, { uid: 'test' }).journal.foods).toEqual([food])
    expect(previewMerge(journal, foodJournal([food]))).toEqual({
      added: 0,
      skipped: 1,
      conflicts: [],
    })
    expect(
      previewMerge(journal, foodJournal([{ ...food, name: 'Edited apple' }])).conflicts,
    ).toHaveLength(1)
  })

  it('rejects invalid nutrients, duplicate identifiers and unrelated backups', () => {
    const directory = createFoodDirectory([food])
    expect(() =>
      decodeFoodDirectory(JSON.stringify({ ...directory, foods: [food, food] })),
    ).toThrow()
    expect(() =>
      createFoodDirectory([{ ...food, nutrients: { ...food.nutrients, calories: -1 } }]),
    ).toThrow()
    expect(() =>
      decodeFoodDirectory(JSON.stringify({ ...directory, format: 'form-and-fuel' })),
    ).toThrow()
    expect(() => decodeFoodDirectory('{')).toThrow()
  })
})
