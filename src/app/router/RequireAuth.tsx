import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '@/features/auth';
import { Loading } from '@/shared/ui';

export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return <Loading label="Checking session…" />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
