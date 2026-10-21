import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BriefcaseBusiness,
  ChartColumnBig,
  Check,
  Files,
  History,
  House,
  LayoutGrid,
  Library,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Plus,
  Search,
  Sun,
  TriangleAlert,
} from 'lucide-react';

import { companyAccent, companyInitials } from '@/entities/company';
import type { Company } from '@/entities/company';
import { useAuthStore } from '@/features/auth';
import { setTheme, useTheme } from '@/shared/hooks';
import { cn } from '@/shared/lib';
import { BottomSheet } from '@/shared/ui';

import type { ButtonBarAction } from '../model/button-bar';
import styles from './MobileNav.module.css';

export type MobileSheet = 'more' | 'create' | 'companies' | null;

interface MobileNavProps {
  companyId?: string;
  company: Company | null;
  companies: Company[] | null;
  /** Every document this company can raise — the same list the key strip draws. */
  create: ButtonBarAction[];
  /** What the open screen publishes to the key strip — Export, Recalculate — which a phone does not draw. */
  screenActions: ButtonBarAction[];
  sheet: MobileSheet;
  onSheet: (sheet: MobileSheet) => void;
  onSearch: () => void;
}

/**
 * The phone's navigation: five tabs along the bottom, within reach of a thumb, and the sheets they
 * open. Below 60rem only — above it the sidebar and the key strip carry the same places.
 *
 * The middle tab raises a document, because entering a voucher is the commonest thing anyone does,
 * and on a phone there are no function keys to do it with.
 */
