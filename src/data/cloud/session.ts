import type { CloudRepository, CloudState } from './CloudRepository'
import type { FitnessData } from '../schemas'

let repository: CloudRepository | undefined
let cloudMode = false
let previewMode = false
let state: CloudState = {}
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach((callback) => callback())
export const subscribeCloud = (callback: () => void) => {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}
export const cloudSnapshot = () => state
export const isCloudSession = () => cloudMode
export const isPreviewSession = () => previewMode
export function activateDemoPreview(data: FitnessData) {
  repository?.stop()
  repository = undefined
  cloudMode = false
  previewMode = true
  state = { data }
  notify()
}
export function activateLocalJournal() {
  repository?.stop()
  repository = undefined
  cloudMode = false
  previewMode = false
  state = {}
  notify()
}
export function activeRepository() {
  if (previewMode) throw new Error('Sign in to save changes. The demo preview is read-only.')
  if (cloudMode && !repository)
    throw new Error('Sign in again before accessing your cloud journal.')
  return repository
}
export function bindCloud(next: CloudRepository) {
  cloudMode = true
  previewMode = false
  repository = next
  state = {}
  next.onChange = () => {
    if (repository !== next) return
    state = next.state
    notify()
  }
  notify()
  return () => {
    if (repository === next) {
      repository = undefined
      state = {}
      notify()
    }
    next.stop()
  }
}
