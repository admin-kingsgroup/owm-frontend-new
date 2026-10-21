import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Building2,
  FileText,
  Keyboard,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';

import { useCompanyStore } from '@/entities/company';
import {
  PORTFOLIO_BUSINESS_CODES,
  ALWAYS_SEEDED_VOUCHER_CODES,
  raisableVoucherTypes,
} from '@/entities/voucher-type';
import { useAuthStore } from '@/features/auth';
import { setTheme } from '@/shared/hooks';
import { formatCalendarDay } from '@/shared/lib';
import { CommandPalette, ErrorBoundary, ToastViewport } from '@/shared/ui';
import type { CommandItem } from '@/shared/ui';

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
import { buildMenus, periodQuery, raiseVoucherPath } from '../model/menus';
import { buildNav, screenName } from '../model/nav';
import { ButtonBar } from './ButtonBar';
import { MobileNav } from './MobileNav';
import type { MobileSheet } from './MobileNav';
import { ShortcutSheet } from './ShortcutSheet';
import { NAV_ICONS } from './nav-icons';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

/**
 * The frame every signed-in screen sits in: the sidebar on the left, the bar across the top, the
 * key strip down the right, and one scrolling workspace in the middle. On a phone the sidebar and
 * the strip give way to a tab bar along the bottom.
 */
