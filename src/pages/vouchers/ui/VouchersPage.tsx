import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, Files, Plus } from 'lucide-react';

import { listVouchers, getVoucher, voucherStatusVariant } from '@/entities/voucher';
import type { Voucher, VoucherSummary, VoucherStatus } from '@/entities/voucher';
import { functionKeyFor, inFunctionKeyOrder, listVoucherTypes } from '@/entities/voucher-type';
import { getTrialBalance } from '@/entities/report';
import type { VoucherType } from '@/entities/voucher-type';
import { listLedgers } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import { getCompany, useCompanyStore } from '@/entities/company';
import type { Company } from '@/entities/company';
import { listCurrencies } from '@/entities/currency';
import type { Currency } from '@/entities/currency';
import { CreateVoucherForm } from '@/features/voucher';
import { VoucherActions } from '@/features/voucher';
import {
  Button,
  Modal,
  PageSkeleton,
  Skeleton,
  EmptyState,
  Badge,
  Table,
  toast,
} from '@/shared/ui';
import {
  cn,
  getErrorMessage,
  formatCalendarDay,
  formatMoney,
  formatMoneyWithSide,
} from '@/shared/lib';
import { useCompanyReadout } from '@/widgets/app-shell';

import styles from './VouchersPage.module.css';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: VoucherStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

/** The words a person reads for each status, in the order the status bar lists them. */
const STATUS_LABELS: Record<VoucherStatus, string> = {
  POSTED: 'Posted',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
};
const STATUS_ORDER: VoucherStatus[] = ['POSTED', 'DRAFT', 'CANCELLED'];

