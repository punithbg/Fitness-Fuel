import { Component, type ReactNode } from 'react'

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  render() {
    if (this.state.error)
      return (
        <div className="app-error" role="alert">
          <h1>Unable to open your workspace</h1>
          <p>{this.state.error}</p>
          <p>
            Browser storage may be unavailable or full. Your existing records have not been cleared.
          </p>
          <button className="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )
    return this.props.children
  }
}
