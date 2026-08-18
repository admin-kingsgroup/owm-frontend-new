import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Receipt, ArrowRight, Lock } from 'lucide-react';

import { getCompany, companyStatusVariant } from '@/entities/company';
import type { Company } from '@/entities/company';
import { listAccountGroups } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import { listLedgers } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import { listVoucherTypes } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { CreateAccountGroupForm } from '@/features/account-group';
import { CreateLedgerForm } from '@/features/ledger';
import { CreateVoucherTypeForm } from '@/features/voucher-type';
import { Button, Modal, Loading, Badge, EmptyState } from '@/shared/ui';
import { getErrorMessage, cn, formatRecordId } from '@/shared/lib';

import { AccountGroupTree } from './AccountGroupTree';
import styles from './CompanyDashboardPage.module.css';

type Tab = 'accounts' | 'voucher-types';

export function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('accounts');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [voucherTypeModalOpen, setVoucherTypeModalOpen] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [companyResult, groupsResult, ledgersResult, voucherTypesResult] = await Promise.all([
          getCompany(id),
          listAccountGroups(id),
          listLedgers(id),
          listVoucherTypes(id),
        ]);
        if (cancelled) return;
        setCompany(companyResult);
        setGroups(groupsResult);
        setLedgers(ledgersResult);
        setVoucherTypes(voucherTypesResult);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load company'));
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

  if (loading) {
    return <Loading label="Loading company…" />;
  }

  if (error || !company) {
    return <p className={styles.error}>{error ?? 'Company not found'}</p>;
  }

  const visibleLedgers = selectedGroupId
    ? ledgers.filter((ledger) => ledger.accountGroupId === selectedGroupId)
    : ledgers;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>{company.name}</h1>
            <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
          </div>
          <p className={styles.subtitle}>
            {company.code} · {company.baseCurrency} · {company.country} · FY{' '}
            {new Date(company.financialYearStart).getFullYear()}–
            {new Date(company.financialYearEnd).getFullYear()}
          </p>
        </div>
        <Link to={`/companies/${companyId}/vouchers`} className={styles.vouchersLink}>
          <Receipt size={16} /> Open vouchers <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={cn(styles.tab, tab === 'accounts' && styles.tabActive)}
          onClick={() => setTab('accounts')}
        >
          Chart of accounts
        </button>
        <button
          type="button"
          className={cn(styles.tab, tab === 'voucher-types' && styles.tabActive)}
          onClick={() => setTab('voucher-types')}
        >
          Voucher types
        </button>
      </div>

      {tab === 'accounts' ? (
        <div className={styles.accountsLayout}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Account groups</span>
              <Button type="button" variant="ghost" onClick={() => setGroupModalOpen(true)}>
                <Plus size={14} /> New
              </Button>
            </div>
            <AccountGroupTree
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={setSelectedGroupId}
            />
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Ledgers</span>
              <Button type="button" variant="ghost" onClick={() => setLedgerModalOpen(true)}>
                <Plus size={14} /> New
              </Button>
            </div>

            {visibleLedgers.length === 0 ? (
              <EmptyState title="No ledgers here" description="Create a ledger under this group." />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Opening balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleLedgers.map((ledger) => (
                    <tr key={ledger.id}>
                      <td className={styles.mono} title={ledger.id}>
                        {formatRecordId(company.code, 'LED', ledger.code)}
                      </td>
                      <td className={styles.mono}>{ledger.code}</td>
                      <td>{ledger.name}</td>
                      <td>{ledger.ledgerType}</td>
                      <td className={styles.mono}>
                        {Number(ledger.openingBalance).toFixed(2)} {ledger.openingBalanceType}
                      </td>
                      <td className={styles.rowFlags}>
                        {ledger.isSystem && <Lock size={13} aria-label="System ledger" />}
                        {!ledger.isActive && <Badge variant="neutral">Inactive</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Voucher types</span>
            <Button type="button" variant="ghost" onClick={() => setVoucherTypeModalOpen(true)}>
              <Plus size={14} /> New
            </Button>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Numbering</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {voucherTypes.map((voucherType) => (
                <tr key={voucherType.id}>
                  <td className={styles.mono} title={voucherType.id}>
                    {formatRecordId(company.code, 'VTY', voucherType.code)}
                  </td>
                  <td className={styles.mono}>{voucherType.code}</td>
                  <td>{voucherType.name}</td>
                  <td>{voucherType.category.replace('_', ' ')}</td>
                  <td>{voucherType.numberingMethod}</td>
                  <td className={styles.rowFlags}>
                    {voucherType.isSystem && <Lock size={13} aria-label="System voucher type" />}
                    {!voucherType.isActive && <Badge variant="neutral">Inactive</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        title="New account group"
      >
        <CreateAccountGroupForm
          companyId={companyId}
          existingGroups={groups}
          onCreated={(group) => {
            setGroups((current) => [...current, group]);
            setGroupModalOpen(false);
          }}
          onCancel={() => setGroupModalOpen(false)}
        />
      </Modal>

      <Modal open={ledgerModalOpen} onClose={() => setLedgerModalOpen(false)} title="New ledger">
        <CreateLedgerForm
          companyId={companyId}
          accountGroups={groups}
          onCreated={(ledger) => {
            setLedgers((current) => [...current, ledger]);
            setLedgerModalOpen(false);
          }}
          onCancel={() => setLedgerModalOpen(false)}
        />
      </Modal>

      <Modal
        open={voucherTypeModalOpen}
        onClose={() => setVoucherTypeModalOpen(false)}
        title="New voucher type"
      >
        <CreateVoucherTypeForm
          companyId={companyId}
          onCreated={(voucherType) => {
            setVoucherTypes((current) => [...current, voucherType]);
            setVoucherTypeModalOpen(false);
          }}
          onCancel={() => setVoucherTypeModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
