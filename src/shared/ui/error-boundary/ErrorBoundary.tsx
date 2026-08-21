import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, Check } from 'lucide-react';

import { reportClientError } from '@/shared/lib';

import { Button } from '../button';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Replaces the default panel, for a boundary that needs to say something of its own. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** The filed report's reference, which is what the person on screen is given to quote. */
  reference: string | null;
  copied: boolean;
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
  state: ErrorBoundaryState = { error: null, reference: null, copied: false };

  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The boundary swallows the throw, so this is the only place the stack still reaches. The
    // reporter logs it as well as filing it, which is what keeps a failed report from being silent.
    const reference = reportClientError({
      kind: 'RENDER',
      error,
      componentStack: info.componentStack ?? undefined,
    });

    this.setState({ reference });
  }

  componentWillUnmount(): void {
    clearTimeout(this.copyTimer);
  }

  private handleRetry = (): void => {
    this.setState({ error: null, reference: null, copied: false });
  };

  private handleCopy = (): void => {
    const { reference } = this.state;
    if (!reference) return;

    void navigator.clipboard?.writeText(reference).then(() => {
      this.setState({ copied: true });
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.setState({ copied: false }), 2_000);
    });
  };

  render(): ReactNode {
    const { error, reference, copied } = this.state;

    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className={styles.wrapper} role="alert">
        <div className={styles.icon}>
          <AlertTriangle size={32} />
        </div>
        <p className={styles.title}>This screen ran into a problem</p>
        <p className={styles.description}>
          It has been reported. The rest of the app is still working — try again, or move to another
          screen.
        </p>

        {/*
          A reference, not the exception text. The message meant nothing to the person reading it
          and everything to whoever has to find the fault; the reference means something to both,
          and it names one record on the server rather than describing a class of them.
        */}
        {reference && (
          <div className={styles.reference}>
            <span className={styles.referenceLabel}>Reference</span>
            <code className={styles.referenceValue}>{reference}</code>
            <button
              type="button"
              className={styles.copy}
              onClick={this.handleCopy}
              aria-label={copied ? 'Reference copied' : 'Copy reference'}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        <Button type="button" variant="secondary" onClick={this.handleRetry}>
          <RotateCcw size={14} /> Try again
        </Button>
      </div>
    );
  }
}
