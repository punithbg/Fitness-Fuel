import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { createDemoPreview } from './preview'
import { activateDemoPreview, activateLocalJournal, cloudSnapshot } from '../cloud/session'
import { db } from '../database'
import { initialize, removeEntity, resetWorkspace, saveEntity } from '../repository'
import { stamp } from '../../domain'

afterEach(async () => {
  activateLocalJournal()
  await db.delete()
})

it('shows a complete two-week preview without reading or replacing the local journal', async () => {
  const personal = { ...stamp(), date: '2026-11-01', weight: 72.5 }
  await db.weights.add(personal)
  const preview = createDemoPreview('2026-11-05')
  activateDemoPreview(preview)
  await initialize()
  expect(preview.foods).toHaveLength(9)
  expect(preview.meals).toHaveLength(118)
  expect(preview.workouts).toHaveLength(8)
  expect(preview.weights).toHaveLength(14)
  expect(preview.weights.map((row) => row.date).sort()).toEqual(expect.arrayContaining(['2026-10-23', '2026-11-05']))
  expect(cloudSnapshot().data).toBe(preview)
  expect(await db.weights.toArray()).toEqual([personal])
  expect(await db.meals.count()).toBe(0)
  expect(await db.categories.count()).toBe(0)
  await expect(saveEntity('weights', { ...personal, weight: 99 })).rejects.toThrow('read-only')
  await expect(removeEntity('weights', personal.id)).rejects.toThrow('read-only')
  await expect(resetWorkspace()).rejects.toThrow('read-only')
  expect(await db.weights.toArray()).toEqual([personal])
})