import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { ErrorBoundary } from '@/shared/ui';

export function App() {
  return (
    <AppProviders>
      {/*
        Last resort. The shell carries its own boundary around the routed screen, so this one only
        ever sees a throw from the shell itself, the router, or a screen that sits outside it —
        the home and not-found pages. Without it those would still blank the window.
      */}
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </AppProviders>
  );
}
