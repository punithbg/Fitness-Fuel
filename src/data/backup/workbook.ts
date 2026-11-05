import ExcelJS from 'exceljs'
import { Unzip, UnzipInflate } from 'fflate'
import { entities } from '../schemas'
import {
  backupSchema,
  backupSummary,
  digest,
  MAX_BACKUP_BYTES,
  validateJournal,
  type Backup,
} from './model'

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_EXPANDED = 64 * 1024 * 1024

function inspectZip(bytes: Uint8Array) {
  if (bytes.length > MAX_BACKUP_BYTES || bytes[0] !== 80 || bytes[1] !== 75)
    throw new Error('Choose a valid Fitness & Fuel Excel backup no larger than 20 MB.')
  let expanded = 0
  let entries = 0
  const unzip = new Unzip((entry) => {
    if (
      ++entries > 200 ||
      entry.name.includes('..') ||
      /vbaProject|externalLinks/i.test(entry.name)
    )
      throw new Error('Unsupported or unsafe workbook content.')
    const text: string[] = []
    const decoder = new TextDecoder()
    entry.ondata = (error, chunk, final) => {
      if (error) throw error
      expanded += chunk.length
      if (expanded > MAX_EXPANDED)
        throw new Error('Expanded backup exceeds the 64 MB safety limit.')
      text.push(decoder.decode(chunk, { stream: !final }))
      if (final && /<!DOCTYPE|<!ENTITY|<f[\s>]/i.test(text.join('')))
        throw new Error('Formula cells and XML entities are not supported in backups.')
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  for (let offset = 0; offset < bytes.length; offset += 4096)
    unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length)
}

function readableRows(
  value: unknown,
  prefix = '',
  result: Record<string, string | number | boolean> = {},
) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      readableRows(child, prefix ? `${prefix}.${key}` : key, result)
  } else if (value !== undefined) {
    const content = Array.isArray(value) ? JSON.stringify(value) : value
    result[prefix] =
      typeof content === 'string' ? content.slice(0, 30000) : (content as number | boolean)
  }
  return result
}

export async function encodeWorkbook(backup: Backup): Promise<Uint8Array<ArrayBuffer>> {
  const validated = backupSchema.parse(backup)
  validateJournal(validated.journal)
  const payload = JSON.stringify(validated)
  if (new TextEncoder().encode(payload).length > MAX_BACKUP_BYTES)
    throw new Error('Backup payload exceeds 20 MB.')
  const workbook = new ExcelJS.Workbook()
  const summary = backupSummary(validated.journal)
  const manifest = workbook.addWorksheet('Manifest')
  manifest.addRows([
    ['Fitness & Fuel backup', 1],
    ['Backup ID', validated.id],
    ['Exported at', validated.exportedAt],
    ['Source email', validated.source.email ?? 'Local browser'],
    ['SHA-256', digest(payload)],
    ['From', summary.from ?? ''],
    ['To', summary.to ?? ''],
    [
      'Restore source',
      'Canonical payload. Readable sheets are for inspection; do not edit this backup.',
    ],
    ...Object.entries(summary.counts),
  ])
  manifest.columns = [{ width: 28 }, { width: 90 }]
  for (const table of entities) {
    const sheet = workbook.addWorksheet(table)
    const rows = validated.journal[table].map((value) => readableRows(value))
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    sheet.columns = keys.map((key) => ({ header: key, key, width: 22 }))
    rows.forEach((row) => sheet.addRow(row))
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const exerciseSheet = workbook.addWorksheet('Session exercises')
  exerciseSheet.addRow([
    'Parent table',
    'Parent ID',
    'Position',
    'Occurrence ID',
    'Catalog exercise ID',
    'Name',
    'Muscle',
    'Notes',
  ])
  const setsSheet = workbook.addWorksheet('Sets')
  setsSheet.addRow([
    'Parent table',
    'Parent ID',
    'Exercise position',
    'Occurrence ID',
    'Set position',
    'Set ID',
    'Reps',
    'Weight',
    'RPE',
  ])
  for (const table of ['workouts', 'routines'] as const) {
    for (const parent of validated.journal[table]) {
      parent.exercises.forEach((exercise, position) => {
        exerciseSheet.addRow([
          table,
          parent.id,
          position,
          exercise.id,
          exercise.exerciseId,
          exercise.name,
          exercise.muscle,
          exercise.notes.slice(0, 30000),
        ])
        exercise.sets.forEach((set, index) =>
          setsSheet.addRow([
            table,
            parent.id,
            position,
            exercise.id,
            index,
            set.id,
            set.reps,
            set.weight,
            set.rpe ?? null,
          ]),
        )
      })
    }
  }
  const canonical = workbook.addWorksheet('Canonical')
  canonical.addRow(['Chunk', 'Payload'])
  for (let offset = 0, chunkIndex = 0; offset < payload.length; chunkIndex++) {
    let end = Math.min(offset + 24000, payload.length)
    const last = payload.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) end--
    canonical.addRow([chunkIndex, payload.slice(offset, end)])
    offset = end
  }
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  if (bytes.length > MAX_BACKUP_BYTES) throw new Error('Workbook exceeds the 20 MB safety limit.')
  return bytes
}

export async function decodeWorkbook(bytes: Uint8Array<ArrayBuffer>): Promise<Backup> {
  inspectZip(bytes)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes.buffer)
  const canonical = workbook.getWorksheet('Canonical')
  const manifest = workbook.getWorksheet('Manifest')
  if (!canonical || !manifest || canonical.rowCount < 2 || canonical.rowCount > 1000)
    throw new Error('This is not a supported Fitness & Fuel backup.')
  const chunks: string[] = []
  for (let row = 2; row <= canonical.rowCount; row++) {
    const chunk = canonical.getCell(row, 2).value
    if (
      canonical.getCell(row, 1).value !== row - 2 ||
      typeof chunk !== 'string' ||
      chunk.length > 24000
    )
      throw new Error('Backup chunks are missing or malformed.')
    chunks.push(chunk)
  }
  const payload = chunks.join('')
  if (new TextEncoder().encode(payload).length > MAX_BACKUP_BYTES)
    throw new Error('Backup payload exceeds 20 MB.')
  if (manifest.getCell(5, 2).value !== digest(payload))
    throw new Error('Backup checksum does not match. The file may have been changed or damaged.')
  const backup = backupSchema.parse(JSON.parse(payload))
  backup.journal = validateJournal(backup.journal)
  return backup
}

export function downloadWorkbook(bytes: Uint8Array<ArrayBuffer>, backup: Backup) {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }))
  const link = document.createElement('a')
  link.href = url
  link.download = `fitness-and-fuel-${backup.exportedAt.slice(0, 10)}-${backup.id.slice(0, 8)}.xlsx`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
