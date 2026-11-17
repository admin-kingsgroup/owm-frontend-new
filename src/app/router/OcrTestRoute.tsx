import { Suspense, lazy } from 'react';

import { PageSkeleton } from '@/shared/ui';

/*
  The OCR test bench, fetched when it is first opened rather than with everything else — a testing
  tool only administrators can use, so bundled with the rest it would be a download every other
  user paid for. Same arrangement as ReportedErrorsRoute.
*/
const OcrTestPage = lazy(() =>
  import('@/pages/ocr-test').then((module) => ({ default: module.OcrTestPage })),
);

export function OcrTestRoute() {
  return (
    <Suspense fallback={<PageSkeleton variant="rows" label="Opening OCR test…" />}>
      <OcrTestPage />
    </Suspense>
  );
}
