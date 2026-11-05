import { addDays, format, parseISO } from 'date-fns'
import { z } from 'zod'
import source from '../../../public/data/two-week-demo.json'
import { dateSchema, exerciseSchema, foodSchema, nutrientsSchema, setSchema } from '../../domain'

const templateSchema = z.object({
  exerciseId: z.string(),
  sets: z.array(setSchema.omit({ id: true })).min(1),
})
export const fixtureSchema = z
  .object({
    version: z.literal('two-week-v1'),
    description: z.string(),
    startDate: dateSchema,
    endDate: dateSchema,
    goals: nutrientsSchema,
    foods: z.array(foodSchema.omit({ ownerId: true, updatedAt: true, archived: true })),
    exercises: z.array(exerciseSchema.omit({ ownerId: true, updatedAt: true, archived: true })),
    routines: z.array(
      z.object({ id: z.string(), name: z.string(), exercises: z.array(templateSchema).min(1) }),
    ),
    mealPlans: z.record(
      z.string(),
      z
        .array(
          z.object({
            category: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']),
            time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            foodId: z.string(),
            quantity: z.number().positive(),
            useServing: z.boolean().optional(),
          }),
        )
        .min(1),
    ),
    days: z
      .array(
        z.object({
          date: dateSchema,
          mealPlan: z.string(),
          weight: z.number().positive(),
          workout: z
            .object({
              routineId: z.string(),
              duration: z.number().positive(),
              calories: z.number().nonnegative().optional(),
              loadAdjustment: z.number().nonnegative(),
              notes: z.string(),
            })
            .optional(),
        }),
      )
      .length(14),
  })
  .superRefine((fixture, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message })
    for (const collection of [fixture.foods, fixture.exercises, fixture.routines]) {
      if (new Set(collection.map((item) => item.id)).size !== collection.length)
        fail('Duplicate catalog identifiers')
    }
    fixture.days.forEach((day, index) => {
      if (day.date !== format(addDays(parseISO(fixture.startDate), index), 'yyyy-MM-dd'))
        fail('Days must be consecutive')
      if (!fixture.mealPlans[day.mealPlan]) fail(`Unknown meal plan: ${day.mealPlan}`)
      if (day.workout && !fixture.routines.some((routine) => routine.id === day.workout!.routineId))
        fail('Unknown workout routine')
    })
    if (fixture.days.at(-1)?.date !== fixture.endDate) fail('End date must match the last day')
    Object.values(fixture.mealPlans)
      .flat()
      .forEach((entry) => {
        const food = fixture.foods.find((food) => food.id === entry.foodId)
        if (!food) fail(`Unknown food: ${entry.foodId}`)
        else if (entry.useServing && food.unit !== 'serving' && !food.servingSize)
          fail('Undefined serving equivalent')
      })
    fixture.routines
      .flatMap((routine) => routine.exercises)
      .forEach((exercise) => {
        if (!fixture.exercises.some((item) => item.id === exercise.exerciseId))
          fail('Unknown exercise')
      })
  })
export type DemoFixture = z.infer<typeof fixtureSchema>
export const demoFixture = fixtureSchema.parse(source)
