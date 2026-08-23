import type { ReactNode } from 'react';

import { companyStatusVariant, companyTypeLabel } from '@/entities/company';
import type { Company } from '@/entities/company';
import { formatCalendarDay } from '@/shared/lib';
import { Badge } from '@/shared/ui';

import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  company: Company;
  /**
   * What this dashboard is, in the words the Dashboards menu uses for it. A set of books and an
   * analytics workspace answer entirely different questions, and the reader is entitled to know
   * which one they are looking at before they start reading figures off it.
   */
  kind: string;
  /**
   * The date the figures below are stated as at, taken from the report they were read from rather
   * than from the clock — so the header cannot claim a currency the numbers do not have. Null
   * until the first report answers, and the line is simply absent until then rather than showing
   * today's date over yesterday's figures.
   */
  asOn?: string | null;
  /** The screen's own destinations, drawn at the end of the header. */
  actions?: ReactNode;
}

/**
 * The header every dashboard opens with.
 *
 * It replaced a single `<h1>Gateway of OWM</h1>` that was identical on all three companies — so
 * the one screen whose entire content is one company's money was also the one screen that never
 * said whose. The name, what kind of books they are, and whether the company is still live: the
 * three things that change what every figure underneath means.
 *
 * Deliberately silent about financial year, base currency and whether the books balance. The
 * shell's context strip states those on every screen in the product, and repeating them 60px lower
 * is noise — worse, it is noise that can disagree with itself while one of the two is loading.
 *
 * Shared rather than written twice because the two dashboards are different screens asking the
 * same question at the top, and a page may not import another page.
 */
export function DashboardHeader({ company, kind, asOn, actions }: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{company.name}</h1>
          <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
          <Badge variant="neutral">{companyTypeLabel(company.type)}</Badge>
        </div>
        <p className={styles.meta}>
          <span className={styles.kind}>{kind}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.code}>{company.code}</span>
          {asOn && (
            <>
              <span className={styles.dot}>·</span>
              <span>as on {formatCalendarDay(asOn, company.country)}</span>
            </>
          )}
        </p>
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
