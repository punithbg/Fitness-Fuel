import { db } from '../database'
import { entities, journalSchema } from '../schemas'

export async function readLocalJournal() {
  return db.transaction(
    'r',
    entities.map((table) => db.table(table)),
    async () =>
      journalSchema.parse(
        Object.fromEntries(
          await Promise.all(
            entities.map(async (table) => [table, await db.table(table).toArray()]),
          ),
        ),
      ),
  )
}
