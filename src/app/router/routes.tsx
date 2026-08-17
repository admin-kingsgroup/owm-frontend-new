import type { RouteObject } from 'react-router-dom';

import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
