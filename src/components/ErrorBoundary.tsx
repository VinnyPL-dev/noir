import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from './ui/Button'
import { EmptyState } from './ui/EmptyState'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NOIR UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid h-full place-items-center bg-noir-black">
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong"
          description={this.state.error.message || 'An unexpected error interrupted this view.'}
          action={
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }
}
