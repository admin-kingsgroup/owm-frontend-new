import type { RouteObject } from 'react-router-dom';

import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { CompaniesPage } from '@/pages/companies';
import { CompanyDashboardPage } from '@/pages/company';
import { VouchersPage } from '@/pages/vouchers';
import { KgPage } from '@/pages/kg';
import { ReportedErrorsPage } from '@/pages/reported-errors';
import { AppShell } from '@/widgets/app-shell';

import { RequireAuth } from './RequireAuth';
import { ReportsRoute } from './ReportsRoute';

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
          /* Not company-scoped: a fault can be reported from anywhere, including before a company
             is open. The endpoint behind it admits administrators only. */
          { path: '/reported-errors', element: <ReportedErrorsPage /> },
          { path: '/companies/:companyId', element: <CompanyDashboardPage /> },
          { path: '/companies/:companyId/vouchers', element: <VouchersPage /> },
          /* Fetched on first open rather than with everything else — see ReportsRoute. */
          { path: '/companies/:companyId/reports', element: <ReportsRoute /> },
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
