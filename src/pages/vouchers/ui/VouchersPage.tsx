import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

import { listVouchers, getVoucher, voucherStatusVariant } from '@/entities/voucher';
import type { Voucher, VoucherSummary, VoucherStatus } from '@/entities/voucher';
import { listVoucherTypes } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { listLedgers } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import { CreateVoucherForm } from '@/features/voucher';
import { VoucherActions } from '@/features/voucher';
import { Button, Modal, Select, Loading, EmptyState, Badge } from '@/shared/ui';
import { getErrorMessage, formatCalendarDay } from '@/shared/lib';

import styles from './VouchersPage.module.css';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: VoucherStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

export function VouchersPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [vouchers, setVouchers] = useState<VoucherSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState<VoucherStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState('');

  const [setupLoaded, setSetupLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([listVoucherTypes(companyId), listLedgers(companyId)])
      .then(([types, ledgersResult]) => {
        setVoucherTypes(types);
        setLedgers(ledgersResult);
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load company setup')))
      .finally(() => setSetupLoaded(true));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await listVouchers(id, {
          status: statusFilter || undefined,
          voucherTypeCode: typeFilter || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        setVouchers(result.items);
        setTotal(result.total);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load vouchers'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [companyId, statusFilter, typeFilter, page, refreshKey]);

  function typeName(voucherTypeId: string): string {
    return voucherTypes.find((type) => type.id === voucherTypeId)?.name ?? '—';
  }

  async function openVoucher(id: string) {
    if (!companyId) return;
    setDetailLoading(true);
    try {
      const voucher = await getVoucher(companyId, id);
      setSelectedVoucher(voucher);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load voucher'));
    } finally {
      setDetailLoading(false);
    }
  }

  function handleVoucherChanged(voucher: Voucher) {
    setSelectedVoucher(voucher);
    setRefreshKey((key) => key + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Companies start with an empty chart of accounts, so a voucher cannot be raised until the
  // masters it references exist. Gate the action rather than opening a form that cannot submit.
  const canCreateVoucher = voucherTypes.some((type) => type.isActive) && ledgers.length > 0;
  const setupPending = setupLoaded && !canCreateVoucher;

  if (!companyId) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vouchers</h1>
          <p className={styles.subtitle}>Double-entry transactions for this company.</p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setCreateModalOpen(true)}
          disabled={!canCreateVoucher}
          title={
            canCreateVoucher
              ? undefined
              : 'Add a ledger and an active voucher type to this company first'
          }
        >
          <Plus size={16} /> New voucher
        </Button>
      </div>

      <div className={styles.filters}>
        <Select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value as VoucherStatus | '');
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select
          value={typeFilter}
          onChange={(event) => {
            setPage(1);
            setTypeFilter(event.target.value);
          }}
        >
          <option value="">All voucher types</option>
          {voucherTypes.map((type) => (
            <option key={type.id} value={type.code}>
              {type.name}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <Loading label="Loading vouchers…" />
      ) : vouchers.length === 0 && setupPending ? (
        <EmptyState
          title="This company is not set up yet"
          description="Vouchers reference ledgers and voucher types, and this company has none yet. Set up its chart of accounts first."
          action={
            <Link to={`/companies/${companyId}`} className={styles.setupLink}>
              Go to chart of accounts <ArrowRight size={14} />
            </Link>
          }
        />
      ) : vouchers.length === 0 ? (
        <EmptyState title="No vouchers found" description="Create a voucher to get started." />
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Narration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className={styles.row} onClick={() => openVoucher(voucher.id)}>
                  <td className={styles.mono} title={voucher.id}>
                    {voucher.voucherNumber}
                  </td>
                  <td>{formatCalendarDay(voucher.voucherDate)}</td>
                  <td>{typeName(voucher.voucherTypeId)}</td>
                  <td className={styles.narration}>{voucher.narration ?? '—'}</td>
                  <td>
                    <Badge variant={voucherStatusVariant(voucher.status)}>{voucher.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <span className={styles.pageLabel}>
              Page {page} of {totalPages} · {total} voucher{total === 1 ? '' : 's'}
            </span>
            <div className={styles.pageButtons}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New voucher">
        <CreateVoucherForm
          companyId={companyId}
          voucherTypes={voucherTypes}
          ledgers={ledgers}
          onCreated={() => {
            setCreateModalOpen(false);
            setRefreshKey((key) => key + 1);
          }}
          onCancel={() => setCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        open={selectedVoucher !== null || detailLoading}
        onClose={() => setSelectedVoucher(null)}
        title={selectedVoucher ? `Voucher ${selectedVoucher.voucherNumber}` : 'Loading…'}
      >
        {detailLoading || !selectedVoucher ? (
          <Loading />
        ) : (
          <div className={styles.detail}>
            <div className={styles.detailMeta}>
              <Badge variant={voucherStatusVariant(selectedVoucher.status)}>
                {selectedVoucher.status}
              </Badge>
              <span>{formatCalendarDay(selectedVoucher.voucherDate)}</span>
              {selectedVoucher.referenceNumber && (
                <span>Ref: {selectedVoucher.referenceNumber}</span>
              )}
            </div>
            {selectedVoucher.narration && (
              <p className={styles.detailNarration}>{selectedVoucher.narration}</p>
            )}

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ledger</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {selectedVoucher.entries.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className={styles.mono} title={entry.id}>
                      {selectedVoucher.voucherNumber}/{index + 1}
                    </td>
                    <td>{entry.ledgerCode}</td>
                    <td className={styles.mono}>
                      {Number(entry.debit) > 0 ? Number(entry.debit).toFixed(2) : ''}
                    </td>
                    <td className={styles.mono}>
                      {Number(entry.credit) > 0 ? Number(entry.credit).toFixed(2) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <VoucherActions
              companyId={companyId}
              voucher={selectedVoucher}
              onChanged={handleVoucherChanged}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
