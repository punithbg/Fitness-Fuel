import { z } from 'zod'
import { base, dateSchema, name, nonnegative, positive } from './common'

export const exerciseSchema = z.object({
  ...base,
  name,
  muscle: name,
  notes: z.string().max(2000),
  archived: z.boolean(),
})

export type Exercise = z.infer<typeof exerciseSchema>

export const setSchema = z.object({
  id: z.string(),
  reps: z.number().int().positive(),
  weight: nonnegative,
  rpe: z.number().min(1).max(10).optional(),
})

export const sessionExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  name,
  muscle: z.string(),
  notes: z.string().max(2000),
  sets: z.array(setSchema).min(1, 'Add at least one set'),
})

export type SessionExercise = z.infer<typeof sessionExerciseSchema>

export const workoutSchema = z.object({
  ...base,
  name,
  date: dateSchema,
  duration: positive,
  calories: nonnegative.optional(),
  notes: z.string().max(4000),
  exercises: z.array(sessionExerciseSchema).min(1, 'Add at least one exercise'),
})

export type Workout = z.infer<typeof workoutSchema>

export const routineSchema = z.object({
  ...base,
  name,
  exercises: z.array(sessionExerciseSchema).min(1, 'Add at least one exercise'),
})

export type Routine = z.infer<typeof routineSchema>

export const calculateWorkoutVolume = (exercises: SessionExercise[]) =>
  exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((sum, set) => sum + set.reps * set.weight, 0),
    0,
  )
