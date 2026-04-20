import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif', background: '#0b1020', color: '#e5e7eb', padding: 40,
        }}>
          <div style={{
            maxWidth: 560, background: '#1f2937', border: '1px solid #374151',
            borderRadius: 12, padding: 28,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171', marginBottom: 10 }}>
              Something broke
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>
              A rendering error took down the dashboard. Reload to try again.
            </div>
            <pre style={{
              background: '#111827', border: '1px solid #374151', borderRadius: 6,
              padding: 12, fontSize: 12, color: '#fca5a5', overflow: 'auto', maxHeight: 200,
            }}>{this.state.error.message}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16, background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}
            >Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
