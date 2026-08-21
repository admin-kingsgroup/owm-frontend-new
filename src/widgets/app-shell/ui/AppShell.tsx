import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Building2, LayoutGrid, Receipt, BarChart3, PieChart } from 'lucide-react';

import { listCompanies } from '@/entities/company';
import type { Company } from '@/entities/company';
import { cn } from '@/shared/lib';

import { CompanySwitcher } from './CompanySwitcher';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

export function AppShell() {
  const { companyId } = useParams<{ companyId?: string }>();
  const inCompany = Boolean(companyId);

  /**
   * The company list, read on entering a company and shared by the switcher and the sidebar. The
   * sidebar needs it because an analytics workspace posts nothing and so gets Portfolio where the
   * others get Vouchers — the same either/or the company overview draws — and that turns on the
   * company's type. Keyed on `inCompany` rather than `companyId`, so switching company reuses the
   * list it just read instead of fetching it again.
   */
  const [companies, setCompanies] = useState<Company[] | null>(null);

  useEffect(() => {
    if (!inCompany) return;
    let cancelled = false;

    listCompanies()
      .then((result) => {
        if (!cancelled) setCompanies(result);
      })
      .catch(() => {
        // Chrome, not content. The shell still works without the list: the switcher hides itself
        // and the section link below settles on Vouchers rather than vanishing.
        if (!cancelled) setCompanies([]);
      });

    return () => {
      cancelled = true;
    };
  }, [inCompany]);

  /**
   * `null` while the list is still in flight. Vouchers and Portfolio are mutually exclusive, so
   * the slot stays empty until the answer is known — showing one and then swapping it for the
   * other would offer a link that is about to disappear.
   */
  const section =
    !companyId || companies === null
      ? null
      : companies.find((company) => company.id === companyId)?.type === 'ANALYTICS'
        ? 'portfolio'
        : 'vouchers';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>K</span>
          <div>
            <div className={styles.brandName}>KBiz360 OWM</div>
            <div className={styles.brandSub}>Owner Wealth &amp; Oversight</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/companies"
            end
            className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
          >
            <Building2 size={16} />
            Companies
          </NavLink>

          {companyId && (
            <>
              <NavLink
                to={`/companies/${companyId}`}
                end
                className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
              >
                <LayoutGrid size={16} />
                Overview
              </NavLink>
              {section === 'portfolio' && (
                <NavLink
                  to={`/companies/${companyId}/kg`}
                  className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
                >
                  <PieChart size={16} />
                  Portfolio
                </NavLink>
              )}
              {section === 'vouchers' && (
                <NavLink
                  to={`/companies/${companyId}/vouchers`}
                  className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
                >
                  <Receipt size={16} />
                  Vouchers
                </NavLink>
              )}
              <NavLink
                to={`/companies/${companyId}/reports`}
                className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
              >
                <BarChart3 size={16} />
                Reports
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {/* Always present, even when the switcher renders nothing: the topbar is
              space-between, so dropping this element would slide the user menu to the left
              while the company list is still loading. */}
          <div className={styles.topbarLead}>
            {companyId && <CompanySwitcher companyId={companyId} companies={companies} />}
          </div>
          <UserMenu />
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
