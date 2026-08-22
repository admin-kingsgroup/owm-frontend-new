import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

import { useCompanyStore } from '@/entities/company';
import { useAuthStore } from '@/features/auth';
import { cn, formatCalendarDay } from '@/shared/lib';
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
import { CompanyReadoutProvider, useCompanyReadoutState } from '../model/use-company-context';
import { useVoucherTypes } from '../model/use-voucher-types';
import { ButtonBar } from './ButtonBar';
import { buildMenus, periodQuery } from '../model/menus';
import { MenuBar } from './MenuBar';
import { ShortcutSheet } from './ShortcutSheet';
import { CompanySwitcher } from './CompanySwitcher';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

/**
 * Tally's voucher keys, against the codes the server seeds a company with.
 *
 * Named by code rather than by position: voucher types are the user's own masters and can be
 * renamed or reordered, and binding F5 to "whatever is third" would quietly point it somewhere
 * else. The label is the conventional name for the key; the vouchers screen shows the company's
 * own name for the type once the form opens.
 */
/**
 * Tally's keys, unchanged, because anyone who has used it already has them in their fingers.
 *
 * All eight seeded voucher types, not the four that happen to be the commonest: a product that can
 * post a sale but offers no way to reach the form is a product that looks broken.
 */
const VOUCHER_KEYS = [
  { key: 'F4', code: 'CONTRA', label: 'Contra' },
  { key: 'F5', code: 'PAYMENT', label: 'Payment' },
  { key: 'F6', code: 'RECEIPT', label: 'Receipt' },
  { key: 'F7', code: 'JOURNAL', label: 'Journal' },
  { key: 'F8', code: 'SALES', label: 'Sales' },
  { key: 'F9', code: 'PURCHASE', label: 'Purchase' },
  { key: 'Ctrl+F8', code: 'CREDIT_NOTE', label: 'Credit Note' },
  { key: 'Ctrl+F9', code: 'DEBIT_NOTE', label: 'Debit Note' },
] as const;

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

  const here = `${location.pathname}${location.search}`;
  /* The shortcuts below reach the same reports the menus do, so they carry the period too. */
  const reportPeriod = periodQuery(here);

  /*
    The shortcut sheet is a parameter on whatever screen is open, so Help can be reached from any
    of them without navigating away, and Back closes it.
  */
  const [searchParams, setSearchParams] = useSearchParams();
  const helpOpen = searchParams.get('help') === 'shortcuts';

  const closeHelp = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('help');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);
  // Checked against the Role union, so a typo is a compile error rather than a menu that is
  // silently never offered.
  /* Declared before the menus, which name a register and a Create entry for each of them. */
  const voucherTypes = useVoucherTypes(companyId);

  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const menus = useMemo(
    () => buildMenus(companyId, company, here, isAdmin, voucherTypes),
    [companyId, company, here, isAdmin, voucherTypes],
  );

  /**
   * The year actually being posted into, whether the books balance, and the draft backlog — one
   * call, shared with every screen under it. See useCompanyReadout.
   */
  const readout = useCompanyReadoutState(companyId);

  /* For the status strip. Read here rather than in a child so the strip is one element. */
  const user = useAuthStore((state) => state.user);
  // Intl formatting is not cheap, and this only changes when the company writing it does.
  const today = useMemo(() => formatCalendarDay(new Date(), company?.country), [company?.country]);
  const period = readout.context?.period ?? null;
  const difference = readout.context?.difference ?? null;
  const balanced = difference !== null && Number(difference) === 0;

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
    const posts = company?.type !== 'ANALYTICS';

    return [
      { group: 'Context', key: 'F1', label: 'Company', onSelect: go('/companies') },
      {
        group: 'Context',
        key: 'F3',
        label: 'Fin. year',
        onSelect: go(`${base}?tab=financial-years`),
      },

      /*
        Raising a voucher from wherever you are, which is the point of the function keys. Bound here
        but drawn in the Transactions menu: entering a voucher is the first thing this product is
        for, so it belongs on the menu bar at the top rather than in a strip of actions that belongs
        to whichever report happens to be open. The keys themselves are unchanged.

        The shell does not hold the company's voucher types, so it names the code and lets the
        vouchers screen resolve it — a company whose masters do not include that code opens the form
        on its own first active type instead. An analytics workspace posts nothing, so it gets none.
      */
      ...(posts
        ? VOUCHER_KEYS.map(({ key, code, label }) => ({
            group: 'Create',
            key,
            label,
            keyOnly: true,
            onSelect: go(`${base}/vouchers?new=${code}`),
          }))
        : []),

      { group: 'Go to', key: 'Alt+O', label: 'Overview', onSelect: go(base) },
      ...(company?.type === 'ANALYTICS'
        ? [{ group: 'Go to', key: 'Alt+V', label: 'Portfolio', onSelect: go(`${base}/kg`) }]
        : [{ group: 'Go to', key: 'Alt+V', label: 'Vouchers', onSelect: go(`${base}/vouchers`) }]),
      {
        group: 'Go to',
        key: 'Alt+B',
        label: 'Balance Sheet',
        onSelect: go(`${base}/reports?report=balance-sheet${reportPeriod}`),
      },
      {
        group: 'Go to',
        key: 'Alt+P',
        label: 'Profit & Loss',
        onSelect: go(`${base}/reports?report=profit-loss${reportPeriod}`),
      },
      {
        group: 'Go to',
        key: 'Alt+D',
        label: 'Day Book',
        onSelect: go(`${base}/reports?report=day-book${reportPeriod}`),
      },
    ];
  }, [companyId, company, navigate, reportPeriod]);

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
          {/*
            The year the company is posting into, read from its financial years rather than from
            the company record — `financialYearStart` there is the first year it was ever given, and
            reading it put "2019" above a 2026 balance sheet. See currentFinancialYear, which
            mirrors the rule the reports API applies.

            The span is the year's own, not "the period these figures cover": a report can be
            narrowed from its own toolbar, and each one prints the period it was actually run for
            beneath its title.
          */}
          {period && (
            <span className={styles.contextItem}>
              Financial year <b>{period.financialYearLabel}</b>{' '}
              <span className={styles.contextRange}>
                {formatCalendarDay(period.from, company.country)} –{' '}
                {formatCalendarDay(period.to, company.country)}
              </span>
              {period.financialYearStatus === 'CLOSED' && (
                <span className={styles.contextClosed}> · closed</span>
              )}
            </span>
          )}
          <span className={styles.contextItem}>
            Base currency <b>{company.baseCurrency}</b>
          </span>
          {/*
            Whether debits equal credits, as at the moment this company was opened. Null until the
            trial balance has been read; never drawn as balanced on an assumption.
          */}
          {difference !== null && (
            <span className={styles.contextItem}>
              <span className={balanced ? styles.balanced : styles.unbalanced}>
                {balanced ? 'Books balanced' : `Difference ${difference}`}
              </span>
            </span>
          )}
        </div>
      )}

      <div className={styles.body}>
        <main className={styles.content}>
          {/*
            Keyed on the path so navigating away clears a caught error. React boundaries do not
            reset themselves, and without the key one broken screen would follow you around the app.
          */}
          <ErrorBoundary key={location.pathname}>
            <CompanyReadoutProvider value={readout}>
              <ButtonBarContext.Provider value={buttonBarContext}>
                <Outlet />
              </ButtonBarContext.Provider>
            </CompanyReadoutProvider>
          </ErrorBoundary>
        </main>

        <ButtonBar actions={actions} />
      </div>

      <ShortcutSheet open={helpOpen} onClose={closeHelp} actions={actions} menus={menus} />

      {/* Application chrome — see the print block in globals.css, which drops it from paper. */}
      {/*
        The status strip. Which set of books, how much is unfinished, who is signed in and what day
        it is — the things worth being able to glance at without them ever asking for attention.
      */}
      <div className={styles.status} data-print="hide">
        <span>{company ? `${company.name} · ${company.code}` : 'No company open'}</span>
        {period && <span>FY {period.financialYearLabel}</span>}
        {readout.context !== null && (
          <span>
            {readout.context.draftVouchers === 0
              ? 'No drafts'
              : `${readout.context.draftVouchers} draft${readout.context.draftVouchers === 1 ? '' : 's'}`}
          </span>
        )}
        <span className={styles.statusEnd}>
          {company ? `Figures in ${company.baseCurrency}` : 'Choose a company to open its books'}
        </span>
        {user && <span>{user.name}</span>}
        <span className={styles.mono}>{today}</span>
      </div>
    </div>
  );
}
