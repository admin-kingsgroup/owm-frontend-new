import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { Building2, LayoutGrid, Receipt, BarChart3, PieChart, Menu, X } from 'lucide-react';

import { useCompanyStore } from '@/entities/company';
import { cn } from '@/shared/lib';
import { useFocusTrap } from '@/shared/hooks';
import { ErrorBoundary } from '@/shared/ui';

import { CompanySwitcher } from './CompanySwitcher';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

export function AppShell() {
  const { companyId } = useParams<{ companyId?: string }>();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  /**
   * Only ever true below 60rem, where the rail is an overlay rather than part of the page. Above
   * it the sidebar is always there and this is inert.
   */
  const [menuOpen, setMenuOpen] = useState(false);

  // Focus stays in the drawer while it is open, page scroll is locked behind it, and focus returns
  // to the button that opened it. Shared with the modal — see useFocusTrap.
  useFocusTrap(menuOpen, sidebarRef);
  const inCompany = Boolean(companyId);

  /**
   * The company list, read on entering a company and shared by the switcher and the sidebar. The
   * sidebar needs it because an analytics workspace posts nothing and so gets Portfolio where the
   * others get Vouchers — the same either/or the company overview draws — and that turns on the
   * company's type. Keyed on `inCompany` rather than `companyId`, so switching company reuses the
   * list it just read instead of fetching it again.
   */
  // The same list the companies page holds, rather than a second copy. Sharing it means entering
  // a company costs no extra request, and a company created or renamed on that page reaches the
  // switcher without a reload. A failed load leaves it null, which the section link below and the
  // switcher each already handle: chrome, not content.
  const companies = useCompanyStore((state) => state.companies);
  const listLoaded = useCompanyStore((state) => state.loaded);
  const loadCompanies = useCompanyStore((state) => state.load);

  useEffect(() => {
    if (!inCompany) return;
    void loadCompanies();
  }, [inCompany, loadCompanies]);

  /**
   * `null` only while the list is still in flight. Vouchers and Portfolio are mutually exclusive,
   * so the slot stays empty until the answer is known — showing one and then swapping it for the
   * other would offer a link that is about to disappear.
   *
   * Keyed on the store's `loaded` rather than on `companies === null`, because those are not the
   * same thing: a failed load settles with no data, and reading it as "still loading" would leave
   * a company with no section link at all until the page was reloaded. Settled-but-empty falls
   * through to Vouchers, which is what two of the three company types want.
   */
  const section =
    !companyId || !listLoaded
      ? null
      : companies?.find((company) => company.id === companyId)?.type === 'ANALYTICS'
        ? 'portfolio'
        : 'vouchers';

  /**
   * Below 60rem the nav is a strip that scrolls sideways, and the item you are on can sit past its
   * right edge — leaving the one cue that says which section you are in off screen. It depends on
   * `section` as well as the path because the strip only becomes wider than the screen once the
   * reserved slot has resolved into a real link. `nearest` everywhere means this does nothing at
   * all on the vertical rail, where every item always fits.
   */
  useEffect(() => {
    let cancelled = false;

    function reveal() {
      if (cancelled) return;
      const active = navRef.current?.querySelector(`.${styles.navLinkActive}`);
      active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }

    reveal();
    /*
      Again once the webfonts land. The strip is first laid out in the fallback face, and when
      Inter swaps in every item changes width — enough to slide the item just revealed back off
      the edge. Already-resolved after the first navigation, so this costs a microtask.
    */
    document.fonts?.ready.then(reveal);

    return () => {
      cancelled = true;
    };
  }, [location.pathname, section]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      {/* Only ever visible below 60rem, where the sidebar covers the page rather than sitting beside it. */}
      {menuOpen && (
        <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="app-navigation"
        ref={sidebarRef}
        className={cn(styles.sidebar, menuOpen && styles.sidebarOpen)}
        // Announced as a dialog only when it is one; above 60rem it is simply part of the page.
        {...(menuOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation' } : {})}
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>K</span>
          <div>
            <div className={styles.brandName}>KBiz360 OWM</div>
            <div className={styles.brandSub}>Owner Wealth &amp; Oversight</div>
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/*
          Following a link is the whole point of the drawer, so it closes itself rather than
          sitting over the screen it was just used to reach. Delegated to the container: one
          handler covers every destination, including the ones added later, and it is the click
          that closes the drawer rather than an effect watching the URL for a change it caused.
        */}
        <nav className={styles.nav} ref={navRef} onClick={() => setMenuOpen(false)}>
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
              {/*
                Holds the row until the answer arrives. Rendering nothing would let Reports sit one
                row higher for as long as the company list takes, then jump — a shift on the one
                control someone is most likely to be reaching for.
              */}
              {section === null && (
                <span className={cn(styles.navLink, styles.navPlaceholder)} aria-hidden="true">
                  {/* An icon-sized box and a text line, so the row measures exactly like a real
                      one without a hardcoded height to drift from it. */}
                  <span className={styles.navPlaceholderIcon} />
                  &nbsp;
                </span>
              )}
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
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
          >
            <Menu size={20} />
          </button>

          <div className={styles.topbarLead}>
            {companyId && <CompanySwitcher companyId={companyId} companies={companies} />}
          </div>
          <UserMenu />
        </header>

        <main className={styles.content}>
          {/*
            Keyed on the path so navigating away clears a caught error. React boundaries do not
            reset themselves, and without the key one broken screen would follow you around the app.
          */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
