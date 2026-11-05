import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { db } from '../database'
import { DEMO_KEY } from '../demo/constants'
import { cloudSnapshot, isCloudSession, isPreviewSession, subscribeCloud } from '../cloud/session'
export type { FitnessData } from '../schemas'

export function useFitnessData() {
  const cloud = useSyncExternalStore(subscribeCloud, cloudSnapshot)
  const local = useLiveQuery(async () =>
    isCloudSession() || isPreviewSession()
      ? undefined
      : {
          foods: await db.foods.toArray(),
          exercises: await db.exercises.toArray(),
          categories: (await db.categories.toArray()).sort(
            (left, right) =>
              (left.order ?? 999) - (right.order ?? 999) || left.name.localeCompare(right.name),
          ),
          meals: await db.meals.toArray(),
          workouts: await db.workouts.toArray(),
          routines: await db.routines.toArray(),
          goals: await db.goals.toArray(),
          weights: await db.weights.toArray(),
          demoLoaded: !!(await db.meta.get(DEMO_KEY)),
        },
  )
  if (cloud.error) throw new Error(cloud.error)
  const data = isCloudSession() || isPreviewSession() ? cloud.data : local
  return (
    data && {
      ...data,
      categories: [...data.categories].sort(
        (left, right) =>
          (left.order ?? 999) - (right.order ?? 999) || left.name.localeCompare(right.name),
      ),
    }
  )
}
