import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <p style={{ color: 'var(--color-danger)', margin: 0, fontSize: '0.75rem', letterSpacing: '0.1em' }}>
            [ERR] runtime exception
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>
            {this.state.error?.message ?? 'an unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            $ retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