export function AppShell() {
  const { companyId } = useParams<{ companyId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  /** The search over everything, opened with Ctrl+K or the top bar's search box. */
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Which of the phone's sheets is up, if any. */
  const [sheet, setSheet] = useState<MobileSheet>(null);

  /**
   * The company list, shared by the switcher, the menus and the context strip. The menus need it
   * because a company's features decide which reports exist and an analytics workspace posts
   * nothing, so it gets Portfolio where the others get Vouchers.
   *
   * Read on every screen under the shell rather than only inside a company: the switcher is the
   * product's only company control now, so it has to draw on the selection screen and on
   * diagnostics too. The store fetches once a session, so this is the same single request it
   * always was — and switching company reuses the list rather than reading it again.
   */
  // The same list the companies page holds, rather than a second copy. Sharing it means entering
  // a company costs no extra request, and a company created or renamed on that page reaches the
  // switcher without a reload. A failed load leaves it null, which the menus and the switcher each
  // already handle: chrome, not content.
  const companies = useCompanyStore((state) => state.companies);
  const loadCompanies = useCompanyStore((state) => state.load);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

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
  /* The seed version re-reads the list after a masters sync — see useVoucherTypes. */
  const { types: voucherTypes, known: voucherTypesKnown } = useVoucherTypes(
    companyId,
    company?.seedVersion,
  );

  /**
   * Whether this company measures other people's businesses rather than keeping its own books.
   *
   * Read once and shared: the menus, the strip and the data-entry keys all turn on it, and three
   * separate `company?.type === 'ANALYTICS'` checks is three places for the answer to drift.
   */
  const isPortfolio = company?.type === 'ANALYTICS';

  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const menus = useMemo(
    () => buildMenus(companyId, company, here, isAdmin, voucherTypes, voucherTypesKnown),
    [companyId, company, here, isAdmin, voucherTypes, voucherTypesKnown],
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

    return [
      {
        group: 'Context',
        key: 'F3',
        label: 'Fin. year',
        onSelect: go(`${base}?tab=financial-years`),
      },

      { group: 'Go to', key: 'Alt+O', label: 'Dashboard', onSelect: go(base) },
      /* Printed beside Masters in the sidebar, so bound here but not drawn in the strip. */
      {
        group: 'Go to',
        key: 'Alt+M',
        label: 'Masters',
        onSelect: go(`${base}?tab=accounts`),
        keyOnly: true,
      },
      ...(isPortfolio
        ? [
            {
              group: 'Go to' as const,
              key: 'Alt+V',
              label: 'Portfolio',
              onSelect: go(`${base}/kg`),
            },
          ]
        : [
            {
              group: 'Go to' as const,
              key: 'Alt+V',
              label: 'Vouchers',
              onSelect: go(`${base}/vouchers`),
            },
          ]),
      /*
        The three statements, for a company that keeps books.

        An analytics workspace posts nothing and never will — no voucher reaches it, so its balance
        sheet, its profit and loss and its day book are permanently empty. Offering all three from
        the strip on every screen was three keys that could only ever open a blank statement, and
        a shortcut that reliably shows nothing teaches that the strip is not worth reading.
      */
      ...(isPortfolio
        ? []
        : [
            {
              group: 'Go to' as const,
              key: 'Alt+B',
              label: 'Balance Sheet',
              onSelect: go(`${base}/reports?report=balance-sheet${reportPeriod}`),
            },
            {
              group: 'Go to' as const,
              key: 'Alt+P',
              label: 'Profit & Loss',
              onSelect: go(`${base}/reports?report=profit-loss${reportPeriod}`),
            },
            {
              /*
                Alt+K, not Alt+D. Alt+D opens the Dashboards menu — every menu on the bar answers to
                its own initial, and the menu bar claims the combination first, so leaving Day Book
                on Alt+D left two handlers racing for one key. K is the free letter in the name.
              */
              group: 'Go to' as const,
              key: 'Alt+K',
              label: 'Day Book',
              onSelect: go(`${base}/reports?report=day-book${reportPeriod}`),
            },
          ]),
    ];
  }, [companyId, isPortfolio, navigate, reportPeriod]);

  /**
   * Every document this company can raise, from wherever you are.
   *
   * Drawn at the top of the bar rather than bound invisibly, because in Tally this is the first
   * thing the right-hand strip shows and entering a voucher is the commonest thing anyone does —
   * having to go back to the Gateway first is the trip the bar exists to save. The Transactions
   * menu still lists them; the bar is the fast path, not a replacement.
   *
   * The company's own list, in full. The bar used to be built from the fixed table of function
   * keys instead, which meant it could only ever offer the eight types that table names: a company
   * that added a voucher type of its own — a second sales series, a petty-cash payment book — got
   * a strip that silently left it out, and the only way to raise one was to go to the Gateway and
   * find it. So the types decide what is drawn and the table only decides what a key is bound to;
   * a type it does not name is a button without a key rather than no button at all.
   *
   * Names are the company's, not the table's, because a type can be renamed and the strip has to
   * agree with the register and the Transactions menu about what a document is called.
   *
   * In function-key order — F4, F5, F6 … — with anything the company invented after them,
   * alphabetically. See inFunctionKeyOrder: read down, the keys are in the order they sit under
   * the hand rather than in the order the server happens to answer in.
   *
   * Until that list arrives, the four its kind of company is certainly seeded with — see
   * raisableVoucherTypes, which is also what the Transactions menu is built from, so the strip and
   * the menu cannot disagree about what this company can raise.
   *
   * A portfolio workspace is included, and its four are its own: capital in, profit reported,
   * profit shared out, and a correction. The strip skipped it entirely while nothing was ever
   * posted to one, which stopped being true the moment those types were seeded — a workspace
   * holding four documents was offering no way to raise any of them.
   */
  const dataEntry = useMemo<ButtonBarAction[]>(() => {
    /*
      Nothing until the company record has arrived. `isPortfolio` is false both for a company that
      keeps books and for one that has not been identified yet, and those want opposite answers —
      read as "keeps books", an unidentified portfolio was handed Contra, Payment, Receipt and
      Journal, four documents it does not hold, each pointing at a voucher form that would refuse
      them. Same reasoning as the Create list in buildMenus, which this must agree with.
    */
    if (!companyId || company === null) return [];
    const base = `/companies/${companyId}`;

    return raisableVoucherTypes(
      voucherTypes,
      voucherTypesKnown,
      isPortfolio ? PORTFOLIO_BUSINESS_CODES : ALWAYS_SEEDED_VOUCHER_CODES,
    ).map((type) => ({
      group: 'Data entry',
      key: type.key,
      label: type.name,
      // The same destination the Transactions menu uses — see raiseVoucherPath, which is also why a
      // portfolio's four go to its registry rather than to a voucher form that cannot accept them.
      onSelect: () => navigate(raiseVoucherPath(base, type.code)),
    }));
  }, [company, companyId, isPortfolio, navigate, voucherTypes, voucherTypesKnown]);

  /*
    The page keeps first claim on a key: a screen that binds F8 to its own meaning must not have the
    shell's Sales key answer instead. Where the bar *draws* Data entry is a separate question, and
    the bar answers it — see PINNED_FIRST.
  */
  /*
    The group overview is reachable from everywhere, inside a company or not — it is where the
    sidebar's first item goes, and Alt+G is printed beside it there.
  */
  const globalActions = useMemo<ButtonBarAction[]>(
    () => [
      {
        group: 'Go to',
        key: 'Alt+G',
        label: 'Group overview',
        onSelect: () => navigate('/companies'),
        keyOnly: true,
      },
    ],
    [navigate],
  );

  const actions = useMemo(
    () => [...pageActions, ...dataEntry, ...shellActions, ...globalActions],
    [dataEntry, pageActions, shellActions, globalActions],
  );

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
        /* Not every action carries a key — see ButtonBarAction.key. */
        if (action.disabled || !action.key) continue;
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

  /*
    Ctrl+K opens the search from anywhere — even while typing, since it types nothing — and "?"
    opens the shortcut sheet, except in a field where a question mark is just a question mark.
  */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === '?' && !isTypingTarget(event.target) && !hasOpenDialog()) {
        event.preventDefault();
        openHelp();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  /* The shortcut sheet is a parameter on whatever screen is open, so Back closes it. */
  function openHelp() {
    const params = new URLSearchParams(searchParams);
    params.set('help', 'shortcuts');
    setSearchParams(params);
  }

  const nav = useMemo(
    () => buildNav(companyId, company, location.pathname, location.search, isAdmin),
    [companyId, company, location.pathname, location.search, isAdmin],
  );
  const screen = screenName(location.pathname, location.search, companyId);
  const logout = useAuthStore((state) => state.logout);

  /**
   * What the search can reach: every destination the menus carry — each report, register and
   * master screen, with the same feature rules deciding which exist — plus the companies and a few
   * actions. The menus stopped being drawn as a bar; they did not stop being the map of the product.
   */
  const commands = useMemo<CommandItem[]>(() => {
    const seen = new Set<string>();
    const items: CommandItem[] = [];
    const add = (item: CommandItem) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };

    for (const entry of nav) {
      const Icon = NAV_ICONS[entry.icon];
      add({
        id: `to:${entry.to}`,
        group: 'Go to',
        label: entry.label,
        hint: entry.hint,
        icon: <Icon />,
        href: entry.to,
        onSelect: () => navigate(entry.to),
      });
    }

    for (const menu of menus) {
      if (menu.id === 'help') continue;
      let section = '';
      for (const item of menu.items) {
        section = item.section ?? section;
        const creates = menu.id === 'transactions' && section === 'Create';
        add({
          /* One entry per destination: Financial years sits under two menus and is one place. */
          id: `to:${item.to}`,
          group: creates ? 'Create' : menu.label,
          label: item.label,
          hint: item.hint,
          icon: creates ? <Plus /> : <FileText />,
          href: item.to,
          onSelect: () => navigate(item.to),
        });
      }
    }

    for (const entry of companies ?? []) {
      add({
        id: `company:${entry.id}`,
        group: 'Switch company',
        label: entry.name,
        hint: entry.type === 'ANALYTICS' ? 'Portfolio' : entry.baseCurrency,
        icon: entry.type === 'ANALYTICS' ? <BriefcaseBusiness /> : <Building2 />,
        keywords: entry.code,
        href: `/companies/${entry.id}`,
        onSelect: () => navigate(`/companies/${entry.id}`),
      });
    }

    add({
      id: 'act:group',
      group: 'Actions',
      label: 'Group overview — all companies',
      icon: <LayoutGrid />,
      onSelect: () => navigate('/companies'),
    });
    add({
      id: 'act:light',
      group: 'Actions',
      label: 'Light theme',
      icon: <Sun />,
      onSelect: () => setTheme('light'),
    });
    add({
      id: 'act:dark',
      group: 'Actions',
      label: 'Dark theme',
      icon: <Moon />,
      onSelect: () => setTheme('dark'),
    });
    add({
      id: 'act:keys',
      group: 'Actions',
      label: 'Keyboard shortcuts',
      hint: '?',
      icon: <Keyboard />,
      onSelect: openHelp,
    });
    add({
      id: 'act:logout',
      group: 'Actions',
      label: 'Log out',
      icon: <LogOut />,
      onSelect: () => {
        logout().catch(() => {});
      },
    });
    return items;
    // openHelp reads the search params, so rebuilding on them is what keeps it current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, menus, companies, navigate, logout, searchParams]);

  return (
    <div className={styles.shell}>
      <Sidebar items={nav} companyId={companyId} companies={companies} onShortcuts={openHelp} />

      <TopBar
        company={company}
        screen={screen}
        context={readout.context}
        onSearch={() => setPaletteOpen(true)}
        onShortcuts={openHelp}
        onCompanies={() => setSheet('companies')}
      />

      <main className={styles.content}>
        {/*
          The context strip used to be the only thing naming the company and the year on a printed
          statement. It is gone from the screen — the top bar's chip says it there — so this line
          exists for paper alone.
        */}
        {company && (
          <p className={styles.printContext}>
            {company.name} · {company.code}
            {period &&
              ` · Financial year ${period.financialYearLabel} (${formatCalendarDay(period.from, company.country)} – ${formatCalendarDay(period.to, company.country)})`}
            {` · Figures in ${company.baseCurrency}`}
            {difference !== null &&
              (balanced ? ' · Books balanced' : ` · Difference ${difference}`)}
            {user && ` · ${user.name}, ${today}`}
          </p>
        )}
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

      <MobileNav
        companyId={companyId}
        company={company}
        companies={companies}
        create={dataEntry}
        screenActions={pageActions.filter((action) => !action.keyOnly)}
        sheet={sheet}
        onSheet={setSheet}
        onSearch={() => setPaletteOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commands}
        placeholder="Jump to a page, report, register or company…"
      />

      <ShortcutSheet open={helpOpen} onClose={closeHelp} actions={actions} />

      {/*
        Where the product says what just happened — mounted once, here, so anything under the shell
        can post to it without a provider in scope. Fixed, so a message never moves the page.
      */}
      <ToastViewport />
    </div>
  );
}
