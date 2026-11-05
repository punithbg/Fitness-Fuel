import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, LogIn, Mail, RefreshCw, UserPlus } from 'lucide-react'
import {
  createUserWithEmailAndPassword, getIdToken, GoogleAuthProvider, reload,
  sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, type User,
} from 'firebase/auth'
import { cloudConfigured, firebaseServices } from '../../data/cloud/firebase'
import { Field, Modal } from '../../shared/ui'

function loginError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : ''
  switch (code) {
    case 'auth/unauthorized-domain':
      return `Add ${window.location.hostname} in Firebase Console > Authentication > Settings > Authorized domains, then retry. For local Google login, open http://localhost:5175.`
    case 'auth/operation-not-allowed':
      return 'Enable this sign-in provider under Firebase Console > Authentication > Sign-in method.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is incorrect. Try Google sign-in or reset your password.'
    case 'auth/email-already-in-use':
      return 'An account already uses this email. Log in, use Google, or reset your password.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Choose a stronger password that meets the Firebase project password policy.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait before trying again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled. You can try again or continue browsing the demo.'
    case 'auth/popup-blocked':
      return 'Allow pop-ups for this site, then try Google sign-in again.'
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your connection and retry.'
    default:
      return error instanceof Error ? error.message : 'Sign-in failed. Please retry.'
  }
}

export function LoginDialog({ user, initialError = '', onClose, onVerified }: {
  user: User | null
  initialError?: string
  onClose: () => void
  onVerified: (user: User) => void
}) {
  const [mode, setMode] = useState<'choose' | 'login' | 'register' | 'reset'>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await action() }
    catch (error) { setError(loginError(error)) }
    finally { setBusy(false) }
  }
  function changeMode(next: typeof mode) {
    setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmation(''); setShowPassword(false)
  }
  return <Modal title="Log in / Register" onClose={onClose}>
    <div className="login-content">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!cloudConfigured && <p className="muted">Cloud setup required. Firebase configuration is incomplete.</p>}
      {user && !user.emailVerified ? <>
        <h3>Verify your email</h3>
        <p className="account-address">{user.email}</p>
        <p className="muted">Open the verification link in your email before accessing your private journal.</p>
        <div className="auth-options">
          <button className="button" disabled={busy} onClick={() => void run(async () => {
            await reload(user)
            if (!user.emailVerified) throw new Error('Email is not verified yet. Open the link in your inbox and try again.')
            await getIdToken(user, true)
            onVerified(user)
          })}><RefreshCw size={18} />I have verified my email</button>
          <button className="button secondary" disabled={busy} onClick={() => void run(async () => {
            await sendEmailVerification(user)
            setMessage('Verification email sent. Check your inbox and spam folder.')
          })}><Mail size={18} />Resend verification email</button>
          <button className="text-button" disabled={busy} onClick={() => void run(async () => {
            await signOut(firebaseServices().auth)
            changeMode('choose')
          })}>Use another account</button>
        </div>
      </> : mode === 'choose' ? <div className="auth-options">
        <button className="button" disabled={!cloudConfigured || busy} onClick={() => changeMode('login')}><Mail size={18} />Continue with email</button>
        <button className="button secondary" disabled={!cloudConfigured || busy} onClick={() => void run(async () => {
          const provider = new GoogleAuthProvider()
          provider.setCustomParameters({ prompt: 'select_account' })
          await signInWithPopup(firebaseServices().auth, provider)
        })}><LogIn size={18} />{busy ? 'Signing in...' : 'Continue with Google'}</button>
      </div> : <>
        <button className="text-button auth-back" disabled={busy} onClick={() => changeMode('choose')}><ArrowLeft size={17} />Other sign-in options</button>
        {mode !== 'reset' ? <div className="auth-tabs" role="tablist" aria-label="Email account action">
          <button type="button" role="tab" aria-selected={mode === 'login'} disabled={busy} onClick={() => changeMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} disabled={busy} onClick={() => changeMode('register')}>Register</button>
        </div> : <h3>Reset password</h3>}
        <form onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            const auth = firebaseServices().auth
            if (mode === 'reset') {
              try { await sendPasswordResetEmail(auth, email.trim()) }
              catch (error) {
                if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found')) throw error
              }
              setMessage('If an account can receive a password reset, an email has been sent. Check your inbox and spam folder.')
            } else if (mode === 'register') {
              if (password !== confirmation) throw new Error('Passwords do not match.')
              const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
              setPassword(''); setConfirmation('')
              await sendEmailVerification(result.user)
              setMessage('Verification email sent. Check your inbox and spam folder.')
            } else {
              await signInWithEmailAndPassword(auth, email.trim(), password)
              setPassword('')
            }
          })
        }}>
          <Field label="Email address"><input autoFocus required type="email" autoComplete="email" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></Field>
          {mode !== 'reset' && <>
            <Field label="Password"><span className="password-input">
              <input required type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} maxLength={4096} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span></Field>
            {mode === 'register' && <Field label="Confirm password"><input required type="password" autoComplete="new-password" maxLength={4096} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} /></Field>}
          </>}
          <button className="button auth-submit" type="submit" disabled={busy}>{mode === 'register' ? <UserPlus size={18} /> : mode === 'reset' ? <Mail size={18} /> : <LogIn size={18} />}{busy ? 'Please wait...' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Log in'}</button>
          {mode === 'login' && <button type="button" className="text-button" disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>}
        </form>
      </>}
    </div>
  </Modal>
}