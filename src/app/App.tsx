import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { PwaUpdatePrompt } from '@/features/pwa';
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
      {/*
        Outside the boundary on purpose. A screen that throws is exactly when an update is most
        worth offering, and inside it the prompt would be replaced by the fallback along with
        everything else.
      */}
      <PwaUpdatePrompt />
    </AppProviders>
  );
}
