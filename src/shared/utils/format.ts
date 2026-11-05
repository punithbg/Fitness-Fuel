import { format, parseISO } from 'date-fns'

export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)

export const prettyDate = (date: string) => format(parseISO(date), 'EEE, d MMM')
