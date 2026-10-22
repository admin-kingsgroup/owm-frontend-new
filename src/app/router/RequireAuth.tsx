import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '@/features/auth';
import { PageSkeleton } from '@/shared/ui';

export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return <PageSkeleton variant="dashboard" heading label="Checking session…" />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