export function VouchersPage() {
  const { companyId } = useParams<{ companyId: string }>();

  // Held as one value tagged with the company it was fetched for. Tagging lets the render derive
  // "is this the company on screen?" instead of clearing state from inside an effect, which would
  // cascade an extra render on every load.
  const [setup, setSetup] = useState<{
    companyId: string;
    voucherTypes: VoucherType[];
    ledgers: Ledger[];
    company: Company;
    currencies: Currency[];
  } | null>(null);
  const [vouchers, setVouchers] = useState<VoucherSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [typeFilter, setTypeFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * The create form is opened by the URL rather than by local state.
   *
   * The shell's F4 to F7 are available on every screen, and they reach this one by navigating to
   * ?new=PAYMENT — which only works if arriving with the parameter set is the same thing as having
   * pressed New voucher here. It also means the form survives a reload and closes on Back.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = searchParams.get('new');
  const createModalOpen = requestedType !== null;
  const createType = requestedType || null;

  function openCreate(voucherTypeCode: string | null) {
    const params = new URLSearchParams(searchParams);
    params.set('new', voucherTypeCode ?? '');
    setSearchParams(params);
  }

  function closeCreate() {
    const params = new URLSearchParams(searchParams);
    params.delete('new');
    // Replaced, so Back leaves the vouchers list rather than reopening the form just closed.
    setSearchParams(params, { replace: true });
  }

  /**
   * The status filter is in the URL too, so a link can point at a filtered list: the gateway says
   * "6 drafts awaiting post" and expects that to land on the drafts, not on every voucher ever
   * raised. An unrecognised value is ignored rather than filtering the list down to nothing.
   */
  const requestedStatus = searchParams.get('status');
  const statusFilter: VoucherStatus | '' = STATUS_OPTIONS.includes(requestedStatus as VoucherStatus)
    ? (requestedStatus as VoucherStatus)
    : '';

  function setStatusFilter(next: VoucherStatus | '') {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('status', next);
    else params.delete('status');
    setSearchParams(params);
  }

  /**
   * What every account stands at, for the current-balance column of the voucher form. Tagged with
   * the company it was read for, so switching company cannot show the previous set. Read when the
   * form is first opened rather than with the list — someone who came here to look at vouchers
   * should not pay for a trial balance they never see. Null while it is in flight or if it failed;
   * the form shows a dash for accounts it has no figure for and is otherwise unaffected.
   */
  const [ledgerBalances, setLedgerBalances] = useState<{
    companyId: string;
    balances: ReadonlyMap<string, string>;
  } | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  /**
   * How many vouchers stand in each status, for the summary above the register. One request per
   * status asking for a single row — the total is what is wanted, not the rows. Tagged with the
   * company it describes. Null until read, and after a read that failed: the summary is context,
   * and the register below is the same either way.
   */
  const [counts, setCounts] = useState<{
    companyId: string;
    byStatus: Record<VoucherStatus, number>;
  } | null>(null);
  /** The voucher just filed, marked in the register so the eye finds it. */
  const [justFiled, setJustFiled] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  /*
    The frame holds the only copy of the difference and the draft count, so this screen — the one
    that changes them — has to say when they have moved. Without this the context strip would go on
    claiming the books balance after an unbalanced voucher was posted.
  */
  const { refresh: refreshCompanyReadout } = useCompanyReadout();

  /** Everything this screen does that changes the books goes through here. */
  function booksChanged() {
    setRefreshKey((key) => key + 1);
    refreshCompanyReadout();
  }

  // The list the shell already holds — see the note beside `listedCompany` below.
  const companies = useCompanyStore((state) => state.companies);
  const listLoaded = useCompanyStore((state) => state.loaded);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const id = companyId;

    // The company comes along for its feature flags, which decide whether the voucher form shows
    // bill-wise and currency detail at all.
    Promise.all([listVoucherTypes(id), listLedgers(id), getCompany(id)])
      .then(async ([types, ledgersResult, companyResult]) => {
        const currencies = companyResult.features.multiCurrency ? await listCurrencies(id) : [];
        if (cancelled) return;
        setSetup({
          companyId: id,
          voucherTypes: types,
          ledgers: ledgersResult,
          company: companyResult,
          currencies,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load company setup'));
      });

    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    Promise.all(STATUS_ORDER.map((status) => listVouchers(id, { status, page: 1, limit: 1 })))
      .then((results) => {
        if (cancelled) return;
        const byStatus = Object.fromEntries(
          STATUS_ORDER.map((status, index) => [status, results[index].total]),
        ) as Record<VoucherStatus, number>;
        setCounts({ companyId: id, byStatus });
      })
      .catch(() => {
        // Context, not content — see `counts`.
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, refreshKey]);

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
      /*
        A toast rather than the page's error paragraph. That paragraph sits above the register and
        means "this list could not be read"; a voucher that would not open says nothing about the
        list, which is still on screen and still correct. Put there, it also pushed every row down
        by a line at the moment the reader was pointing at one.
      */
      toast.error(getErrorMessage(err, 'Could not open voucher'));
    } finally {
      setDetailLoading(false);
    }
  }

  function handleVoucherChanged(voucher: Voucher) {
    setSelectedVoucher(voucher);
    booksChanged();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * The balances behind the voucher form's current-balance column.
   *
   * Keyed on `refreshKey` as well as the modal, so a voucher posted and then followed by another
   * is entered against what the books say now rather than what they said before it. Formatted here
   * because this is where the company's currency and country are known.
   */
  useEffect(() => {
    if (!createModalOpen || !companyId) return;
    const id = companyId;
    const company = setup?.companyId === id ? setup.company : null;
    if (!company) return;

    let cancelled = false;

    getTrialBalance(id)
      .then((report) => {
        if (cancelled) return;
        setLedgerBalances({
          companyId: id,
          balances: new Map(
            report.rows.map((row) => [
              row.code,
              // Bare too: this is a hint beside a ledger inside the company's own books.
              formatMoneyWithSide(Number(row.closingDebit) - Number(row.closingCredit), {
                country: company.country,
              }),
            ]),
          ),
        });
      })
      .catch(() => {
        // Context, not content. The form is perfectly usable without it, and an error banner over
        // a voucher someone is trying to key would cost more than the column is worth.
      });

    return () => {
      cancelled = true;
    };
  }, [createModalOpen, companyId, setup, refreshKey]);

  // Companies start with an empty chart of accounts, so a voucher cannot be raised until the
  // masters it references exist. Empty arrays only mean that once they came back from a
  // succeeded lookup for THIS company — a failed request, or one still in flight after a company
  // switch, also leaves them empty, and reporting that as "not configured" would tell the user
  // their setup is missing when it is merely unreachable or not here yet.
  const loaded = setup?.companyId === companyId ? setup : null;
  const voucherTypes = loaded?.voucherTypes ?? [];
  const ledgers = loaded?.ledgers ?? [];
  const setupLoadedOk = loaded !== null;

  // Name only what is actually absent — a company can have ledgers but every voucher type
  // deactivated, and telling that user to "add a ledger" would send them to the wrong screen.
  const setupMissing = setupLoadedOk
    ? [
        ledgers.length === 0 ? 'a ledger' : null,
        voucherTypes.some((type) => type.isActive) ? null : 'an active voucher type',
      ].filter((item): item is string => item !== null)
    : [];
  const setupIncomplete = setupMissing.length > 0;

  /*
    The shell reads the company list on entering a company, so it has settled well before this
    screen's own request for the company comes back. Preferring whichever arrived first means the
    header states which books are open, and in which currency, from the earlier of the two rather
    than from this screen's own read alone.
  */
  const listedCompany = listLoaded ? companies?.find((entry) => entry.id === companyId) : undefined;
  const company = loaded?.company ?? listedCompany;

  if (!companyId) return null;

  /*
    Nothing is drawn until one of the two sources has named the company. Both are in flight
    together and either settles it, so the wait is the shorter of the two — and shorter still than
    it looks, because the table below is a spinner for that same window anyway. What it buys is a
    header that never states the wrong currency for a moment before correcting itself. An error
    releases the hold, so a company that cannot be read reports that rather than spinning for ever.
  */
  if (company === undefined && !error) {
    return <PageSkeleton variant="table" heading label="Loading vouchers…" />;
  }

  const country = loaded?.company?.country;
  const money = (value: string | number) => formatMoney(value, { country });
  const raisable = inFunctionKeyOrder(voucherTypes.filter((type) => type.isActive));
  const canCreate = setupLoadedOk && !setupIncomplete;
  const companyCounts = counts?.companyId === companyId ? counts.byStatus : null;
  const counted = companyCounts
    ? STATUS_ORDER.reduce((sum, status) => sum + companyCounts[status], 0)
    : 0;

  function chooseType(code: string) {
    setPage(1);
    setTypeFilter(code);
  }

  function chooseStatus(status: VoucherStatus | '') {
    setPage(1);
    setStatusFilter(status);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>
            <Files size={13} aria-hidden="true" />
            Transactions
          </span>
          <h1 className={styles.title}>Vouchers</h1>
          {/* The reason the action is unavailable has to be readable, not just a tooltip: a
              disabled button takes no focus, so screen readers never reach its title. */}
          <p className={styles.subtitle} id="vouchers-subtitle">
            {setupIncomplete
              ? `Add ${setupMissing.join(' and ')} before vouchers can be created.`
              : 'Raise, post and review every document. A function key starts one from any screen.'}
          </p>
        </div>
        {/*
          Offered to every company. A portfolio workspace has its own Contra, Payment, Receipt and
          Journal, which are ordinary vouchers; the four it files about a business are routed to the
          registry by the strip and the search instead — see raiseVoucherPath.
        */}
        <Button
          type="button"
          variant="primary"
          onClick={() => openCreate(null)}
          /*
            Also while the setup is still in flight: `setupMissing` is empty until it lands, and
            opening the form then would announce a company as not set up when it is merely loading.
          */
          disabled={!canCreate}
          aria-describedby={setupIncomplete ? 'vouchers-subtitle' : undefined}
        >
          <Plus size={16} /> New voucher
        </Button>
      </div>

      <div className={styles.overview}>
        {/* Every document this company raises, with its key — one click, or the key, from here. */}
        <section className={styles.card} style={{ '--i': 1 } as CSSProperties}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Create</h2>
            <span className={styles.cardSub}>one click, or the key from any screen</span>
          </div>
          {raisable.length === 0 && !setupLoadedOk ? (
            <Skeleton lines={3} label="Reading voucher types…" />
          ) : raisable.length === 0 ? (
            <p className={styles.quiet}>No voucher type is switched on.</p>
          ) : (
            <div className={styles.createGrid}>
              {raisable.map((type, index) => {
                const key = functionKeyFor(type.code);
                return (
                  <button
                    key={type.id}
                    type="button"
                    className={styles.createTile}
                    style={{ '--i': index } as CSSProperties}
                    onClick={() => openCreate(type.code)}
                    disabled={!canCreate}
                  >
                    <span className={styles.createTop}>
                      <Plus size={15} aria-hidden="true" />
                      {key && <kbd className={styles.kbd}>{key}</kbd>}
                    </span>
                    <b>{type.name}</b>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/*
          Where the register stands: how much of it is in the books, how much is waiting, how much
          was withdrawn. Each part is a way into the register filtered to it.
        */}
        <section className={styles.card} style={{ '--i': 2 } as CSSProperties}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Where the register stands</h2>
          </div>
          {companyCounts === null ? (
            <p className={styles.quiet}>Counting…</p>
          ) : counted === 0 ? (
            <p className={styles.quiet}>Nothing has been filed yet.</p>
          ) : (
            <>
              <div className={styles.statusTrack} aria-hidden="true">
                {STATUS_ORDER.map((status) =>
                  companyCounts[status] > 0 ? (
                    <span
                      key={status}
                      className={cn(styles.statusPart, styles[`part${status}`])}
                      style={{ flex: companyCounts[status] }}
                    />
                  ) : null,
                )}
              </div>
              <div className={styles.statusList}>
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={cn(styles.statusItem, statusFilter === status && styles.statusOn)}
                    onClick={() => chooseStatus(statusFilter === status ? '' : status)}
                    aria-pressed={statusFilter === status}
                  >
                    <i
                      className={cn(styles.statusDot, styles[`part${status}`])}
                      aria-hidden="true"
                    />
                    {STATUS_LABELS[status]}
                    <b>{companyCounts[status]}</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className={cn(styles.card, styles.register)} style={{ '--i': 3 } as CSSProperties}>
        <div className={styles.filters}>
          <div className={styles.chips} role="group" aria-label="Voucher type">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={typeFilter === ''}
              onClick={() => chooseType('')}
            >
              All types
            </button>
            {inFunctionKeyOrder(voucherTypes).map((type) => (
              <button
                key={type.id}
                type="button"
                className={styles.chip}
                aria-pressed={typeFilter === type.code}
                onClick={() => chooseType(type.code)}
              >
                {type.name}
              </button>
            ))}
          </div>
          <div className={styles.segment} role="group" aria-label="Status">
            <button
              type="button"
              aria-pressed={statusFilter === ''}
              onClick={() => chooseStatus('')}
            >
              All
            </button>
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => chooseStatus(status)}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <PageSkeleton variant="table" label="Loading vouchers…" />
        ) : vouchers.length === 0 && setupIncomplete ? (
          <EmptyState
            title="This company is not set up yet"
            description={`Vouchers reference ledgers and voucher types. This company still needs ${setupMissing.join(' and ')}.`}
            action={
              <Link to={`/companies/${companyId}`} className={styles.setupLink}>
                Go to chart of accounts <ArrowRight size={14} />
              </Link>
            }
          />
        ) : vouchers.length === 0 ? (
          <EmptyState
            title="No vouchers found"
            description={
              typeFilter || statusFilter
                ? 'Nothing matches these filters.'
                : 'Create a voucher to get started.'
            }
          />
        ) : (
          <>
            <p className={styles.summary}>
              <b>{total}</b> voucher{total === 1 ? '' : 's'}
              {(typeFilter || statusFilter) && ' match'}
              <span className={styles.summaryPage}>
                · page {page} of {totalPages}
              </span>
            </p>
            {/* The grid scrolls under a heading that stays put, the same treatment as the statements. */}
            <Table stack sticky className={styles.registerGrid}>
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Narration</th>
                  <th data-num>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => (
                  <tr
                    key={voucher.id}
                    className={cn(styles.row, voucher.id === justFiled && styles.flash)}
                    style={{ '--i': index } as CSSProperties}
                    onClick={() => openVoucher(voucher.id)}
                  >
                    <td data-mono title={voucher.id}>
                      {voucher.voucherNumber}
                    </td>
                    <td>{formatCalendarDay(voucher.voucherDate, country)}</td>
                    <td>{typeName(voucher.voucherTypeId)}</td>
                    <td data-clip>{voucher.narration ?? '—'}</td>
                    {/* Bare, like the statements: inside a company every figure is in its currency. */}
                    <td data-num>{money(voucher.amount)}</td>
                    <td>
                      <Badge variant={voucherStatusVariant(voucher.status)}>
                        {STATUS_LABELS[voucher.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className={styles.pagination}>
              <span className={styles.pageLabel}>
                Page {page} of {totalPages} · {total} voucher{total === 1 ? '' : 's'}
              </span>
              <div className={styles.pageButtons}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Previous page"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={15} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Next page"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal open={createModalOpen} onClose={() => closeCreate()} title="New voucher" size="wide">
        {/*
          Held back until the masters are in. The form reads the ledger list once, when it mounts,
          to decide what each line starts on — mounted before the list arrives, its lines held no
          account while the select showed the first one as though it were chosen.
        */}
        {!setupLoadedOk ? (
          <Skeleton lines={6} label="Loading accounts…" />
        ) : (
          <CreateVoucherForm
            companyId={companyId}
            voucherTypes={voucherTypes}
            ledgers={ledgers}
            billWiseEnabled={Boolean(loaded?.company.features.billWiseDetails)}
            multiCurrencyEnabled={Boolean(loaded?.company.features.multiCurrency)}
            currencies={loaded?.currencies ?? []}
            baseCurrency={loaded?.company.baseCurrency ?? ''}
            initialVoucherTypeCode={createType ?? undefined}
            ledgerBalances={
              ledgerBalances?.companyId === companyId ? ledgerBalances.balances : undefined
            }
            onCreated={(voucher) => {
              closeCreate();
              setJustFiled(voucher.id);
              booksChanged();
              /*
                What it is worth is its debit side. Added up from its lines rather than read from
                `amount`, which the register's summaries carry and a voucher fresh from a post may not.
              */
              const worth = voucher.entries.reduce((sum, entry) => sum + Number(entry.debit), 0);
              toast.success(
                `${voucher.voucherNumber} ${voucher.status === 'POSTED' ? 'posted' : 'saved as a draft'} · ${money(worth)}`,
              );
            }}
            onCancel={() => closeCreate()}
          />
        )}
      </Modal>

      <Modal
        open={selectedVoucher !== null || detailLoading}
        onClose={() => setSelectedVoucher(null)}
        title={selectedVoucher ? `Voucher ${selectedVoucher.voucherNumber}` : 'Loading…'}
        /* One record read beside the list it came from — a panel down the right edge. */
        size="drawer"
      >
        {detailLoading || !selectedVoucher ? (
          <Skeleton lines={8} label="Loading voucher…" />
        ) : (
          <VoucherDetail
            voucher={selectedVoucher}
            typeName={typeName(selectedVoucher.voucherTypeId)}
            country={country}
          >
            <VoucherActions
              companyId={companyId}
              voucher={selectedVoucher}
              onChanged={handleVoucherChanged}
            />
          </VoucherDetail>
        )}
      </Modal>
    </div>
  );
}

/**
 * One voucher, read in full: what it is, every line of it with its side, that it balances, and what
 * has happened to it since it was keyed.
 */
function VoucherDetail({
  voucher,
  typeName,
  country,
  children,
}: {
  voucher: Voucher;
  typeName: string;
  country?: string;
  children: ReactNode;
}) {
  const money = (value: string) => formatMoney(value, { country });
  const debit = voucher.entries.reduce((sum, entry) => sum + Number(entry.debit), 0);
  const credit = voucher.entries.reduce((sum, entry) => sum + Number(entry.credit), 0);
  const balanced = Math.abs(debit - credit) < 0.005;

  return (
    <div className={styles.detail}>
      <div className={styles.detailMeta}>
        <Badge variant={voucherStatusVariant(voucher.status)}>
          {STATUS_LABELS[voucher.status]}
        </Badge>
        <span>{typeName}</span>
        <span>{formatCalendarDay(voucher.voucherDate, country)}</span>
        {voucher.referenceNumber && <span>Ref: {voucher.referenceNumber}</span>}
      </div>
      {voucher.narration && <p className={styles.detailNarration}>{voucher.narration}</p>}

      <Table stack>
        <thead>
          <tr>
            <th>Ledger</th>
            <th data-num>Debit</th>
            <th data-num>Credit</th>
          </tr>
        </thead>
        <tbody>
          {voucher.entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                {entry.ledgerCode}
                {/*
                  A foreign line shows what was actually typed and the rate it was converted at. The
                  columns are always base currency, so without this it looks like any other line.
                */}
                {entry.currencyCode && (
                  <span className={styles.entryForeign}>
                    {entry.fcAmount && (
                      <>
                        {' '}
                        {entry.currencyCode} {Math.abs(Number(entry.fcAmount)).toFixed(2)}
                      </>
                    )}
                    {entry.exchangeRate && <> @ {entry.exchangeRate}</>}
                  </span>
                )}
              </td>
              <td data-num>{Number(entry.debit) > 0 ? money(entry.debit) : ''}</td>
              <td data-num>{Number(entry.credit) > 0 ? money(entry.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td data-num>{money(String(debit))}</td>
            <td data-num>{money(String(credit))}</td>
          </tr>
        </tfoot>
      </Table>

      {balanced && (
        <p className={styles.balanced}>
          <CircleCheck size={16} aria-hidden="true" /> Balanced — debits equal credits
        </p>
      )}

      <ol className={styles.timeline} aria-label="What has happened to it">
        <li className={styles.tlCreated}>
          <b>Keyed</b>
          <span>as a draft</span>
        </li>
        {voucher.postedAt && (
          <li className={styles.tlPosted}>
            <b>Posted</b>
            <span>{formatCalendarDay(voucher.postedAt, country)}</span>
          </li>
        )}
        {voucher.cancelledAt && (
          <li className={styles.tlCancelled}>
            <b>Cancelled</b>
            <span>{formatCalendarDay(voucher.cancelledAt, country)}</span>
          </li>
        )}
      </ol>

      {children}
    </div>
  );
}
