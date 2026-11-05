import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { stamp } from '../../domain'
import { validateJournal } from '../backup/model'
import {
  comparable,
  documentId,
  emptyJournal,
  entities,
  journalSchema,
  safeDocumentId,
  schemas,
  type Entity,
  type FitnessData,
  type Journal,
  type RecordValue,
} from '../schemas'

export type CloudState = { data?: FitnessData; error?: string; connected?: boolean }
export type SaveOptions = { previous?: RecordValue; replacement?: RecordValue }
export type ImportResult = { added: number; skipped: number; conflicts: number }

export class CloudRepository {
  state: CloudState = {}
  onChange = () => {}
  private stopped = false
  private subscriptions: Unsubscribe[] = []
  private journal = emptyJournal()
  private received = new Set<string>()
  private demoLoaded = false
  private connected = false
  readonly firestore: Firestore
  readonly uid: string
  constructor(firestore: Firestore, uid: string) {
    this.firestore = firestore
    this.uid = uid
  }
  private root() {
    return doc(this.firestore, 'users', this.uid)
  }
  private record(table: Entity, recordId: string) {
    return doc(this.firestore, 'users', this.uid, table, safeDocumentId(recordId))
  }
  private check() {
    if (this.stopped) throw new Error('Account changed. Sign in again before saving.')
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      throw new Error('Offline. Your changes have not been saved. Reconnect and retry.')
  }
  private publish() {
    if (this.stopped || this.received.size !== entities.length + 1) return
    this.state = {
      data: { ...this.journal, demoLoaded: this.demoLoaded },
      connected: this.connected,
    }
    this.onChange()
  }
  async initialize() {
    this.check()
    await runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      this.check()
      if (root.exists()) return
      transaction.set(this.root(), { revision: 1, demoLoaded: false, changedAt: serverTimestamp() })
      for (const [order, name] of ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].entries()) {
        const recordId = `default-${name.toLowerCase()}`
        transaction.set(this.record('categories', recordId), {
          ...stamp(),
          id: recordId,
          ownerId: this.uid,
          revision: 1,
          name,
          order,
          archived: false,
        })
      }
    })
  }
  start() {
    const failed = (error: Error) => {
      if (this.stopped) return
      this.state = { error: `Cloud data unavailable: ${error.message}` }
      this.onChange()
    }
    this.subscriptions.push(
      onSnapshot(
        this.root(),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (this.stopped) return
          this.connected = !snapshot.metadata.fromCache
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
            this.publish()
            return
          }
          this.demoLoaded = snapshot.data()?.demoLoaded === true
          this.received.add('root')
          this.publish()
        },
        failed,
      ),
    )
    for (const table of entities) {
      this.subscriptions.push(
        onSnapshot(
          collection(this.firestore, 'users', this.uid, table),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites || this.stopped)
              return
            try {
              const rows = snapshot.docs.map((item) => schemas[table].parse(item.data()))
              this.journal = { ...this.journal, [table]: rows }
              this.received.add(table)
              this.publish()
            } catch (error) {
              failed(error instanceof Error ? error : new Error('Invalid cloud data'))
            }
          },
          failed,
        ),
      )
    }
  }
  stop() {
    this.stopped = true
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.subscriptions = []
    this.state = {}
    this.journal = emptyJournal()
    this.onChange()
  }
  async save(table: Entity, input: RecordValue, options: SaveOptions = {}) {
    this.check()
    const parsed = schemas[table].parse(input)
    validateJournal({ ...emptyJournal(), [table]: [parsed] })
    const targetId = documentId(table, parsed)
    const previous = options.previous ?? (parsed.revision ? parsed : undefined)
    const expectedTarget = options.replacement ?? (previous?.id === targetId ? previous : undefined)
    await runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      const target = await transaction.get(this.record(table, targetId))
      const source =
        previous && previous.id !== targetId
          ? await transaction.get(this.record(table, previous.id))
          : undefined
      this.check()
      if (target.exists() ? target.data().revision !== expectedTarget?.revision : !!expectedTarget)
        throw new Error(
          'This record changed on another device. Close the editor and reload before saving.',
        )
      if (source && (!source.exists() || source.data().revision !== previous?.revision))
        throw new Error('The original record changed on another device. Reload before saving.')
      transaction.set(
        this.record(table, targetId),
        JSON.parse(
          JSON.stringify({
            ...parsed,
            id: targetId,
            ownerId: this.uid,
            revision: root.data()!.revision + 1,
            updatedAt: new Date().toISOString(),
          }),
        ),
      )
      if (source) transaction.delete(source.ref)
      transaction.update(this.root(), {
        revision: root.data()!.revision + 1,
        changedAt: serverTimestamp(),
      })
    })
  }
  async remove(table: Entity, recordId: string) {
    this.check()
    const value = this.journal[table].find((row) => row.id === recordId)
    if (!value) throw new Error('Record is no longer available. Reload before trying again.')
    if (table === 'foods' || table === 'exercises' || table === 'categories')
      return this.save(table, { ...value, archived: true } as RecordValue)
    await runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      const current = await transaction.get(this.record(table, recordId))
      this.check()
      if (!current.exists() || current.data().revision !== value.revision)
        throw new Error('Record changed on another device. Review it before deleting.')
      transaction.delete(current.ref)
      transaction.update(this.root(), {
        revision: root.data()!.revision + 1,
        changedAt: serverTimestamp(),
      })
    })
  }
  async snapshot(): Promise<Journal> {
    this.check()
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await getDocFromServer(this.root())
      const rows = await Promise.all(
        entities.map(async (table) => [
          table,
          (await getDocsFromServer(collection(this.firestore, 'users', this.uid, table))).docs.map(
            (item) => item.data(),
          ),
        ]),
      )
      const after = await getDocFromServer(this.root())
      this.check()
      if (before.data()?.revision === after.data()?.revision)
        return journalSchema.parse(Object.fromEntries(rows))
    }
    throw new Error('Your journal changed during export. Wait for other saves to finish and retry.')
  }
  async importJournal(
    input: Journal,
    operationId: string,
    progress = (_done: number, _total: number) => {},
  ) {
    const journal = validateJournal(input)
    const records = entities.flatMap((table) => journal[table].map((value) => ({ table, value })))
    const result: ImportResult = { added: 0, skipped: 0, conflicts: 0 }
    for (let offset = 0; offset < records.length; offset += 100) {
      this.check()
      const chunk = records.slice(offset, offset + 100)
      const marker = doc(
        this.firestore,
        'users',
        this.uid,
        'imports',
        safeDocumentId(`${operationId}-${offset}`),
      )
      const counts = await runTransaction(this.firestore, async (transaction) => {
        const root = await transaction.get(this.root())
        const completed = await transaction.get(marker)
        if (completed.exists()) return completed.data() as ImportResult
        const destinations = await Promise.all(
          chunk.map(({ table, value }) =>
            transaction.get(this.record(table, documentId(table, value))),
          ),
        )
        this.check()
        const counts: ImportResult = { added: 0, skipped: 0, conflicts: 0 }
        chunk.forEach(({ table, value }, index) => {
          const destination = destinations[index]
          if (destination.exists()) {
            if (comparable(schemas[table].parse(destination.data())) === comparable(value))
              counts.skipped++
            else counts.conflicts++
          } else {
            transaction.set(
              destination.ref,
              JSON.parse(
                JSON.stringify({
                  ...value,
                  id: documentId(table, value),
                  ownerId: this.uid,
                  revision: root.data()!.revision + 1,
                }),
              ),
            )
            counts.added++
          }
        })
        transaction.set(marker, counts)
        transaction.update(this.root(), {
          revision: root.data()!.revision + 1,
          changedAt: serverTimestamp(),
        })
        return counts
      })
      result.added += counts.added
      result.skipped += counts.skipped
      result.conflicts += counts.conflicts
      progress(Math.min(offset + chunk.length, records.length), records.length)
    }
    return result
  }
  async markDemoLoaded() {
    this.check()
    await runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      this.check()
      transaction.update(this.root(), {
        revision: root.data()!.revision + 1,
        changedAt: serverTimestamp(),
        demoLoaded: true,
      })
    })
  }
  async demoPlan(build: () => Promise<Journal>) {
    this.check()
    const reference = doc(this.firestore, 'users', this.uid, 'meta', 'demo-plan')
    const existing = await getDocFromServer(reference)
    if (existing.exists()) return validateJournal(existing.data().journal)
    const journal = validateJournal(await build())
    return runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      const current = await transaction.get(reference)
      this.check()
      if (current.exists()) return validateJournal(current.data().journal)
      transaction.set(reference, JSON.parse(JSON.stringify({ journal })))
      transaction.update(this.root(), {
        revision: root.data()!.revision + 1,
        changedAt: serverTimestamp(),
      })
      return journal
    })
  }
  async clear(progress = (_done: number, _total: number) => {}) {
    const journal = await this.snapshot()
    const records = entities.flatMap((table) => journal[table].map((value) => ({ table, value })))
    for (let offset = 0; offset < records.length; offset += 100) {
      this.check()
      const chunk = records.slice(offset, offset + 100)
      await runTransaction(this.firestore, async (transaction) => {
        const root = await transaction.get(this.root())
        const rows = await Promise.all(
          chunk.map(({ table, value }) => transaction.get(this.record(table, value.id))),
        )
        this.check()
        rows.forEach((row, index) => {
          if (row.exists() && row.data().revision !== chunk[index].value.revision)
            throw new Error('Data changed during reset. Review your journal before retrying.')
        })
        rows.forEach((row) => transaction.delete(row.ref))
        transaction.update(this.root(), {
          revision: root.data()!.revision + 1,
          changedAt: serverTimestamp(),
        })
      })
      progress(Math.min(offset + chunk.length, records.length), records.length)
    }
    const markers = (
      await Promise.all(
        ['imports', 'meta'].map((table) =>
          getDocsFromServer(collection(this.firestore, 'users', this.uid, table)),
        ),
      )
    ).flatMap((snapshot) => snapshot.docs)
    for (let offset = 0; offset < markers.length; offset += 100) {
      await runTransaction(this.firestore, async (transaction) => {
        const root = await transaction.get(this.root())
        this.check()
        markers.slice(offset, offset + 100).forEach((marker) => transaction.delete(marker.ref))
        transaction.update(this.root(), {
          revision: root.data()!.revision + 1,
          changedAt: serverTimestamp(),
        })
      })
    }
    await runTransaction(this.firestore, async (transaction) => {
      const root = await transaction.get(this.root())
      const names = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
      const categories = await Promise.all(
        names.map((name) =>
          transaction.get(this.record('categories', `default-${name.toLowerCase()}`)),
        ),
      )
      this.check()
      categories.forEach((category, order) => {
        if (!category.exists())
          transaction.set(category.ref, {
            ...stamp(),
            id: category.id,
            ownerId: this.uid,
            revision: root.data()!.revision + 1,
            name: names[order],
            order,
            archived: false,
          })
      })
      transaction.update(this.root(), {
        revision: root.data()!.revision + 1,
        changedAt: serverTimestamp(),
        demoLoaded: false,
      })
    })
  }
}
