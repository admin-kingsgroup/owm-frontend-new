import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Receipt, ArrowRight, Lock, Pencil, Trash2 } from 'lucide-react';

import { getCompany, companyStatusVariant } from '@/entities/company';
import type { Company } from '@/entities/company';
import { listAccountGroups, deleteAccountGroup } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import { listLedgers, deleteLedger, getOpeningBalanceSummary } from '@/entities/ledger';
import type { Ledger, OpeningBalanceSummary } from '@/entities/ledger';
import { listVoucherTypes, deleteVoucherType } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { CreateAccountGroupForm } from '@/features/account-group';
import { CreateLedgerForm, EditLedgerForm } from '@/features/ledger';
import { CreateVoucherTypeForm, EditVoucherTypeForm } from '@/features/voucher-type';
import { Button, Modal, Loading, Badge, EmptyState } from '@/shared/ui';
import { getErrorMessage, cn, formatRecordId, calendarYear } from '@/shared/lib';

import { AccountGroupTree } from './AccountGroupTree';
import { FinancialYearsPanel } from './FinancialYearsPanel';
import styles from './CompanyDashboardPage.module.css';

type Tab = 'accounts' | 'voucher-types' | 'financial-years';

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
  const [editingVoucherType, setEditingVoucherType] = useState<VoucherType | null>(null);
  const [deletingVoucherTypeId, setDeletingVoucherTypeId] = useState<string | null>(null);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceSummary | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [companyResult, groupsResult, ledgersResult, voucherTypesResult, openingResult] =
          await Promise.all([
            getCompany(id),
            listAccountGroups(id),
            listLedgers(id),
            listVoucherTypes(id),
            getOpeningBalanceSummary(id),
          ]);
        if (cancelled) return;
        setCompany(companyResult);
        setGroups(groupsResult);
        setLedgers(ledgersResult);
        setVoucherTypes(voucherTypesResult);
        setOpeningBalance(openingResult);
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
  const id = companyId;

  if (loading) {
    return <Loading label="Loading company…" />;
  }

  if (error || !company) {
    return <p className={styles.error}>{error ?? 'Company not found'}</p>;
  }

  const visibleLedgers = selectedGroupId
    ? ledgers.filter((ledger) => ledger.accountGroupId === selectedGroupId)
    : ledgers;

  async function handleDeleteVoucherType(voucherType: VoucherType) {
    const confirmed = window.confirm(`Delete voucher type "${voucherType.name}"? This can't be undone.`);
    if (!confirmed) return;

    setDeletingVoucherTypeId(voucherType.id);
    setError(null);
    try {
      await deleteVoucherType(id, voucherType.id);
      setVoucherTypes((current) => current.filter((vt) => vt.id !== voucherType.id));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete voucher type'));
    } finally {
      setDeletingVoucherTypeId(null);
    }
  }

  async function refreshOpeningBalance() {
    try {
      setOpeningBalance(await getOpeningBalanceSummary(id));
    } catch {
      // A stale difference figure is not worth surfacing an error over — the ledger edit that
      // triggered this already succeeded, and the next load will correct it.
    }
  }

  async function handleDeleteGroup(group: AccountGroup) {
    const confirmed = window.confirm(`Delete account group "${group.name}"? This can't be undone.`);
    if (!confirmed) return;

    setDeletingGroupId(group.id);
    setError(null);
    try {
      await deleteAccountGroup(id, group.id);
      setGroups((current) => current.filter((g) => g.id !== group.id));
      if (selectedGroupId === group.id) setSelectedGroupId(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete account group'));
    } finally {
      setDeletingGroupId(null);
    }
  }

  async function handleDeleteLedger(ledger: Ledger) {
    const confirmed = window.confirm(`Delete ledger "${ledger.name}"? This can't be undone.`);
    if (!confirmed) return;

    setDeletingLedgerId(ledger.id);
    setError(null);
    try {
      await deleteLedger(id, ledger.id);
      setLedgers((current) => current.filter((l) => l.id !== ledger.id));
      void refreshOpeningBalance();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete ledger'));
    } finally {
      setDeletingLedgerId(null);
    }
  }

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
            {calendarYear(company.financialYearStart)}–
            {calendarYear(company.financialYearEnd)}
          </p>
        </div>
        <Link to={`/companies/${companyId}/vouchers`} className={styles.vouchersLink}>
          <Receipt size={16} /> Open vouchers <ArrowRight size={14} />
        </Link>
      </div>

      {openingBalance && openingBalance.difference !== '0.00' && (
        <div className={styles.openingDiff}>
          <strong>Difference in opening balances:</strong> {company.baseCurrency}{' '}
          {openingBalance.difference}
          <span className={styles.openingDiffHint}>
            Debits {openingBalance.totalDebit} · credits {openingBalance.totalCredit}. Opening
            balances should net to zero once every ledger has been entered.
          </span>
        </div>
      )}

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
        <button
          type="button"
          className={cn(styles.tab, tab === 'financial-years' && styles.tabActive)}
          onClick={() => setTab('financial-years')}
        >
          Financial years
        </button>
      </div>

      {tab === 'financial-years' && <FinancialYearsPanel companyId={id} />}

      {tab === 'accounts' && (
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
              onDelete={handleDeleteGroup}
              deletingGroupId={deletingGroupId}
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
                    <th>Actions</th>
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
                      <td>
                        <div className={styles.rowFlags}>
                          {ledger.isSystem && <Lock size={13} aria-label="System ledger" />}
                          {!ledger.isActive && <Badge variant="neutral">Inactive</Badge>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Edit ledger"
                            onClick={() => setEditingLedger(ledger)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Delete ledger"
                            disabled={ledger.isSystem || deletingLedgerId === ledger.id}
                            title={ledger.isSystem ? 'System ledgers cannot be deleted' : undefined}
                            onClick={() => handleDeleteLedger(ledger)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'voucher-types' && (
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
                <th>Actions</th>
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
                  <td>
                    <div className={styles.rowFlags}>
                      {voucherType.isSystem && <Lock size={13} aria-label="System voucher type" />}
                      {!voucherType.isActive && <Badge variant="neutral">Inactive</Badge>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Edit voucher type"
                        onClick={() => setEditingVoucherType(voucherType)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Delete voucher type"
                        disabled={voucherType.isSystem || deletingVoucherTypeId === voucherType.id}
                        title={
                          voucherType.isSystem ? 'System voucher types cannot be deleted' : undefined
                        }
                        onClick={() => handleDeleteVoucherType(voucherType)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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

      <Modal open={editingLedger !== null} onClose={() => setEditingLedger(null)} title="Edit ledger">
        {editingLedger && (
          <EditLedgerForm
            companyId={companyId}
            ledger={editingLedger}
            accountGroups={groups}
            onSaved={(ledger) => {
              setLedgers((current) => current.map((l) => (l.id === ledger.id ? ledger : l)));
              setEditingLedger(null);
            }}
            onCancel={() => setEditingLedger(null)}
          />
        )}
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

      <Modal
        open={editingVoucherType !== null}
        onClose={() => setEditingVoucherType(null)}
        title="Edit voucher type"
      >
        {editingVoucherType && (
          <EditVoucherTypeForm
            companyId={companyId}
            voucherType={editingVoucherType}
            onSaved={(voucherType) => {
              setVoucherTypes((current) =>
                current.map((vt) => (vt.id === voucherType.id ? voucherType : vt)),
              );
              setEditingVoucherType(null);
            }}
            onCancel={() => setEditingVoucherType(null)}
          />
        )}
      </Modal>
    </div>
  );
}
