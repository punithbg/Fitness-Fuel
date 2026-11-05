import { Cloud } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  cloudConfigured,
  firebaseServices,
} from '../../data/cloud/firebase'
import { CloudRepository } from '../../data/cloud/CloudRepository'
import { activateDemoPreview, bindCloud, isPreviewSession, subscribeCloud } from '../../data/cloud/session'
import { LoginDialog } from './LoginDialog'
import { AuthContext, LoginContext } from './AuthContext'

function cloudErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'permission-denied'
  ) {
    return 'Firestore denied access. Deploy this app\'s rules to your Firebase project and verify that the signed-in account has a verified email.'
  }
  return error instanceof Error ? error.message : 'Cloud unavailable'
}

function DemoSession({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribeCloud, isPreviewSession)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    void import('../../data/demo/preview').then(({ createDemoPreview }) => {
      if (!cancelled) activateDemoPreview(createDemoPreview())
    }).catch((error: unknown) => {
      if (!cancelled) setError(error instanceof Error ? error.message : 'Demo unavailable')
    })
    return () => { cancelled = true }
  }, [])
  if (error) throw new Error(error)
  if (!ready) return <div className="app-loading" role="status">Opening demo journal...</div>
  return <AuthContext value={null}>{children}</AuthContext>
}

function CloudSession({ user, children }: { user: User; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    const repository = new CloudRepository(firebaseServices().firestore, user.uid)
    const cleanup = bindCloud(repository)
    void repository
      .initialize()
      .then(() => {
        if (cancelled) return
        repository.start()
        setReady(true)
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(cloudErrorMessage(error))
      })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [user.uid, attempt])
  if (error)
    return (
      <div className="auth-screen">
        <h1>Cloud unavailable</h1>
        <p role="alert">{error}</p>
        <button
          className="button"
          onClick={() => {
            setReady(false)
            setError('')
            setAttempt(attempt + 1)
          }}
        >
          Retry
        </button>
        <button
          className="button secondary"
          onClick={() =>
            void firebaseServices()
              .auth.signOut()
              .catch((error: unknown) =>
                setError(error instanceof Error ? error.message : 'Sign-out failed'),
              )
          }
        >
          Sign out
        </button>
      </div>
    )
  if (!ready)
    return (
      <div className="app-loading" role="status">
        <Cloud />
        <span>Connecting to your journal...</span>
      </div>
    )
  return <AuthContext value={user}>{children}</AuthContext>
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [setup] = useState(() => {
    try {
      return { services: cloudConfigured ? firebaseServices() : undefined, error: '' }
    } catch (error) {
      return {
        services: undefined,
        error: error instanceof Error ? error.message : 'Authentication unavailable',
      }
    }
  })
  const [session, setSession] = useState<{ account: User | null }>()
  const user = session?.account
  const [error, setError] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  useEffect(() => {
    if (!setup.services) return
    return onAuthStateChanged(setup.services.auth, (account) => {
      setSession({ account })
      if (account) setLoginOpen(!account.emailVerified)
    }, (error) => setError(error.message))
  }, [setup])
  const errorMessage = error || setup.error
  if (cloudConfigured && user === undefined && !errorMessage)
    return (
      <div className="app-loading" role="status">
        Checking sign-in...
      </div>
    )
  return (
    <LoginContext value={() => setLoginOpen(true)}>
      {cloudConfigured && user?.emailVerified ? (
        <CloudSession key={user.uid} user={user}>{children}</CloudSession>
      ) : (
        <DemoSession>{children}</DemoSession>
      )}
      {loginOpen && !user?.emailVerified && (
        <LoginDialog user={user ?? null} initialError={errorMessage} onClose={() => setLoginOpen(false)} onVerified={(account) => {
          setSession({ account })
          setLoginOpen(false)
        }} />
      )}
    </LoginContext>
  )
}
