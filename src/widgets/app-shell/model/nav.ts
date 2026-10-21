import type { Company } from '@/entities/company';

export type NavIcon =
  'group' | 'dashboard' | 'masters' | 'vouchers' | 'reports' | 'portfolio' | 'audit' | 'errors';

export interface NavItem {
  id: string;
  label: string;
  icon: NavIcon;
  to: string;
  /** The key that reaches it from anywhere, printed beside it. */
  hint?: string;
  /** The heading it sits under in the sidebar. */
  section: 'Overview' | 'Books' | 'Records';
  active: boolean;
}

/**
 * The sidebar: seven places, and nothing that depends on which report is open.
 *
 * Deliberately short. Every report, register and master screen is still one search away (Ctrl+K,
 * built from `buildMenus`, so the feature rules that decide what a company can reach are the same
 * ones they always were). The sidebar is for the handful of places a day is spent in.
 *
 * Inside a company the list depends on its kind, exactly as the menus did: a portfolio workspace
 * posts nothing, so it gets Portfolio where a set of books gets Reports.
 */
export function buildNav(
  companyId: string | undefined,
  company: Company | null,
  pathname: string,
  search: string,
  isAdmin = false,
): NavItem[] {
  const params = new URLSearchParams(search);
  const errors: NavItem[] = isAdmin
    ? [
        {
          id: 'errors',
          label: 'Reported errors',
          icon: 'errors',
          to: '/reported-errors',
          section: 'Records',
          active: pathname === '/reported-errors',
        },
      ]
    : [];

  const group: NavItem = {
    id: 'group',
    label: 'Group overview',
    icon: 'group',
    to: '/companies',
    hint: 'Alt+G',
    section: 'Overview',
    active: pathname === '/companies',
  };

  if (!companyId) return [group, ...errors];

  const base = `/companies/${companyId}`;
  const isPortfolio = company?.type === 'ANALYTICS';
  const onReports = pathname === `${base}/reports`;
  const isAudit = onReports && params.get('report') === 'audit';

  return [
    group,
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      to: base,
      hint: 'Alt+O',
      section: 'Overview',
      active: pathname === base && !params.get('tab'),
    },
    {
      id: 'masters',
      label: 'Masters',
      icon: 'masters',
      to: `${base}?tab=accounts`,
      hint: 'Alt+M',
      section: 'Books',
      active: pathname === base && !!params.get('tab'),
    },
    {
      id: 'vouchers',
      label: 'Vouchers',
      icon: 'vouchers',
      to: `${base}/vouchers`,
      // Alt+V opens the portfolio in a workspace — printing it here as well would name one key for
      // two places.
      hint: isPortfolio ? undefined : 'Alt+V',
      section: 'Books',
      active: pathname === `${base}/vouchers`,
    },
    ...(isPortfolio
      ? [
          {
            id: 'portfolio',
            label: 'Portfolio',
            icon: 'portfolio' as const,
            to: `${base}/kg`,
            hint: 'Alt+V',
            section: 'Books' as const,
            active: pathname === `${base}/kg`,
          },
        ]
      : [
          {
            id: 'reports',
            label: 'Reports',
            icon: 'reports' as const,
            to: `${base}/reports`,
            hint: 'Alt+B',
            section: 'Books' as const,
            active: onReports && !isAudit,
          },
        ]),
    {
      id: 'audit',
      label: 'Audit trail',
      icon: 'audit',
      to: `${base}/reports?report=audit`,
      section: 'Records',
      active: isAudit,
    },
    ...errors,
  ];
}

/** The name of the screen that is open, for the breadcrumb. */
export function screenName(pathname: string, search: string, companyId?: string): string {
  if (pathname === '/companies') return 'Group overview';
  if (pathname === '/reported-errors') return 'Reported errors';
  if (!companyId) return '';
  const base = `/companies/${companyId}`;
  const params = new URLSearchParams(search);
  if (pathname === base) return params.get('tab') ? 'Masters' : 'Dashboard';
  if (pathname === `${base}/vouchers`) return 'Vouchers';
  if (pathname === `${base}/kg`) return 'Portfolio';
  if (pathname === `${base}/reports`)
    return params.get('report') === 'audit' ? 'Audit trail' : 'Reports';
  return '';
}
