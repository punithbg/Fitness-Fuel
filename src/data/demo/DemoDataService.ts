import { addDays, format, parseISO } from 'date-fns'
import { db, type FitnessDatabase } from '../database'
import { today } from '../../domain'
import { demoFixture, type DemoFixture } from './fixture'
import { DEMO_KEY } from './constants'
import { expandDemo } from './expandDemo'
import { entities } from '../schemas'

export class DemoDataService {
  private readonly database: FitnessDatabase
  constructor(database: FitnessDatabase) {
    this.database = database
  }

  async load(endDate = today(), input: DemoFixture = demoFixture) {
    const database = this.database
    return database.transaction('rw', database.tables, async () => {
      if (await database.meta.get(DEMO_KEY)) return false
      const journal = expandDemo(input, endDate, {
        categories: await database.categories.toArray(),
        goals: await database.goals.toArray(),
        weights: await database.weights.toArray(),
      })
      for (const table of entities) await database.table(table).bulkAdd(journal[table])
      await database.meta.put({
        key: DEMO_KEY,
        value: JSON.stringify({
          startDate: format(addDays(parseISO(endDate), -13), 'yyyy-MM-dd'),
          endDate,
        }),
      })
      return true
    })
  }
}
export const demoDataService = new DemoDataService(db)
