import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  DollarSign,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import type { Business } from '@/entities/owner-portfolio';
import {
  MOCK_COMPANIES,
  getMockFinancialYears,
  getMockCurrencies,
  getMockExchangeRates,
} from '@/shared/api/mock-erp-data';
import styles from './CompanySection.module.css';

interface CompanySectionProps {
  businesses?: Business[];
  selectedBusinessId?: string | 'all';
  onSelectBusiness?: (id: string | 'all') => void;
}

export function CompanySection({
  selectedBusinessId = 'biz-travkings',
  onSelectBusiness,
}: CompanySectionProps) {
  const activeCompanyId =
    selectedBusinessId !== 'all' ? selectedBusinessId : 'biz-travkings';

  const currentCompany = useMemo(() => {
    return MOCK_COMPANIES.find((c) => c.id === activeCompanyId) ?? MOCK_COMPANIES[0];
  }, [activeCompanyId]);

  const financialYears = useMemo(() => {
    return getMockFinancialYears(activeCompanyId);
  }, [activeCompanyId]);

  const currencies = useMemo(() => {
    return getMockCurrencies(activeCompanyId);
  }, [activeCompanyId]);

  const exchangeRates = useMemo(() => {
    return getMockExchangeRates(activeCompanyId);
  }, [activeCompanyId]);

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Company Setup &amp; Governance</h2>
          <span className={styles.subtitle}>
            Financial years, multi-currency valuation rates, legal registration, and feature flags for{' '}
            <strong style={{ color: 'var(--ink)' }}>{currentCompany.name}</strong>
          </span>
        </div>

        <div className={styles.headerActions}>
          <select
            value={activeCompanyId}
            onChange={(e) => onSelectBusiness?.(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--paper-card)',
              color: 'var(--ink)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {MOCK_COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <Link
            to={`/companies/${currentCompany.id}`}
            className={styles.openDashboardBtn}
            title="Open Dedicated Company Dashboard"
          >
            <span>Open Company Dashboard</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div className={styles.grid}>
        {/* 1. Legal Entity & Jurisdiction Profile */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Building2 size={16} style={{ color: 'var(--accent)' }} />
              <span>Legal Entity &amp; Jurisdiction</span>
            </div>
            <span className={`${styles.statusPill} ${styles.statusActive}`}>Active Entity</span>
          </div>

          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Trade Name</span>
              <span className={styles.infoValue}>{currentCompany.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Legal Entity Name</span>
              <span className={styles.infoValue}>{currentCompany.legalName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Company Code</span>
              <span className={`${styles.infoValue} ${styles.mono}`}>{currentCompany.code}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Jurisdiction &amp; State</span>
              <span className={styles.infoValue}>
                {currentCompany.state}, {currentCompany.country}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Base Book Currency</span>
              <span className={`${styles.infoValue} ${styles.mono}`}>
                {currentCompany.baseCurrency} (₹)
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Accounting Type</span>
              <span className={styles.infoValue}>{currentCompany.type} — Full Double Entry</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Timezone</span>
              <span className={`${styles.infoValue} ${styles.mono}`}>{currentCompany.timezone}</span>
            </div>
          </div>
        </div>

        {/* 2. Financial Years Schedule */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Calendar size={16} style={{ color: '#0ea5e9' }} />
              <span>Financial Year Schedules</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Open &amp; Closed Books</span>
          </div>

          <div className={styles.infoList}>
            {financialYears.map((fy) => (
              <div key={fy.id} className={styles.infoRow}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>FY {fy.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
                    {fy.startDate} — {fy.endDate}
                  </div>
                </div>
                <div>
                  <span
                    className={`${styles.statusPill} ${
                      fy.status === 'OPEN' ? styles.statusActive : styles.statusClosed
                    }`}
                  >
                    {fy.status === 'OPEN' ? 'Open & Posting' : 'Closed'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            <Link
              to={`/companies/${currentCompany.id}?tab=financial-years`}
              style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
            >
              Manage Financial Years &rarr;
            </Link>
          </div>
        </div>

        {/* 3. Multi-Currency Valuation & Exchange Rates */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <DollarSign size={16} style={{ color: '#10b981' }} />
              <span>Active Currencies &amp; Daily Forex Rates</span>
            </div>
            <span className={`${styles.statusPill} ${styles.statusActive}`}>Live FX Sync</span>
          </div>

          <table className={styles.ratesTable}>
            <thead>
              <tr>
                <th>Currency</th>
                <th>Symbol</th>
                <th>Role</th>
                <th>Forex Rate (vs Base INR)</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((curr) => {
                const rateObj = exchangeRates.find((r) => r.currencyCode === curr.code);
                const isBase = curr.code === currentCompany.baseCurrency;
                return (
                  <tr key={curr.id}>
                    <td style={{ fontWeight: 600 }}>{curr.name} ({curr.code})</td>
                    <td className={styles.mono}>{curr.symbol}</td>
                    <td>
                      {isBase ? (
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                          Base Currency
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Foreign Currency</span>
                      )}
                    </td>
                    <td className={styles.mono} style={{ fontWeight: 600 }}>
                      {isBase ? '₹ 1.0000' : `₹ ${rateObj?.rate ?? '—'}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            <Link
              to={`/companies/${currentCompany.id}?tab=currencies`}
              style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
            >
              View Full Currency Ledger &amp; Rates &rarr;
            </Link>
          </div>
        </div>

        {/* 4. Enterprise Governance Features */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Sliders size={16} style={{ color: '#8b5cf6' }} />
              <span>Core ERP Capabilities &amp; Accounting Features</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Audit Active</span>
          </div>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <div className={styles.featureInfo}>
                <span className={styles.featureName}>Bill-Wise Party Allocation</span>
                <span className={styles.featureDesc}>
                  Track invoices, credit days, and aging receivables/payables on every transaction
                </span>
              </div>
              <span className={styles.featureBadge}>Active</span>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureInfo}>
                <span className={styles.featureName}>Multi-Currency Dual Books</span>
                <span className={styles.featureDesc}>
                  Post transactions in USD, EUR, and AED with automatic base currency conversion
                </span>
              </div>
              <span className={styles.featureBadge}>Active</span>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureInfo}>
                <span className={styles.featureName}>Automatic Voucher Numbering</span>
                <span className={styles.featureDesc}>
                  Company-prefixed annual sequence (PMT-0001, RCT-0001, JRN-0001)
                </span>
              </div>
              <span className={styles.featureBadge}>Active</span>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureInfo}>
                <span className={styles.featureName}>Immutable Audit Trail</span>
                <span className={styles.featureDesc}>
                  Tracks all ledger alterations, cancellation stamps, and user timestamps
                </span>
              </div>
              <span className={styles.featureBadge}>Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
