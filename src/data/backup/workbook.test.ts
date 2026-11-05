import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { zipSync } from 'fflate'
import { emptyJournal } from '../schemas'
import { createBackup } from './model'
import { decodeWorkbook, encodeWorkbook } from './workbook'
import { stamp, zeroNutrients } from '../../domain'

describe('emergency Excel backups', () => {
  it('rejects excessive expanded ZIP data before loading Excel', async () => {
    const oversized = zipSync({
      'xl/worksheets/sheet1.xml': new Uint8Array(65 * 1024 * 1024).fill(65),
    })
    await expect(decodeWorkbook(new Uint8Array(oversized))).rejects.toThrow('64 MB')
  })
  it('round trips exact nutrients, snapshots, dates, optional fields and ordered occurrences', async () => {
    const journal = emptyJournal()
    const nutrients = { ...zeroNutrients(), sugar: 3.141592653589793, calories: 125.125 }
    journal.foods.push({
      ...stamp(),
      name: '=SUM(1,2)',
      unit: 'g',
      basis: 100,
      servingName: '',
      nutrients,
      favorite: true,
      archived: true,
    })
    journal.meals.push({
      ...stamp(),
      date: '2026-11-01',
      time: '12:00',
      categoryId: 'gone',
      categoryName: 'Old category',
      foodId: journal.foods[0].id,
      foodName: 'Original',
      quantity: 150,
      unit: 'g',
      basis: 100,
      basisNutrients: nutrients,
      nutrients,
    })
    const exercise = {
      id: 'occurrence-one',
      exerciseId: 'catalog-1',
      name: 'Squat',
      muscle: 'Legs',
      notes: 'Long notes '.repeat(180),
      sets: [
        { id: 'set-one', reps: 8, weight: 22.125 },
        { id: 'set-two', reps: 9, weight: 0, rpe: 8 },
      ],
    }
    journal.workouts.push({
      ...stamp(),
      name: 'Session',
      date: '2026-11-01',
      duration: 45,
      notes: 'History',
      exercises: [exercise, { ...exercise, id: 'occurrence-two' }],
    })
    journal.workouts.push(
      ...Array.from({ length: 8 }, () => ({ ...journal.workouts[0], ...stamp() })),
    )
    journal.routines.push({ ...stamp(), name: 'Routine', exercises: [exercise] })
    journal.weights.push({ ...stamp(), date: '2026-11-01', weight: 71.123456 })
    journal.goals.push({ ...stamp(), date: '2026-11-01', nutrients })
    const backup = createBackup(journal, { uid: 'old-account', email: 'owner@example.test' })
    const bytes = await encodeWorkbook(backup)
    expect(await decodeWorkbook(bytes)).toEqual(backup)
  })
  it('rejects corruption, formulas, duplicate dates and oversized input', async () => {
    const bytes = await encodeWorkbook(createBackup(emptyJournal(), { uid: 'local' }))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes.buffer)
    workbook.getWorksheet('Canonical')!.getCell(2, 2).value += ' '
    await expect(decodeWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).rejects.toThrow(
      'checksum',
    )
    workbook.getWorksheet('Canonical')!.getCell(2, 2).value = { formula: '1+1', result: 2 }
    await expect(decodeWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).rejects.toThrow(
      'Formula',
    )
    await expect(decodeWorkbook(new Uint8Array(21 * 1024 * 1024))).rejects.toThrow('20 MB')
    const journal = emptyJournal()
    journal.weights = [
      { ...stamp(), date: '2026-11-01', weight: 70 },
      { ...stamp(), date: '2026-11-01', weight: 71 },
    ]
    expect(() => createBackup(journal, { uid: 'local' })).toThrow('Duplicate')
  })
})
