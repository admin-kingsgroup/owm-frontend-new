import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MOCK_COMPANIES,
  getMockLedgers,
  getMockAccountGroups,
  getMockVoucherTypes,
} from '@/shared/api/mock-erp-data';
import styles from './MastersSection.module.css';

interface MastersSectionProps {
  selectedBusinessId?: string;
  onSelectBusiness?: (id: string) => void;
}

type MasterTab = 'chart-of-accounts' | 'parties' | 'voucher-types';

export const MastersSection: React.FC<MastersSectionProps> = ({
  selectedBusinessId = 'biz-travkings',
}) => {
  const [activeTab, setActiveTab] = useState<MasterTab>('chart-of-accounts');
  const [partySubFilter, setPartySubFilter] = useState<'ALL' | 'DEBTORS' | 'CREDITORS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBizId, setCurrentBizId] = useState(selectedBusinessId);

  // Sync if prop changes
  React.useEffect(() => {
    if (selectedBusinessId) {
      setCurrentBizId(selectedBusinessId);
    }
  }, [selectedBusinessId]);

  const currentCompany = useMemo(
    () => MOCK_COMPANIES.find((c) => c.id === currentBizId) || MOCK_COMPANIES[0],
    [currentBizId]
  );

  const ledgers = useMemo(() => getMockLedgers(currentBizId), [currentBizId]);
  const groups = useMemo(() => getMockAccountGroups(currentBizId), [currentBizId]);
  const voucherTypes = useMemo(() => getMockVoucherTypes(currentBizId), [currentBizId]);

  const groupMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => map.set(g.id, g.name));
    return map;
  }, [groups]);

  // Filtered ledgers for Chart of Accounts
  const filteredLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (groupMap.get(l.accountGroupId) || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [ledgers, searchQuery, groupMap]);

  // Parties (Sundry Debtors & Sundry Creditors)
  const parties = useMemo(() => {
    return ledgers.filter((l) => {
      const grp = groups.find((g) => g.id === l.accountGroupId);
      const isDebtor = grp?.code === 'SUNDRY_DEBTORS' || l.code.startsWith('CUST_');
      const isCreditor = grp?.code === 'SUNDRY_CREDITORS' || l.code.startsWith('VEND_');

      if (!isDebtor && !isCreditor) return false;

      if (partySubFilter === 'DEBTORS' && !isDebtor) return false;
      if (partySubFilter === 'CREDITORS' && !isCreditor) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q) ||
          (l.gstin || '').toLowerCase().includes(q) ||
          (l.contactEmail || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [ledgers, groups, partySubFilter, searchQuery]);

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Masters & Chart of Accounts</h2>
          <p className={styles.subtitle}>
            Financial foundations, ledgers, counter-parties, and voucher series for{' '}
            <strong>{currentCompany.name}</strong>
          </p>
        </div>

        <div className={styles.headerActions}>
          <select
            value={currentBizId}
            onChange={(e) => setCurrentBizId(e.target.value)}
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
            to={`/companies/${currentBizId}/ledgers`}
            className={styles.openMastersBtn}
            title="Open Full ERP Master Center"
          >
            <span>Full Ledger Register →</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTabBtn} ${activeTab === 'chart-of-accounts' ? styles.subTabActive : ''}`}
          onClick={() => {
            setActiveTab('chart-of-accounts');
            setSearchQuery('');
          }}
        >
          <span>Chart of Accounts</span>
          <span className={styles.badge}>{ledgers.length}</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${activeTab === 'parties' ? styles.subTabActive : ''}`}
          onClick={() => {
            setActiveTab('parties');
            setSearchQuery('');
          }}
        >
          <span>Parties (Customers & Vendors)</span>
          <span className={styles.badge}>
            {
              ledgers.filter((l) => l.code.startsWith('CUST_') || l.code.startsWith('VEND_'))
                .length
            }
          </span>
        </button>

        <button
          className={`${styles.subTabBtn} ${activeTab === 'voucher-types' ? styles.subTabActive : ''}`}
          onClick={() => {
            setActiveTab('voucher-types');
            setSearchQuery('');
          }}
        >
          <span>Voucher Types & Numbering</span>
          <span className={styles.badge}>{voucherTypes.length}</span>
        </button>
      </div>

      {/* Search & Sub-filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by code, account name, GSTIN, or group..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1',
            minWidth: '240px',
            maxWidth: '420px',
            padding: '7px 12px',
            fontSize: '12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--paper-card)',
            color: 'var(--ink)',
          }}
        />

        {activeTab === 'parties' && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ALL', 'DEBTORS', 'CREDITORS'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setPartySubFilter(filter)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border:
                    partySubFilter === filter
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  background:
                    partySubFilter === filter ? 'var(--paper-sunken)' : 'transparent',
                  color: partySubFilter === filter ? 'var(--accent)' : 'var(--ink-faint)',
                }}
              >
                {filter === 'ALL'
                  ? 'All Parties'
                  : filter === 'DEBTORS'
                  ? 'Debtors (Clients)'
                  : 'Creditors (Vendors)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'chart-of-accounts' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Code</th>
                <th>Ledger Name</th>
                <th>Account Group</th>
                <th style={{ width: '110px' }}>Nature</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Opening Balance</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Side</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Bill-Wise</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-faint)' }}>
                    No matching ledgers found.
                  </td>
                </tr>
              ) : (
                filteredLedgers.map((l) => {
                  const grp = groups.find((g) => g.id === l.accountGroupId);
                  const isDr = l.openingBalanceType === 'DEBIT';
                  return (
                    <tr key={l.id}>
                      <td className={styles.mono} style={{ fontWeight: 600 }}>{l.code}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{l.name}</div>
                        {l.isSystem && (
                          <span style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>System Account</span>
                        )}
                      </td>
                      <td>{groupMap.get(l.accountGroupId) || 'General Ledger'}</td>
                      <td>
                        <span className={styles.typeBadge}>
                          {grp?.nature || l.ledgerType}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className={styles.mono}>
                        {l.openingBalance && l.openingBalance !== '0'
                          ? `₹${Number(l.openingBalance).toLocaleString('en-IN')}`
                          : '₹0.00'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={isDr ? styles.sideDebit : styles.sideCredit}>
                          {l.openingBalanceType || 'DR'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {l.maintainBillwise ? (
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Yes</span>
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>No</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'parties' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Party Code</th>
                <th>Counter-Party Name</th>
                <th style={{ width: '120px' }}>Party Role</th>
                <th>GSTIN / Tax ID</th>
                <th>Address & Contact</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Current Balance</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-faint)' }}>
                    No counter-parties match current criteria.
                  </td>
                </tr>
              ) : (
                parties.map((p) => {
                  const isDebtor = p.code.startsWith('CUST_');
                  return (
                    <tr key={p.id}>
                      <td className={styles.mono} style={{ fontWeight: 600 }}>{p.code}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                        {p.contactEmail && (
                          <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>{p.contactEmail}</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.typeBadge} ${
                            isDebtor ? styles.partyTypeDebtor : styles.partyTypeCreditor
                          }`}
                        >
                          {isDebtor ? 'Debtor (Customer)' : 'Creditor (Vendor)'}
                        </span>
                      </td>
                      <td className={styles.mono} style={{ fontSize: '11px' }}>
                        {p.gstin || 'Unregistered / International'}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--ink-faint)', maxWidth: '240px' }}>
                        {p.address || 'Headquarters'}
                      </td>
                      <td style={{ textAlign: 'right' }} className={styles.mono}>
                        <span style={{ fontWeight: 600 }}>
                          ₹{Number(p.openingBalance || 0).toLocaleString('en-IN')}
                        </span>{' '}
                        <span style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>
                          {p.openingBalanceType}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--success-fg)', fontWeight: 600, fontSize: '11px' }}>
                          ● Active
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'voucher-types' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Code</th>
                <th>Voucher Name</th>
                <th style={{ width: '120px' }}>Category</th>
                <th style={{ width: '120px' }}>Series Prefix</th>
                <th style={{ width: '130px' }}>Method</th>
                <th style={{ width: '140px' }}>Reset Cycle</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {voucherTypes.map((vt) => (
                <tr key={vt.id}>
                  <td className={styles.mono} style={{ fontWeight: 600 }}>{vt.code}</td>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{vt.name}</td>
                  <td>
                    <span className={styles.typeBadge}>{vt.category}</span>
                  </td>
                  <td className={styles.mono} style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {vt.numbering?.prefix || '—'}
                  </td>
                  <td style={{ fontSize: '11px' }}>{vt.numberingMethod}</td>
                  <td style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
                    {vt.numbering?.resetFrequency || 'YEARLY'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--success-fg)', fontWeight: 600, fontSize: '11px' }}>
                      ● Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
