import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class RenderErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('pfile render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-[var(--s1)] text-[var(--tx1)] p-8">
          <div className="max-w-xl rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-5">
            <h1 className="font-semibold text-[var(--danger-text)]">The workspace could not be rendered</h1>
            <p className="mt-2 text-xs text-[var(--tx3)]">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RenderErrorBoundary>
      <App />
    </RenderErrorBoundary>
  </React.StrictMode>
);
