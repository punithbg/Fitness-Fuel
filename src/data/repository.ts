import { z } from 'zod'
import { id, mealSchema, stamp, type Meal, type Goal, type Weight } from '../domain'
import { db } from './database'
import { schemas, emptyJournal, type Entity } from './schemas'
import { activeRepository, isPreviewSession } from './cloud/session'
import { digest } from './backup/model'
export { schemas, type Entity } from './schemas'

export async function saveEntity<Key extends Entity>(
  table: Key,
  value: z.infer<(typeof schemas)[Key]>,
) {
  const cloud = activeRepository()
  if (cloud) return cloud.save(table, value)
  const validated = schemas[table].parse({ ...value, updatedAt: new Date().toISOString() })
  await db.table(table).put(validated)
}

export async function removeEntity(table: Entity, entityId: string) {
  const cloud = activeRepository()
  if (cloud) return cloud.remove(table, entityId)
  if (table === 'foods' || table === 'exercises' || table === 'categories')
    await db.table(table).update(entityId, { archived: true, updatedAt: new Date().toISOString() })
  else await db.table(table).delete(entityId)
}

export async function initialize() {
  if (isPreviewSession()) return
  if (activeRepository()) return
  await db.transaction('rw', db.categories, db.meta, async () => {
    if (await db.meta.get('initialized')) return
    await db.categories.bulkAdd(
      ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((name, order) => ({
        ...stamp(),
        name,
        order,
        archived: false,
      })),
    )
    await db.meta.put({ key: 'initialized', value: '1' })
  })
}

export async function copyMeals(meals: Meal[], date: string) {
  const copies = meals.map((meal) =>
    mealSchema.parse({ ...meal, ...stamp(), revision: undefined, id: id(), date }),
  )
  const cloud = activeRepository()
  if (cloud) {
    if (copies.length > 100) throw new Error('Copy at most 100 food entries at a time.')
    const operation = `copy-${digest(JSON.stringify({ date, records: meals.map((meal) => [meal.id, meal.revision, meal.updatedAt]) }))}`
    await cloud.importJournal(
      {
        ...emptyJournal(),
        meals: copies.map((meal, index) => ({ ...meal, id: `${operation}-${index}` })),
      },
      operation,
    )
    return
  }
  await db.meals.bulkAdd(copies)
}

export async function saveDatedEntity(
  table: 'goals' | 'weights',
  value: Goal | Weight,
  previous?: Goal | Weight,
  replacement?: Goal | Weight,
) {
  const cloud = activeRepository()
  if (cloud) return cloud.save(table, value, { previous, replacement })
  await db.transaction('rw', db.table(table), async () => {
    await saveEntity(table, replacement ? { ...value, id: replacement.id } : value)
    if (previous && replacement && previous.id !== replacement.id)
      await removeEntity(table, previous.id)
  })
}

export async function resetWorkspace() {
  const cloud = activeRepository()
  if (cloud) return cloud.clear()
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
  await initialize()
}
