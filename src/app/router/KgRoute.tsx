import { Suspense, lazy } from 'react';

import { PageSkeleton } from '@/shared/ui';

/*
  The KG Business screen, fetched when it is first opened rather than with everything else.

  Only KG-type companies ever reach it, yet bundled with the rest it was downloaded by every
  sign-in. In its own file for the same reasons `ReportsRoute` is — see there.
*/
const KgPage = lazy(() => import('@/pages/kg').then((module) => ({ default: module.KgPage })));

/** Waits with the same skeleton the screen shows while it reads the businesses. */
export function KgRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" label="Opening KG Business…" />}>
      <KgPage />
    </Suspense>
  );
}
