import { z } from 'zod'
import { foodSchema, type Food } from '../../domain'
import { emptyJournal } from '../schemas'
import { MAX_BACKUP_BYTES, validateJournal } from './model'

const directorySchema = z
  .object({
    format: z.literal('form-and-fuel-foods'),
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    foods: z.array(foodSchema).max(50_000),
  })
  .strict()

export type FoodDirectory = z.infer<typeof directorySchema>

export function foodJournal(foods: Food[]) {
  return validateJournal({ ...emptyJournal(), foods })
}

export function createFoodDirectory(foods: Food[]): FoodDirectory {
  return directorySchema.parse({
    format: 'form-and-fuel-foods',
    version: 1,
    exportedAt: new Date().toISOString(),
    foods: foodJournal(foods).foods,
  })
}

export function decodeFoodDirectory(text: string): FoodDirectory {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('Choose a food directory no larger than 20 MB.')
  const directory = directorySchema.parse(JSON.parse(text))
  foodJournal(directory.foods)
  return directory
}
