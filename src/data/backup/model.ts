import { z } from 'zod'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { id } from '../../domain'
import { comparable, documentId, entities, journalSchema, type Journal } from '../schemas'

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
export const digest = (text: string) => bytesToHex(sha256(new TextEncoder().encode(text)))
export const backupSchema = z
  .object({
    format: z.literal('form-and-fuel'),
    version: z.literal(1),
    id: z.string().uuid(),
    exportedAt: z.string().datetime(),
    source: z.object({ uid: z.string().max(200), email: z.string().max(320).optional() }).strict(),
    journal: journalSchema,
  })
  .strict()
export type Backup = z.infer<typeof backupSchema>

export function validateJournal(input: unknown): Journal {
  const journal = journalSchema.parse(input)
  let count = 0
  for (const table of entities) {
    const identifiers = new Set<string>()
    for (const record of journal[table]) {
      const recordId = documentId(table, record)
      if (identifiers.has(recordId)) throw new Error(`Duplicate ${table} identifier or date`)
      identifiers.add(recordId)
      if ('servingName' in record && record.servingName.length > 2000)
        throw new Error('Serving names must be at most 2,000 characters.')
      if (
        'categoryId' in record &&
        (record.categoryId.length > 200 || record.foodId.length > 200 || record.unit.length > 2000)
      )
        throw new Error('A food entry contains an oversized identifier or unit.')
      if ('exercises' in record && record.exercises.length > 500)
        throw new Error('A session can contain at most 500 exercise occurrences.')
      if (new TextEncoder().encode(JSON.stringify(record)).length > 200_000)
        throw new Error('A record exceeds the supported 200 KB size.')
      count++
    }
  }
  if (count > 50_000) throw new Error('A backup can contain at most 50,000 records.')
  return journal
}
export function createBackup(journal: Journal, source: Backup['source']): Backup {
  return {
    format: 'form-and-fuel',
    version: 1,
    id: id(),
    exportedAt: new Date().toISOString(),
    source,
    journal: validateJournal(journal),
  }
}
export function backupSummary(journal: Journal) {
  const counts = Object.fromEntries(entities.map((table) => [table, journal[table].length]))
  const dates = [...journal.meals, ...journal.workouts, ...journal.goals, ...journal.weights]
    .map((row) => row.date)
    .sort()
  return {
    counts,
    total: Object.values(counts).reduce((total, count) => total + count, 0),
    from: dates[0],
    to: dates.at(-1),
  }
}

export function previewMerge(current: Journal, incoming: Journal) {
  let added = 0
  let skipped = 0
  const conflicts: string[] = []
  for (const table of entities) {
    const existing = new Map(current[table].map((record) => [documentId(table, record), record]))
    for (const record of incoming[table]) {
      const recordId = documentId(table, record)
      const previous = existing.get(recordId)
      if (!previous) added++
      else if (comparable(previous) === comparable(record)) skipped++
      else
        conflicts.push(
          `${table}: ${'name' in record ? record.name : 'foodName' in record ? record.foodName : 'date' in record ? record.date : recordId} (${recordId})`,
        )
    }
  }
  return { added, skipped, conflicts }
}
