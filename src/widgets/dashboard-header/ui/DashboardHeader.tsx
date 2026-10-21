import type { ReactNode } from 'react';
import { Gauge } from 'lucide-react';

import { companyStatusVariant, companyTypeLabel } from '@/entities/company';
import type { Company } from '@/entities/company';
import { formatCalendarDay } from '@/shared/lib';
import { Badge } from '@/shared/ui';

import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  company: Company;
  /**
   * Which dashboard this is — "Company dashboard", "Portfolio dashboard". An analytics workspace
   * answers an entirely different question from a set of books, and this word is the only warning
   * anyone gets before the screen changes shape.
   */
  kind: string;
  /** The date the figures below are as at. Null while unread. */
  asOn?: string | null;
  /** The financial year being read, as its own label — "2026-27". */
  period?: string | null;
  /** The screen's own destinations, drawn at the end of the header. */
  actions?: ReactNode;
}

/**
 * The head of a dashboard: what kind of dashboard, which company, and the facts that change what
 * every figure below means — the year, the date, the currency.
 *
 * It replaced a single "Gateway of OWM" that was identical on every company, so three companies'
 * dashboards could only be told apart by their figures.
 */
export function DashboardHeader({ company, kind, asOn, period, actions }: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <span className={styles.eyebrow}>
          <Gauge size={13} aria-hidden="true" />
          {kind}
        </span>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{company.name}</h1>
          <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
          <Badge variant="neutral">{companyTypeLabel(company.type)}</Badge>
        </div>
        <p className={styles.meta}>
          {period && (
            <>
              <span>FY {period}</span>
              <span className={styles.dot}>·</span>
            </>
          )}
          {asOn && (
            <>
              <span>as on {formatCalendarDay(asOn, company.country)}</span>
              <span className={styles.dot}>·</span>
            </>
          )}
          <span>Base currency {company.baseCurrency}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.code}>{company.code}</span>
        </p>
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
