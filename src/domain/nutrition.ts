import { z } from 'zod'
import { base, dateSchema, name, nonnegative, positive } from './common'

export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar'] as const

export const nutrientLabels = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fiber',
  sugar: 'Sugar',
}

export const nutrientsSchema = z.object({
  calories: nonnegative,
  protein: nonnegative,
  carbs: nonnegative,
  fat: nonnegative,
  fiber: nonnegative,
  sugar: nonnegative.default(0),
})

export type Nutrients = z.infer<typeof nutrientsSchema>

export const zeroNutrients = (): Nutrients => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
})

export const foodSchema = z.object({
  ...base,
  name,
  category: z.string().max(80).optional(),
  preparation: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  source: z.string().max(500).optional(),
  unit: z.enum(['g', 'ml', 'serving']),
  basis: positive,
  servingName: z.string(),
  nutrients: nutrientsSchema,
  favorite: z.boolean(),
  archived: z.boolean(),
  servingSize: positive.optional(),
})

export type Food = z.infer<typeof foodSchema>

export const mealSchema = z.object({
  ...base,
  date: dateSchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  categoryId: z.string(),
  categoryName: name,
  foodId: z.string(),
  foodName: name,
  quantity: positive,
  unit: z.string(),
  basis: positive,
  basisNutrients: nutrientsSchema,
  nutrients: nutrientsSchema,
})

export type Meal = z.infer<typeof mealSchema>

export function calculateFoodNutrients(
  nutrients: z.input<typeof nutrientsSchema>,
  quantity: number,
  basis: number,
): Nutrients {
  const parsedNutrients = nutrientsSchema.parse(nutrients)
  positive.parse(quantity)
  positive.parse(basis)
  return nutrientsSchema.parse(
    Object.fromEntries(nutrientKeys.map((key) => [key, (parsedNutrients[key] * quantity) / basis])),
  )
}

export function summarizeNutrition(meals: Meal[]): Nutrients {
  return meals.reduce((total, meal) => {
    nutrientKeys.forEach((key) => {
      total[key] += meal.nutrients[key] ?? 0
    })
    return total
  }, zeroNutrients())
}

export function foodSnapshot(food: Food, quantity: number, useServing: boolean) {
  if (useServing && food.unit !== 'serving' && !food.servingSize)
    throw new Error('No serving equivalent is defined')
  const basis = useServing && food.unit !== 'serving' ? food.basis / food.servingSize! : food.basis
  return {
    foodId: food.id,
    foodName: food.name,
    quantity,
    unit: useServing || food.unit === 'serving' ? food.servingName || 'serving' : food.unit,
    basis,
    basisNutrients: nutrientsSchema.parse(food.nutrients),
    nutrients: calculateFoodNutrients(food.nutrients, quantity, basis),
  }
}
