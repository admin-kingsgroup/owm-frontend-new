import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Building2, LayoutGrid, Receipt, BarChart3 } from 'lucide-react';

import { cn } from '@/shared/lib';

import { CompanySwitcher } from './CompanySwitcher';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

export function AppShell() {
  const { companyId } = useParams<{ companyId?: string }>();

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
              <NavLink
                to={`/companies/${companyId}/vouchers`}
                className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
              >
                <Receipt size={16} />
                Vouchers
              </NavLink>
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
            {companyId && <CompanySwitcher companyId={companyId} />}
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
