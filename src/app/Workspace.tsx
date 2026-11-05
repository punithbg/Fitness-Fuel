import { Activity, HardDrive, Cloud, LogOut, UserRound, Settings as SettingsIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { initialize, useFitnessData } from '../data'
import { today } from '../domain'
import { DatePicker } from '../shared/ui'
import { navigation } from './navigation'
import { ThemeToggle } from '../theme/ThemeControls'
import { useAccount, useOpenLogin } from '../features/auth/AuthContext'
import { LocalImportPrompt } from '../features/auth/LocalImportPrompt'
import { firebaseServices } from '../data/cloud/firebase'
import { cloudSnapshot, subscribeCloud } from '../data/cloud/session'

const Dashboard = lazy(() => import('../features/dashboard'))

const FoodDiary = lazy(() => import('../features/food'))

const Workouts = lazy(() => import('../features/workouts'))

const Library = lazy(() => import('../features/library'))

const FoodDirectory = lazy(() => import('../features/library/FoodDirectory'))

const Progress = lazy(() => import('../features/progress'))

const Settings = lazy(() => import('../features/settings'))

export function Workspace() {
  const account = useAccount()
  const openLogin = useOpenLogin()
  const cloud = useSyncExternalStore(subscribeCloud, cloudSnapshot)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    window.addEventListener('online', changed)
    window.addEventListener('offline', changed)
    return () => {
      window.removeEventListener('online', changed)
      window.removeEventListener('offline', changed)
    }
  }, [])
  const data = useFitnessData()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState(today())
  const location = useLocation()
  useEffect(() => {
    void initialize()
      .then(() => setReady(true))
      .catch((error) => setError(error instanceof Error ? error.message : 'Storage unavailable'))
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  if (error) throw new Error(error)
  if (!ready || !data)
    return (
      <div className="app-loading" role="status">
        <Activity size={32} />
        <span>Opening your journal...</span>
      </div>
    )
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            Fitness<span className="brand-amp">&</span>Fuel<small>PERSONAL FITNESS</small>
          </span>
        </Link>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(({ path, label, Icon }) => (
            <NavLink end={path === '/'} to={path} key={path} aria-label={label} title={label}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink className="settings-link" to="/settings">
            <SettingsIcon size={19} />
            Settings
          </NavLink>
          <div className="local-profile">
            <span className="profile-icon">
              {account ? <Cloud size={18} /> : <HardDrive size={18} />}
            </span>
            <div>
              <strong>
                {account?.displayName ?? (account ? 'Your account' : 'Demo workspace')}
              </strong>
              <small className="account-address">{account?.email ?? 'Two-week preview'}</small>
            </div>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-label">
            <span className="status-dot" />
            Your fitness journal
          </div>
          <Link className="mobile-brand" to="/">
            <Activity size={22} />
            Fitness&amp;Fuel
          </Link>
          <div className="topbar-actions">
            {!['/library', '/settings', '/food-directory'].includes(location.pathname) && (
              <DatePicker date={date} onChange={setDate} />
            )}
            <div className="header-tools">
              <ThemeToggle />
              {account && (
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => {
                    if (window.confirm('Sign out? Any unsaved form changes will be discarded.'))
                      void firebaseServices()
                        .auth.signOut()
                        .catch((error: unknown) =>
                          setError(error instanceof Error ? error.message : 'Sign-out failed'),
                        )
                  }}
                >
                  <LogOut size={19} />
                </button>
              )}
              <Link className="icon-button" aria-label="Settings" title="Settings" to="/settings">
                <SettingsIcon size={19} />
              </Link>
              {!account && (
                <button className="icon-button" aria-label="Log in / Register" title="Log in / Register" onClick={openLogin}>
                  <UserRound size={19} />
                </button>
              )}
            </div>
          </div>
        </header>
        <main id="main">
          {!account && (
            <p className="connection-banner" role="status">
              Demo preview - two weeks of fictional data. Sign in to open your own journal.
            </p>
          )}
          {account && !online && (
            <p className="connection-banner" role="alert">
              Offline. Changes cannot be saved until you reconnect.
            </p>
          )}
          <LocalImportPrompt />
          <Suspense
            fallback={
              <div className="empty" role="status">
                Loading journal...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Dashboard data={data} date={date} />} />
              <Route path="/food" element={<FoodDiary data={data} date={date} />} />
              <Route path="/workouts" element={<Workouts data={data} date={date} />} />
              <Route path="/library" element={<Library data={data} />} />
              <Route path="/food-directory" element={<FoodDirectory data={data} />} />
              <Route path="/progress" element={<Progress data={data} date={date} />} />
              <Route path="/settings" element={<Settings data={data} />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>Page not found</h1>
                    <Link to="/">Back to overview</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
          <footer className="page-footer">
            <span>FITNESS&amp;FUEL</span>
            <span>
              {account ? <Cloud size={13} /> : <HardDrive size={13} />}
              {account
                ? !online
                  ? 'Offline'
                  : cloud.connected
                    ? 'Cloud connected - automatic saving'
                    : 'Waiting for cloud connection'
                : 'Sample data - not saved'}
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ path, label, mobile, Icon }) => (
          <NavLink end={path === '/'} to={path} key={path} aria-label={label} title={label}>
            <Icon size={20} />
            <span>{mobile}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
