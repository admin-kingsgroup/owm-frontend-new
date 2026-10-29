import type { RouteObject } from 'react-router-dom';

import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { CompaniesPage } from '@/pages/companies';
import { CompanyDashboardPage } from '@/pages/company';
import { VouchersPage } from '@/pages/vouchers';
import { AppShell } from '@/widgets/app-shell';

import { KgRoute } from './KgRoute';
import { ReportedErrorsRoute } from './ReportedErrorsRoute';
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
             is open. The endpoint behind it admits administrators only, so it is fetched on first
             open — see ReportedErrorsRoute. */
          { path: '/reported-errors', element: <ReportedErrorsRoute /> },
          { path: '/companies/:companyId', element: <CompanyDashboardPage /> },
          { path: '/companies/:companyId/vouchers', element: <VouchersPage /> },
          /* Fetched on first open rather than with everything else — see ReportsRoute. */
          { path: '/companies/:companyId/reports', element: <ReportsRoute /> },
          /* Fetched on first open — only KG-type companies ever reach it. See KgRoute. */
          { path: '/companies/:companyId/kg', element: <KgRoute /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];
