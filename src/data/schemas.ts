import { z } from 'zod'
import {
  categorySchema,
  exerciseSchema,
  foodSchema,
  goalSchema,
  mealSchema,
  routineSchema,
  weightSchema,
  workoutSchema,
} from '../domain'

export const schemas = {
  foods: foodSchema,
  exercises: exerciseSchema,
  categories: categorySchema,
  meals: mealSchema,
  workouts: workoutSchema,
  routines: routineSchema,
  goals: goalSchema,
  weights: weightSchema,
}
export type Entity = keyof typeof schemas
export type RecordValue = z.infer<(typeof schemas)[Entity]>
export const entities = Object.keys(schemas) as Entity[]
export const journalSchema = z.object({
  foods: z.array(foodSchema),
  exercises: z.array(exerciseSchema),
  categories: z.array(categorySchema),
  meals: z.array(mealSchema),
  workouts: z.array(workoutSchema),
  routines: z.array(routineSchema),
  goals: z.array(goalSchema),
  weights: z.array(weightSchema),
})
export type Journal = z.infer<typeof journalSchema>
export type FitnessData = Journal & { demoLoaded: boolean }
export const emptyJournal = (): Journal => ({
  foods: [],
  exercises: [],
  categories: [],
  meals: [],
  workouts: [],
  routines: [],
  goals: [],
  weights: [],
})

export function safeDocumentId(value: string) {
  if (!value || value.length > 200 || /[/\\]/.test(value) || /^\.{1,2}$|^__.*__$/.test(value))
    throw new Error('Invalid record identifier')
  return value
}

export function documentId(table: Entity, value: RecordValue) {
  return safeDocumentId(
    table === 'goals' || table === 'weights' ? (value as Journal['goals'][number]).date : value.id,
  )
}

export function comparable(value: RecordValue) {
  const { id: recordId, ownerId, revision, updatedAt, ...content } = value
  void recordId
  void ownerId
  void revision
  void updatedAt
  return JSON.stringify(content)
}
