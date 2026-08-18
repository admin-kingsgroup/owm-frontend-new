import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Building2, LayoutGrid, Receipt } from 'lucide-react';

import { useAuthStore, LogoutButton } from '@/features/auth';
import { cn } from '@/shared/lib';

import styles from './AppShell.module.css';

export function AppShell() {
  const user = useAuthStore((state) => state.user);
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
            </>
          )}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div />
          <div className={styles.userBox}>
            {user && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userEmail}>{user.email}</span>
              </div>
            )}
            <LogoutButton />
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
