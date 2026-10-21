import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';

import { getCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import { listBusinesses, listPartners } from '@/entities/kg';
import type { Business, Partner } from '@/entities/kg';
import { Loading, EmptyState, Button, Tabs, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import { PartnersPanel } from './PartnersPanel';
import { BusinessesPanel } from './BusinessesPanel';
import { PortfolioPanel } from './PortfolioPanel';
import styles from './KgPage.module.css';

type Tab = 'portfolio' | 'businesses' | 'partners';

const now = new Date();

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
  /** The month the portfolio is read for. The header's, since it governs the whole tab. */
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
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

  /*
    "KG Business", not "Portfolio", until the company is known to be one.

    The screen used to replace itself with a bare spinner, then a bare message, so whichever the
    reader got there was nothing naming what they had opened. The menu's own wording is the honest
    heading here: it names the screen without claiming anything about the company, which this state
    has not yet read.
  */
  if (loading || error)
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.titles}>
            <span className={styles.eyebrow}>
              <BriefcaseBusiness size={13} aria-hidden="true" />
              Portfolio
            </span>
            <h1 className={styles.title}>KG Business</h1>
          </div>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <Loading label="Loading KG Business…" />
        )}
      </div>
    );

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
        took. Navigation is the sidebar's job, so there is no back link here either.
      */}
      <div className={styles.header}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>
            <BriefcaseBusiness size={13} aria-hidden="true" />
            KG Business
          </span>
          <h1 className={styles.title}>Portfolio</h1>
          <p className={styles.subtitle}>
            {businesses.length === 0
              ? 'Add the businesses whose figures you want compared.'
              : `${businesses.length} business${businesses.length === 1 ? '' : 'es'}, ` +
                `${partners.length} partner${partners.length === 1 ? '' : 's'}.`}{' '}
            Figures come from month-end statements, not from books kept here.
          </p>
        </div>

        {/* The month every figure on the Portfolio tab is for. The other tabs are not by month. */}
        {tab === 'portfolio' && (
          <div className={styles.period}>
            <Select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              aria-label="Month"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {new Date(Date.UTC(2000, index, 1)).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              aria-label="Year"
            />
          </div>
        )}
      </div>

      <Tabs
        label="Portfolio views"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'portfolio', label: 'Portfolio' },
          { id: 'businesses', label: 'Businesses' },
          { id: 'partners', label: 'Partners' },
        ]}
      />

      {tab === 'portfolio' && (
        <PortfolioPanel
          company={company}
          partners={partners}
          businesses={businesses}
          year={year}
          month={month}
        />
      )}

      {tab === 'businesses' && (
        <BusinessesPanel
          companyId={companyId}
          country={company.country}
          portfolioCurrency={company.baseCurrency}
          businesses={businesses}
          partners={partners}
          onChanged={setBusinesses}
        />
      )}

      {tab === 'partners' && (
        <PartnersPanel
          companyId={companyId}
          partners={partners}
          businesses={businesses}
          onChanged={setPartners}
        />
      )}
    </div>
  );
}
