import { Suspense, lazy } from 'react';

import { PageSkeleton } from '@/shared/ui';

/*
  The reported-errors screen, fetched when it is first opened rather than with everything else.

  Administrators are the only ones the endpoint behind it admits, so bundled with the rest it was a
  download every other user paid for and could never use. In its own file for the same reasons
  `ReportsRoute` is — see there.
*/
const ReportedErrorsPage = lazy(() =>
  import('@/pages/reported-errors').then((module) => ({ default: module.ReportedErrorsPage })),
);

/** Waits with the same skeleton the screen shows while it reads the errors. */
export function ReportedErrorsRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" label="Opening reported errors…" />}>
      <ReportedErrorsPage />
    </Suspense>
  );
}
