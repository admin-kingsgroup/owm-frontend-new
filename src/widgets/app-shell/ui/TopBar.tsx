import { ChevronDown, Keyboard, Layers, Moon, Search, Sun } from 'lucide-react';

import { companyAccent, companyInitials, companyTypeLabel } from '@/entities/company';
import type { Company } from '@/entities/company';
import type { CompanyContext } from '@/entities/report';
import { setTheme, useTheme } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { UserMenu } from './UserMenu';
import styles from './TopBar.module.css';

interface TopBarProps {
  company: Company | null;
  /** The open screen's name — "Dashboard", "Reports". */
  screen: string;
  context: CompanyContext | null;
  onSearch: () => void;
  onShortcuts: () => void;
  /** The phone's company chip opens the switcher sheet. */
  onCompanies: () => void;
}

/** Whether the page is drawn dark right now — an explicit choice, or the OS when there is none. */
function isDarkNow(theme: string): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return (
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

/**
 * The bar across the top of the workspace.
 *
 * What the old context strip said — which year, whether the books balance — is the chip in the
 * middle: stated once, for every screen, because a statement read against the wrong year is not a
 * mistake anyone catches by looking at the figures.
 */
export function TopBar({
  company,
  screen,
  context,
  onSearch,
  onShortcuts,
  onCompanies,
}: TopBarProps) {
  const theme = useTheme();
  const dark = isDarkNow(theme);
  const period = context?.period ?? null;
  const difference = context?.difference ?? null;
  const balanced = difference !== null && Number(difference) === 0;

  return (
    <header className={styles.bar}>
      {/* Phone: the company you are in, and the way to another. */}
      <button
        type="button"
        className={styles.companyChip}
        onClick={onCompanies}
        aria-label="Switch company"
      >
        {company ? (
          <span className={styles.chip} style={{ background: companyAccent(company) }}>
            {companyInitials(company)}
          </span>
        ) : (
          <span className={cn(styles.chip, styles.chipEmpty)}>
            <Layers size={16} />
          </span>
        )}
        <span className={styles.chipText}>
          <b>{company ? company.name : 'KBiz360 OWM'}</b>
          <small>
            {company
              ? `${companyTypeLabel(company.type)} · ${company.baseCurrency}`
              : screen || 'Group overview'}
          </small>
        </span>
        <ChevronDown size={16} className={styles.chipChevron} />
      </button>

      <nav className={styles.crumbs} aria-label="You are here">
        {company ? (
          <>
            <span className={styles.crumb}>{company.name}</span>
            <span className={styles.sep}>/</span>
          </>
        ) : (
          <>
            <Layers size={15} className={styles.crumbIcon} />
            <span className={styles.crumb}>KBiz360 Group</span>
            <span className={styles.sep}>/</span>
          </>
        )}
        <b className={styles.here}>{screen}</b>
      </nav>

      <div className={styles.end}>
        <button
          type="button"
          className={styles.search}
          onClick={onSearch}
          aria-label="Search"
          aria-keyshortcuts="Control+K"
        >
          <Search size={15} />
          <span className={styles.searchText}>Search or jump to…</span>
          <kbd className={styles.kbd}>Ctrl K</kbd>
        </button>

        {company && period && (
          <span
            className={cn(
              styles.period,
              period.financialYearStatus === 'CLOSED' && styles.periodClosed,
            )}
            title={
              difference === null
                ? undefined
                : balanced
                  ? 'Books balanced — debits equal credits'
                  : `Books out by ${difference}`
            }
          >
            <i
              className={cn(styles.dot, difference !== null && !balanced && styles.dotBad)}
              aria-hidden="true"
            />
            FY {period.financialYearLabel}
            {period.financialYearStatus === 'CLOSED' && ' · closed'}
            <span className={styles.periodCurrency}>· {company.baseCurrency}</span>
            {/* Said in words as well as colour — a difference has to be noticed by everyone. */}
            {difference !== null && !balanced && (
              <span className={styles.out}>· out of balance</span>
            )}
          </span>
        )}

        <button
          type="button"
          className={styles.icon}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          aria-label={dark ? 'Switch to light' : 'Switch to dark'}
          title={dark ? 'Switch to light' : 'Switch to dark'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          className={cn(styles.icon, styles.deskOnly)}
          onClick={onShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <Keyboard size={18} />
        </button>
        <span className={styles.deskOnly}>
          <UserMenu />
        </span>
      </div>
    </header>
  );
}
