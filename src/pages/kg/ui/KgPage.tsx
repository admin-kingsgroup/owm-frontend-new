import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import { listBusinesses, listPartners } from '@/entities/kg';
import type { Business, Partner } from '@/entities/kg';
import { Loading, EmptyState, Button } from '@/shared/ui';
import { getErrorMessage, cn } from '@/shared/lib';

import { PartnersPanel } from './PartnersPanel';
import { BusinessesPanel } from './BusinessesPanel';
import { PortfolioPanel } from './PortfolioPanel';
import styles from './KgPage.module.css';

type Tab = 'portfolio' | 'businesses' | 'partners';

/**
 * KG Business: the portfolio workspace over businesses that sit entirely outside OWM.
 *
 * Nothing is posted here. Figures arrive as month-end statements, are mapped onto the group tree
 * once per business, and are locked into snapshots that later reads never re-derive.
 *
 * The page refuses to load for a company that is not an analytics workspace, rather than showing
 * empty registries that could never be filled — a set of books has no businesses to rank.
 */
export function KgPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [tab, setTab] = useState<Tab>('portfolio');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [companyResult, partnersResult, businessesResult] = await Promise.all([
          getCompany(id),
          listPartners(id),
          listBusinesses(id),
        ]);
        if (cancelled) return;
        setCompany(companyResult);
        setPartners(partnersResult);
        setBusinesses(businessesResult);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load KG Business'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!companyId) return null;
  if (loading) return <Loading label="Loading KG Business…" />;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!company) return null;

  /**
   * A set of books has no businesses to rank and no statements to upload. Saying so plainly beats
   * showing empty tabs that would never fill.
   */
  if (company.type !== 'ANALYTICS') {
    return (
      <EmptyState
        title="This company is not a portfolio workspace"
        description={`${company.name} keeps its own books, so it has no external businesses to compare. KG Business is available on companies created as "Portfolio analytics".`}
        action={
          <Link to={`/companies/${companyId}`}>
            <Button variant="primary">Back to the company</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      {/*
        The company, its year and its currency are stated once by the shell's context strip, so the
        heading names the screen instead of repeating them — the same shape Vouchers and Reports
        took. Navigation is the menu bar's job, so there is no back link here either.
      */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Portfolio</h1>
          <p className={styles.subtitle}>
            {businesses.length === 0
              ? 'Add the businesses whose figures you want compared.'
              : `${businesses.length} business${businesses.length === 1 ? '' : 'es'}, ` +
                `${partners.length} partner${partners.length === 1 ? '' : 's'}.`}{' '}
            Figures come from month-end statements, not from books kept here.
          </p>
        </div>
      </div>

      <div className={styles.tabs}>
        {(
          [
            ['portfolio', 'Portfolio'],
            ['businesses', 'Businesses'],
            ['partners', 'Partners'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(styles.tab, tab === value && styles.tabActive)}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <PortfolioPanel
          companyId={companyId}
          partners={partners}
          businessCount={businesses.length}
        />
      )}

      {tab === 'businesses' && (
        <BusinessesPanel
          companyId={companyId}
          businesses={businesses}
          partners={partners}
          onChanged={setBusinesses}
        />
      )}

      {tab === 'partners' && (
        <PartnersPanel companyId={companyId} partners={partners} onChanged={setPartners} />
      )}
    </div>
  );
}
