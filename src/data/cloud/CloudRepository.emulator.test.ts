/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore'
import { CloudRepository } from './CloudRepository'
import { emptyJournal } from '../schemas'
import { foodSnapshot, stamp, zeroNutrients } from '../../domain'
import { starterFoods } from '../foods/starter'
import { createFoodDirectory, decodeFoodDirectory, foodJournal } from '../backup/foods'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('private cloud journal', () => {
  let environment: RulesTestEnvironment
  let repositories: CloudRepository[] = []
  const database = (uid: string) =>
    environment
      .authenticatedContext(uid, { email_verified: true, email: `${uid}@example.test` })
      .firestore() as unknown as Firestore
  const create = async (uid: string) => {
    const repository = new CloudRepository(database(uid), uid)
    repositories.push(repository)
    await repository.initialize()
    repository.start()
    await vi.waitFor(() => expect(repository.state.data).toBeDefined(), { timeout: 15000 })
    return repository
  }
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'demo-form-and-fuel',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
  }, 30000)
  beforeEach(async () => {
    await environment.clearFirestore()
  })
  afterEach(() => {
    repositories.forEach((repository) => repository.stop())
    repositories = []
  })
  afterAll(async () => {
    await environment?.cleanup()
  })
  it('denies anonymous/cross-account reads, forged owners, unknown paths and writes without journal revision', async () => {
    const alice = await create('alice')
    const record = {
      ...stamp(),
      id: 'food-one',
      name: 'Oats',
      unit: 'g' as const,
      basis: 100,
      servingName: '',
      nutrients: zeroNutrients(),
      favorite: false,
      archived: false,
    }
    await alice.save('foods', record)
    const reference = doc(alice.firestore, 'users/alice/foods/food-one')
    expect((await getDoc(reference)).data()?.ownerId).toBe('alice')
    await assertFails(getDoc(doc(database('bob'), 'users/alice/foods/food-one')))
    await assertFails(
      getDoc(
        doc(
          environment.unauthenticatedContext().firestore() as unknown as Firestore,
          'users/alice/foods/food-one',
        ),
      ),
    )
    await assertFails(setDoc(reference, { ...record, ownerId: 'bob', revision: 2 }))
    await assertFails(setDoc(doc(alice.firestore, 'users/alice/unknown/bad'), { value: true }))
    await assertFails(
      setDoc(reference, { ...(await getDoc(reference)).data(), name: 'Unsafe write' }),
    )
    expect((await getDoc(reference)).data()?.name).toBe('Oats')
    for (const override of [
      { ownerId: 'bob' },
      { nutrients: { ...zeroNutrients(), sugar: -1 } },
      { credentials: 'not-an-allowed-field' },
    ]) {
      await assertFails(
        runTransaction(alice.firestore, async (transaction) => {
          const root = doc(alice.firestore, 'users/alice')
          const state = await transaction.get(root)
          const revision = state.data()!.revision + 1
          transaction.set(reference, { ...record, ownerId: 'alice', revision, ...override })
          transaction.update(root, { revision, changedAt: serverTimestamp() })
        }),
      )
    }
    expect((await getDoc(reference)).data()?.name).toBe('Oats')
  })
  it('updates another client automatically and rejects stale changes and deleted record recreation', async () => {
    const first = await create('alice')
    const second = await create('alice')
    const record = { ...stamp(), name: 'Squat', muscle: 'Legs', notes: '', archived: false }
    await first.save('exercises', record)
    await vi.waitFor(() => expect(second.state.data?.exercises).toHaveLength(1))
    const stale = second.state.data!.exercises[0]
    await first.save('exercises', { ...stale, name: 'Updated squat' })
    await vi.waitFor(() => expect(second.state.data?.exercises[0].name).toBe('Updated squat'))
    await expect(second.save('exercises', { ...stale, name: 'Stale overwrite' })).rejects.toThrow(
      'changed',
    )
    await first.save('weights', { ...stamp(), date: '2026-11-01', weight: 70 })
    await vi.waitFor(() => expect(first.state.data?.weights).toHaveLength(1))
    const weight = first.state.data!.weights[0]
    await first.remove('weights', weight.id)
    await expect(second.save('weights', { ...weight, weight: 99 })).rejects.toThrow('changed')
  })
  it('keeps food directories private, reassigns imported ownership and preserves meal snapshots', async () => {
    const alice = await create('alice')
    const bob = await create('bob')
    await alice.importJournal(foodJournal(starterFoods), 'starter-foods')
    const apple = (await alice.snapshot()).foods.find((food) => food.id === starterFoods[0].id)!
    const meal = {
      ...stamp(), ...foodSnapshot(apple, 150, false), date: '2026-11-05', time: '12:00',
      categoryId: 'default-lunch', categoryName: 'Lunch',
    }
    await alice.save('meals', meal)
    await alice.save('foods', { ...apple, name: 'My apple', nutrients: { ...apple.nutrients, calories: 99 } })
    const journal = await alice.snapshot()
    expect(journal.meals[0].foodName).toBe(apple.name)
    expect(journal.meals[0].nutrients.calories).toBe(78)
    const exported = decodeFoodDirectory(JSON.stringify(createFoodDirectory(journal.foods)))
    expect((await bob.snapshot()).foods).toHaveLength(0)
    expect((await bob.importJournal(foodJournal(exported.foods), 'food-file')).added).toBe(60)
    const imported = await bob.snapshot()
    expect(imported.meals).toHaveLength(0)
    expect(imported.foods.every((food) => food.ownerId === 'bob')).toBe(true)
    expect(imported.foods.find((food) => food.id === apple.id)?.name).toBe('My apple')
    expect((await bob.importJournal(foodJournal(starterFoods), 'starter-again')).conflicts).toBe(1)
    await assertFails(getDoc(doc(database('bob'), `users/alice/foods/${apple.id}`)))
    await alice.clear()
    expect((await bob.snapshot()).foods).toHaveLength(60)
  })
  it('moves dated entries atomically, preserves destination conflicts and prevents stale replacement', async () => {
    const repository = await create('alice')
    await repository.save('weights', { ...stamp(), date: '2026-11-01', weight: 70 })
    await repository.save('weights', { ...stamp(), date: '2026-11-02', weight: 71 })
    await vi.waitFor(() => expect(repository.state.data?.weights).toHaveLength(2))
    const source = repository.state.data!.weights.find((entry) => entry.date === '2026-11-01')!
    const destination = repository.state.data!.weights.find((entry) => entry.date === '2026-11-02')!
    await expect(
      repository.save('weights', { ...source, date: destination.date }, { previous: source }),
    ).rejects.toThrow('changed')
    await repository.save(
      'weights',
      { ...source, date: destination.date },
      { previous: source, replacement: destination },
    )
    expect((await repository.snapshot()).weights).toEqual([
      expect.objectContaining({ id: destination.date, date: destination.date, weight: 70 }),
    ])
    await expect(
      repository.save('weights', { ...source, date: '2026-11-03' }, { previous: source }),
    ).rejects.toThrow('changed')
  })
  it('imports in retry-safe batches without overwriting conflicts and isolates account reset', async () => {
    const alice = await create('alice')
    const bob = await create('bob')
    const journal = emptyJournal()
    journal.exercises = Array.from({ length: 105 }, (_, index) => ({
      ...stamp(),
      id: `import-${index}`,
      name: 'Press',
      muscle: 'Chest',
      notes: '',
      archived: false,
    }))
    await expect(
      alice.importJournal(journal, 'import-once', () => {
        throw new Error('Simulated interruption')
      }),
    ).rejects.toThrow('interruption')
    expect((await alice.snapshot()).exercises).toHaveLength(100)
    expect((await alice.importJournal(journal, 'import-once')).added).toBe(105)
    expect((await alice.snapshot()).exercises).toHaveLength(105)
    journal.exercises[0].name = 'Conflict'
    expect((await alice.importJournal(journal, 'another-import')).conflicts).toBe(1)
    expect((await bob.snapshot()).exercises).toHaveLength(0)
    await alice.clear()
    expect((await alice.snapshot()).exercises).toHaveLength(0)
    expect((await alice.snapshot()).categories).toHaveLength(4)
    expect((await bob.snapshot()).categories).toHaveLength(4)
    alice.stop()
    await expect(alice.save('exercises', journal.exercises[0])).rejects.toThrow('Account changed')
  })
})
