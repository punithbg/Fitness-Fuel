import { BrowserRouter } from 'react-router-dom'
import { AppErrorBoundary } from './AppErrorBoundary'
import { Workspace } from './Workspace'
import { AuthGate } from '../features/auth/AuthGate'

export default function FitnessApp() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthGate>
          <Workspace />
        </AuthGate>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
