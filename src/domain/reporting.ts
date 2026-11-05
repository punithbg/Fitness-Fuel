import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { dateSchema, today } from './common'
import { type Meal, summarizeNutrition } from './nutrition'

export const comparePeriods = (current: number, previous: number) =>
  previous === 0 ? null : ((current - previous) / previous) * 100

export type Period = 'week' | 'month' | 'custom' | 'all'

export function periodRange(
  period: Period,
  anchor: string,
  customStart: string,
  customEnd: string,
  earliest: string,
  now = today(),
) {
  const parsed = parseISO(period === 'week' || period === 'month' ? anchor : now)
  let start =
    period === 'month'
      ? format(startOfMonth(parsed), 'yyyy-MM-dd')
      : format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  let end =
    period === 'month'
      ? format(endOfMonth(parsed), 'yyyy-MM-dd')
      : format(endOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  if (period === 'custom') {
    start = customStart
    end = customEnd
  }
  if (period === 'all') {
    start = earliest < now ? earliest : now
    end = now
  }
  dateSchema.parse(start)
  dateSchema.parse(end)
  if (start > end) throw new Error('Start date must be on or before end date')
  if (period !== 'custom' && period !== 'all' && start <= now && now < end) end = now
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
  const previousStart =
    period === 'month'
      ? format(subMonths(parseISO(start), 1), 'yyyy-MM-dd')
      : period === 'week'
        ? format(subWeeks(parseISO(start), 1), 'yyyy-MM-dd')
        : format(addDays(parseISO(start), -days), 'yyyy-MM-dd')
  let previousEnd = format(addDays(parseISO(previousStart), days - 1), 'yyyy-MM-dd')
  if (period === 'month') {
    const monthEnd = format(endOfMonth(parseISO(previousStart)), 'yyyy-MM-dd')
    const fullMonth = end === format(endOfMonth(parseISO(start)), 'yyyy-MM-dd')
    if (fullMonth || previousEnd > monthEnd) previousEnd = monthEnd
  }
  return { start, end, previousStart, previousEnd }
}

export const inRange = (date: string, start: string, end: string) => date >= start && date <= end

export function nutritionSeries(meals: Meal[]) {
  const grouped = new Map<string, Meal[]>()
  meals.forEach((meal) => grouped.set(meal.date, [...(grouped.get(meal.date) ?? []), meal]))
  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({ date, ...summarizeNutrition(entries) }))
}
