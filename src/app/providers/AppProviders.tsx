import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/features/auth';

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return children;
}
