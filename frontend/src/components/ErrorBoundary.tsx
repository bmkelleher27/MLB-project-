import { Component, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // A malformed feed or a rendering bug on one page shouldn't white-screen
    // the whole app; log for diagnosis and show a recoverable fallback.
    console.error('UI error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1 className="error-boundary-title">Something went wrong on this page</h1>
          <p className="error-boundary-message">{this.state.error.message}</p>
          <div className="error-boundary-actions">
            <Link to="/" className="random-game-btn">‹ Back to schedule</Link>
            <button className="random-game-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wraps the app's routes. Keyed by pathname so navigating to another page
 * remounts the boundary and clears a prior error — the user can recover by
 * clicking "Back to schedule" without a full reload.
 */
export function ErrorBoundary({ children }: Props) {
  const location = useLocation();
  return <ErrorBoundaryInner key={location.pathname}>{children}</ErrorBoundaryInner>;
}