export function MobileNav({
  companyId,
  company,
  companies,
  create,
  screenActions,
  sheet,
  onSheet,
  onSearch,
}: MobileNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const logout = useAuthStore((state) => state.logout);
  const dark =
    theme === 'dark' ||
    (theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const base = companyId ? `/companies/${companyId}` : null;
  const isPortfolio = company?.type === 'ANALYTICS';
  const path = location.pathname;
  const params = new URLSearchParams(location.search);
  const close = () => onSheet(null);
  const go = (to: string) => {
    close();
    navigate(to);
  };

  const tab = (label: string, Icon: typeof House, to: string, active: boolean) => (
    <button
      type="button"
      className={cn(styles.tab, active && styles.active)}
      aria-current={active ? 'page' : undefined}
      onClick={() => go(to)}
    >
      <Icon size={22} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  function switchTo(next: Company) {
    close();
    if (next.id === companyId) return;
    const section = companyId ? path.slice(`/companies/${companyId}`.length) : '';
    navigate(`/companies/${next.id}${section}${location.search}`);
  }

  const moreActive =
    path === '/companies' ||
    path === '/reported-errors' ||
    (base !== null && path === base && !!params.get('tab'));

  return (
    <>
      <nav className={styles.tabs} aria-label="Main navigation">
        {base ? (
          <>
            {tab('Home', House, base, path === base && !params.get('tab'))}
            {tab('Vouchers', Files, `${base}/vouchers`, path === `${base}/vouchers`)}
            <button
              type="button"
              className={styles.fab}
              onClick={() => onSheet('create')}
              aria-label="Create a voucher"
              disabled={create.length === 0}
            >
              <Plus size={26} />
            </button>
            {isPortfolio
              ? tab('Portfolio', BriefcaseBusiness, `${base}/kg`, path === `${base}/kg`)
              : tab('Reports', ChartColumnBig, `${base}/reports`, path === `${base}/reports`)}
          </>
        ) : (
          <>
            {tab('Companies', LayoutGrid, '/companies', path === '/companies')}
            <button type="button" className={styles.tab} onClick={onSearch}>
              <Search size={22} aria-hidden="true" />
              <span>Search</span>
            </button>
          </>
        )}
        <button
          type="button"
          className={cn(styles.tab, moreActive && styles.active)}
          onClick={() => onSheet('more')}
        >
          <MenuIcon size={22} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <BottomSheet
        open={sheet === 'create'}
        onClose={close}
        title={company ? `Create in ${company.name}` : 'Create'}
        showTitle
      >
        <div className={styles.grid}>
          {create.map((action) => (
            <button
              type="button"
              key={`${action.label}-${action.key ?? ''}`}
              className={styles.gridItem}
              onClick={() => {
                close();
                action.onSelect();
              }}
            >
              <Plus size={20} aria-hidden="true" />
              {action.label}
              {action.key && <small>{action.key}</small>}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'companies'} onClose={close} title="Switch company" showTitle>
        <div className={styles.list}>
          {(companies ?? []).map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={cn(styles.row, entry.id === companyId && styles.current)}
              aria-current={entry.id === companyId ? 'true' : undefined}
              onClick={() => switchTo(entry)}
            >
              <span className={styles.chip} style={{ background: companyAccent(entry) }}>
                {companyInitials(entry)}
              </span>
              <span className={styles.rowLabel}>{entry.name}</span>
              {entry.status !== 'ACTIVE' && <small>Deactivated</small>}
              {entry.id === companyId ? <Check size={18} /> : <small>{entry.baseCurrency}</small>}
            </button>
          ))}
          <button type="button" className={styles.row} onClick={() => go('/companies')}>
            <LayoutGrid size={20} aria-hidden="true" />
            <span className={styles.rowLabel}>Group overview — all companies</span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'more'} onClose={close} title="More">
        {screenActions.length > 0 && (
          <>
            <h3 className={styles.heading}>On this screen</h3>
            <div className={styles.list}>
              {screenActions.map((action, index) => (
                <button
                  type="button"
                  key={`${action.group}/${index}`}
                  className={styles.row}
                  disabled={action.disabled}
                  onClick={() => {
                    close();
                    action.onSelect();
                  }}
                >
                  <span className={styles.rowLabel}>{action.label}</span>
                  {action.key && <small>{action.key}</small>}
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className={styles.heading}>Go to</h3>
        <div className={styles.list}>
          <button type="button" className={styles.row} onClick={() => go('/companies')}>
            <LayoutGrid size={20} aria-hidden="true" />
            <span className={styles.rowLabel}>Group overview</span>
          </button>
          {base && (
            <>
              <button
                type="button"
                className={styles.row}
                onClick={() => go(`${base}?tab=accounts`)}
              >
                <Library size={20} aria-hidden="true" />
                <span className={styles.rowLabel}>Masters</span>
              </button>
              {!isPortfolio && (
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => go(`${base}/reports?report=day-book`)}
                >
                  <BookOpen size={20} aria-hidden="true" />
                  <span className={styles.rowLabel}>Day Book</span>
                </button>
              )}
              <button
                type="button"
                className={styles.row}
                onClick={() => go(`${base}/reports?report=audit`)}
              >
                <History size={20} aria-hidden="true" />
                <span className={styles.rowLabel}>Audit trail</span>
              </button>
            </>
          )}
          {isAdmin && (
            <button type="button" className={styles.row} onClick={() => go('/reported-errors')}>
              <TriangleAlert size={20} aria-hidden="true" />
              <span className={styles.rowLabel}>Reported errors</span>
            </button>
          )}
        </div>

        <h3 className={styles.heading}>Company</h3>
        <div className={styles.list}>
          <button type="button" className={styles.row} onClick={() => onSheet('companies')}>
            {company ? (
              <span className={styles.chip} style={{ background: companyAccent(company) }}>
                {companyInitials(company)}
              </span>
            ) : (
              <LayoutGrid size={20} aria-hidden="true" />
            )}
            <span className={styles.rowLabel}>{company ? company.name : 'Choose a company'}</span>
            <small>Switch</small>
          </button>
        </div>

        <h3 className={styles.heading}>App</h3>
        <div className={styles.list}>
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              close();
              onSearch();
            }}
          >
            <Search size={20} aria-hidden="true" />
            <span className={styles.rowLabel}>Search everything</span>
          </button>
          <button
            type="button"
            className={styles.row}
            onClick={() => setTheme(dark ? 'light' : 'dark')}
          >
            {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            <span className={styles.rowLabel}>{dark ? 'Light theme' : 'Dark theme'}</span>
          </button>
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              close();
              logout().catch(() => {});
            }}
          >
            <LogOut size={20} aria-hidden="true" />
            <span className={styles.rowLabel}>Log out</span>
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
