import { format, isValid, parseISO } from 'date-fns'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'

export const id = () => uuid()

export const today = () => format(new Date(), 'yyyy-MM-dd')

export const nonnegative = z.number().finite().min(0)

export const positive = z.number().finite().positive()

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValid(parseISO(value)), 'Choose a valid date')

export const name = z.string().trim().min(1, 'A name is required').max(120)

export const base = {
  id: z.string().min(1),
  ownerId: z.string().min(1),
  updatedAt: z.string(),
  revision: z.number().int().positive().optional(),
}

export const stamp = () => ({
  id: id(),
  ownerId: 'local' as const,
  updatedAt: new Date().toISOString(),
  revision: undefined as number | undefined,
})
