import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { useCompanyStore } from '@/entities/company';
import { calendarYear, cn, formatCalendarDay } from '@/shared/lib';
import { useFocusTrap } from '@/shared/hooks';
import { ErrorBoundary } from '@/shared/ui';

import {
  ButtonBarContext,
  hasOpenDialog,
  isLetterBinding,
  isTypingTarget,
  matchesBinding,
} from '../model/button-bar';
import type { ButtonBarAction } from '../model/button-bar';
import { ButtonBar } from './ButtonBar';
import { buildMenus } from '../model/menus';
import { MenuBar } from './MenuBar';
import { CompanySwitcher } from './CompanySwitcher';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

/** "2026–27" from the year's own start and end, rather than a label stored anywhere. */
function financialYearLabel(start: string, end: string): string {
  const from = calendarYear(start);
  const to = calendarYear(end);
  return from === to ? String(from) : `${from}–${String(to).slice(-2)}`;
}

export function AppShell() {
  const { companyId } = useParams<{ companyId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navPanelRef = useRef<HTMLElement>(null);

  /**
   * Only ever true below 60rem, where the menu bar is an overlay rather than part of the page.
   * Above it the bar is always there and this is inert.
   */
  const [menuOpen, setMenuOpen] = useState(false);

  // Focus stays in the drawer while it is open, page scroll is locked behind it, and focus returns
  // to the button that opened it. Shared with the modal — see useFocusTrap.
  useFocusTrap(menuOpen, navPanelRef);
  const inCompany = Boolean(companyId);

  /**
   * The company list, read on entering a company and shared by the switcher, the menus and the
   * context strip. The menus need it because a company's features decide which reports exist and an
   * analytics workspace posts nothing, so it gets Portfolio where the others get Vouchers. Keyed on
   * `inCompany` rather than `companyId`, so switching company reuses the list it just read instead
   * of fetching it again.
   */
  // The same list the companies page holds, rather than a second copy. Sharing it means entering
  // a company costs no extra request, and a company created or renamed on that page reaches the
  // switcher without a reload. A failed load leaves it null, which the menus and the switcher each
  // already handle: chrome, not content.
  const companies = useCompanyStore((state) => state.companies);
  const loadCompanies = useCompanyStore((state) => state.load);

  useEffect(() => {
    if (!inCompany) return;
    void loadCompanies();
  }, [inCompany, loadCompanies]);

  /**
   * `null` until the list arrives, and after a load that failed. Everything drawn from it — the
   * feature-dependent menu items, the context strip — is chrome, so it simply renders less until
   * the answer is known rather than holding the screen back for it.
   */
  const company = useMemo(
    () => (companyId ? (companies?.find((entry) => entry.id === companyId) ?? null) : null),
    [companies, companyId],
  );

  const menus = useMemo(() => buildMenus(companyId, company), [companyId, company]);

  /** What the open screen contributes to the button bar. See useButtonBar. */
  const [pageActions, setPageActions] = useState<ButtonBarAction[]>([]);

  const publish = useCallback((actions: ButtonBarAction[]) => {
    setPageActions(actions);
    // Guarded so a screen unmounting *after* the next one has published does not blank the bar the
    // new screen just filled — which is the order React tears down and mounts routes in.
    return () => setPageActions((current) => (current === actions ? [] : current));
  }, []);

  const buttonBarContext = useMemo(() => ({ publish }), [publish]);

  /**
   * The destinations the shell can reach on its own, so every screen has a way out of it without
   * each one having to say so. Pages publish theirs first; these always sit at the bottom.
   */
  const shellActions = useMemo<ButtonBarAction[]>(() => {
    if (!companyId) return [];
    const base = `/companies/${companyId}`;
    const go = (to: string) => () => navigate(to);

    return [
      { group: 'Go to', key: 'Alt+O', label: 'Overview', onSelect: go(base) },
      ...(company?.type === 'ANALYTICS'
        ? [{ group: 'Go to', key: 'Alt+V', label: 'Portfolio', onSelect: go(`${base}/kg`) }]
        : [{ group: 'Go to', key: 'Alt+V', label: 'Vouchers', onSelect: go(`${base}/vouchers`) }]),
      {
        group: 'Go to',
        key: 'Alt+B',
        label: 'Balance Sheet',
        onSelect: go(`${base}/reports?report=balance-sheet`),
      },
      {
        group: 'Go to',
        key: 'Alt+P',
        label: 'Profit & Loss',
        onSelect: go(`${base}/reports?report=profit-loss`),
      },
      {
        group: 'Go to',
        key: 'Alt+D',
        label: 'Day Book',
        onSelect: go(`${base}/reports?report=day-book`),
      },
    ];
  }, [companyId, company, navigate]);

  const actions = useMemo(() => [...pageActions, ...shellActions], [pageActions, shellActions]);

  /**
   * The bar's shortcuts, bound once for all of them.
   *
   * A binding that ends in a letter stands aside while someone is typing: Ctrl+A must still select
   * the narration it is pressed in. Function keys and Ctrl+Enter type nothing, so they fire
   * wherever focus happens to be — which is what makes a voucher acceptable without leaving the
   * last field.
   */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      // A dialog owns the keyboard while it is open — see hasOpenDialog.
      if (hasOpenDialog()) return;

      for (const action of actions) {
        if (action.disabled) continue;
        if (!matchesBinding(action.key, event)) continue;
        if (isLetterBinding(action.key) && isTypingTarget(event.target)) return;

        event.preventDefault();
        action.onSelect();
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

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
      {/* Only ever visible below 60rem, where the menus cover the page rather than sitting on it. */}
      {menuOpen && (
        <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <header className={styles.topbar}>
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

        <div className={styles.brand}>
          <span className={styles.brandMark}>K</span>
          <span className={styles.brandName}>KBiz360 OWM</span>
        </div>

        <nav
          id="app-navigation"
          ref={navPanelRef}
          className={cn(styles.navPanel, menuOpen && styles.navPanelOpen)}
          // Announced as a dialog only when it is one; above 60rem it is simply part of the page.
          {...(menuOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation' } : {})}
        >
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          <MenuBar menus={menus} onNavigate={() => setMenuOpen(false)} />
        </nav>

        {/* Always present, even when the switcher renders nothing: the topbar pushes this group to
            the end, so dropping it would slide the user menu left while the list is still loading. */}
        <div className={styles.topbarEnd}>
          {companyId && <CompanySwitcher companyId={companyId} companies={companies} />}
          <UserMenu />
        </div>
      </header>

      {/*
        The context strip. Which company, which year, which period and which currency every figure
        below is in — stated once for the whole application, because a statement read against the
        wrong year is not a mistake anyone catches by looking at the figures.
      */}
      {company && (
        <div className={styles.context}>
          <span className={styles.contextItem}>
            Company <b>{company.name}</b>
          </span>
          <span className={styles.contextItem}>
            Financial year{' '}
            <b>{financialYearLabel(company.financialYearStart, company.financialYearEnd)}</b>{' '}
            {/*
              The year's own span, not "the period these figures cover" — a report can be narrowed
              to a month from its own toolbar, and a strip claiming the whole year over a
              first-quarter balance sheet is worse than saying nothing. Each report prints the
              period it was actually run for beneath its own title.
            */}
            <span className={styles.contextRange}>
              {formatCalendarDay(company.financialYearStart, company.country)} –{' '}
              {formatCalendarDay(company.financialYearEnd, company.country)}
            </span>
          </span>
          <span className={styles.contextItem}>
            Base currency <b>{company.baseCurrency}</b>
          </span>
        </div>
      )}

      <div className={styles.body}>
        <main className={styles.content}>
          {/*
            Keyed on the path so navigating away clears a caught error. React boundaries do not
            reset themselves, and without the key one broken screen would follow you around the app.
          */}
          <ErrorBoundary key={location.pathname}>
            <ButtonBarContext.Provider value={buttonBarContext}>
              <Outlet />
            </ButtonBarContext.Provider>
          </ErrorBoundary>
        </main>

        <ButtonBar actions={actions} />
      </div>

      {/* Application chrome — see the print block in globals.css, which drops it from paper. */}
      <div className={styles.status} data-print="hide">
        <span>{company ? `${company.name} · ${company.code}` : 'No company open'}</span>
        <span className={styles.statusEnd}>
          {company ? `Figures in ${company.baseCurrency}` : 'Choose a company to open its books'}
        </span>
      </div>
    </div>
  );
}
