import type { RouteObject } from 'react-router-dom';

import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { CompaniesPage } from '@/pages/companies';
import { CompanyDashboardPage } from '@/pages/company';
import { VouchersPage } from '@/pages/vouchers';
import { ReportsPage } from '@/pages/reports';
import { KgPage } from '@/pages/kg';
import { AppShell } from '@/widgets/app-shell';

import { RequireAuth } from './RequireAuth';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/companies', element: <CompaniesPage /> },
          { path: '/companies/:companyId', element: <CompanyDashboardPage /> },
          { path: '/companies/:companyId/vouchers', element: <VouchersPage /> },
          { path: '/companies/:companyId/reports', element: <ReportsPage /> },
          { path: '/companies/:companyId/kg', element: <KgPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
