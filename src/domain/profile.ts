import { z } from 'zod'
import { base, dateSchema, name, nonnegative, positive } from './common'
import { nutrientsSchema } from './nutrition'

export const categorySchema = z.object({
  ...base,
  name,
  archived: z.boolean(),
  order: nonnegative.optional(),
})

export type Category = z.infer<typeof categorySchema>

export const goalSchema = z.object({ ...base, date: dateSchema, nutrients: nutrientsSchema })

export type Goal = z.infer<typeof goalSchema>

export const weightSchema = z.object({ ...base, date: dateSchema, weight: positive })

export type Weight = z.infer<typeof weightSchema>

export const goalsForDate = (goals: Goal[], date: string) =>
  goals
    .filter((goal) => goal.date <= date)
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.nutrients
