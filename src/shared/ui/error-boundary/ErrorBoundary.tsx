import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '../button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Replaces the default panel, for a boundary that needs to say something of its own. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps one screen's render error from taking the whole application with it. React unmounts the
 * entire tree when a render throws, so without a boundary a single bad figure blanks the page —
 * sidebar, navigation and all — and the only way back is a manual reload.
 *
 * A class because `componentDidCatch` has no hook equivalent. Remounting it clears a caught error,
 * so give it a `key` that changes on navigation; the button below clears it in place.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The boundary swallows the throw, so this is the only place the stack still reaches — without
    // it a caught error leaves no record at all.
    console.error('Unhandled render error', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className={styles.wrapper} role="alert">
        <div className={styles.icon}>
          <AlertTriangle size={32} />
        </div>
        <p className={styles.title}>This screen ran into a problem</p>
        <p className={styles.description}>
          The rest of the app is still working — try again, or move to another screen.
        </p>
        {/* The message, not the stack: enough to report the fault without pasting internals at
            someone who only wanted to read a balance. */}
        <p className={styles.detail}>{error.message}</p>
        <Button type="button" variant="secondary" onClick={this.handleRetry}>
          <RotateCcw size={14} /> Try again
        </Button>
      </div>
    );
  }
}
