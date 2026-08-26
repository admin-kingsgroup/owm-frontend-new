import { Suspense, lazy } from 'react';

import { Loading } from '@/shared/ui';

/*
  The reports screen, fetched when it is first opened rather than with everything else.

  Twenty-one statements live behind that one route — every view, every tree, every export — and
  bundled with the rest they were paid for by the sign-in screen, which needs none of them. It is by
  a wide margin the largest thing in the app and the only route large enough to be worth separating;
  splitting the small ones would trade one download for several round trips.

  In its own file, not in `routes.tsx`, because Fast Refresh only holds state across an edit when a
  module exports components and nothing else — and `routes.tsx` exports the route table. Same reason
  `RequireAuth` sits beside it rather than inside it.

  `lazy` wants a default export and the reports barrel deliberately has none, so the named one is
  renamed here rather than a default being added to the slice to suit the router.
*/
const ReportsPage = lazy(() =>
  import('@/pages/reports').then((module) => ({ default: module.ReportsPage })),
);

/**
 * Waits for the screen with the same spinner the screen uses for its figures, so arriving and
 * then reading look like one wait rather than two.
 */
export function ReportsRoute() {
  return (
    <Suspense fallback={<Loading label="Opening reports…" />}>
      <ReportsPage />
    </Suspense>
  );
}
