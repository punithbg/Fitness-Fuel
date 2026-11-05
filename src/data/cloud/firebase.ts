import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, memoryLocalCache } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const cloudConfigured = Object.values(config).every(Boolean)
export const cloudPartiallyConfigured = Object.values(config).some(Boolean) && !cloudConfigured
let services: ReturnType<typeof createServices> | undefined
function createServices() {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const firestore = initializeFirestore(app, { localCache: memoryLocalCache() })
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  }
  return { auth, firestore }
}
export function firebaseServices() {
  if (!cloudConfigured)
    throw new Error('Firebase setup is incomplete. Check the four VITE_FIREBASE settings.')
  return (services ??= createServices())
}
