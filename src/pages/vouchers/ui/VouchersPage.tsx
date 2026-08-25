import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

import { listVouchers, getVoucher, voucherStatusVariant } from '@/entities/voucher';
import type { Voucher, VoucherSummary, VoucherStatus } from '@/entities/voucher';
import { listVoucherTypes } from '@/entities/voucher-type';
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
import { Button, Modal, Select, Loading, EmptyState, Badge } from '@/shared/ui';
import { getErrorMessage, formatCalendarDay, formatMoney, formatMoneyWithSide } from '@/shared/lib';
import { useCompanyReadout } from '@/widgets/app-shell';

import styles from './VouchersPage.module.css';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: VoucherStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

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
              formatMoneyWithSide(Number(row.closingDebit) - Number(row.closingCredit), {
                currency: company.baseCurrency,
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
    screen's own request for the company comes back. Preferring whichever arrived first means an
    analytics workspace is turned away at the same moment the sidebar drops its Vouchers link,
    rather than a beat later with the screen half-drawn in between.
  */
  const listedCompany = listLoaded ? companies?.find((entry) => entry.id === companyId) : undefined;
  const company = loaded?.company ?? listedCompany;

  if (!companyId) return null;

  /*
    Nothing is drawn until it is known whether this company posts vouchers at all. Both sources are
    in flight together and either one settles the question, so the wait is the shorter of the two —
    and it is shorter still than it looks, because the table below is a spinner for that same
    window anyway. Drawing a screen that is about to be replaced by "this company does not post
    vouchers" is worse than a moment of nothing. An error releases the hold, so a company that
    cannot be read reports that rather than spinning for ever.
  */
  if (company === undefined && !error) {
    return <Loading label="Loading vouchers…" />;
  }

  /*
    An analytics workspace keeps no double-entry books, which is why its overview offers the
    portfolio where the others offer vouchers and why the sidebar carries no Vouchers link for it.
    Reached by a typed or bookmarked URL this screen would still show filters and an enabled New
    voucher button; saying so plainly, and pointing at the screen that does apply, matches how
    KgPage turns away a company that is not a portfolio workspace.
  */
  if (company?.type === 'ANALYTICS') {
    return (
      <EmptyState
        title="This company does not post vouchers"
        description={`${company.name} is a portfolio workspace, so it has no double-entry books of its own. Its figures come from the businesses tracked under KG Business.`}
        action={
          <Link to={`/companies/${companyId}/kg`}>
            <Button variant="primary">Open the portfolio</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vouchers</h1>
          {/* The reason the action is unavailable has to be readable, not just a tooltip: a
              disabled button takes no focus, so screen readers never reach its title. */}
          <p className={styles.subtitle} id="vouchers-subtitle">
            {setupIncomplete
              ? `Add ${setupMissing.join(' and ')} before vouchers can be created.`
              : 'Double-entry transactions for this company.'}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => openCreate(null)}
          /*
            Also while the setup is still in flight. `setupMissing` is empty until it lands, so
            this read as "nothing missing" and let the form open on no ledgers and no voucher
            types — where it announced "Finish setting up this company" about a company that is
            set up perfectly well. The same distinction the subtitle above already draws.
          */
          disabled={!setupLoadedOk || setupIncomplete}
          aria-describedby={setupIncomplete ? 'vouchers-subtitle' : undefined}
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
        <EmptyState title="No vouchers found" description="Create a voucher to get started." />
      ) : (
        <>
          {/* The grid gets a frame of its own, so a short list stops floating in an empty pane and
              a long one scrolls under a heading that stays put — the same treatment the statements
              got. The pagination below stays outside it, where it belongs to the page rather than
              to the rows. */}
          <div className={styles.tableWrap}>
            <table className={styles.table} data-stack>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Narration</th>
                  <th className={styles.amountHead}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <tr
                    key={voucher.id}
                    className={styles.row}
                    onClick={() => openVoucher(voucher.id)}
                  >
                    <td className={styles.mono} data-label="ID" title={voucher.id}>
                      {voucher.voucherNumber}
                    </td>
                    <td data-label="Date">
                      {formatCalendarDay(voucher.voucherDate, loaded?.company?.country)}
                    </td>
                    <td data-label="Type">{typeName(voucher.voucherTypeId)}</td>
                    <td className={styles.narration} data-label="Narration">
                      {voucher.narration ?? '—'}
                    </td>
                    {/* What the voucher is worth. A list of postings without amounts is a list of
                      dates and narrations, and nobody scanning a day of them is looking for those. */}
                    <td className={styles.amount} data-label="Amount">
                      {/* No symbol. Inside a company every figure is in that company's currency, the
                        status strip says which, and the reports have written them bare since the
                        density pass — this column was the one place left repeating it, so the same
                        amount was written two ways depending on which screen you were on. Where
                        companies are listed side by side the symbol stays, because there it is
                        telling you something. */}
                      {formatMoney(voucher.amount, { country: loaded?.company?.country })}
                    </td>
                    <td data-label="Status">
                      <Badge variant={voucherStatusVariant(voucher.status)}>{voucher.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

      <Modal open={createModalOpen} onClose={() => closeCreate()} title="New voucher" size="wide">
        {/*
          Held back until the masters are in.

          The form reads the ledger list once, when it mounts, to decide what each line starts on.
          Mounting it before the list arrives left both lines holding an empty ledger code while the
          select — which falls back to its first option when its value matches none — showed the
          first account as though it were chosen. Nothing looked wrong, the balance beside each line
          could not be found, and accepting it would have posted a voucher against no account at all.

          It only became reachable when ?new= let a function key open this form on first paint;
          before that the button was the only way in, and by then the masters had long arrived.
        */}
        {!setupLoadedOk ? (
          <Loading label="Loading accounts…" />
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
            onCreated={() => {
              closeCreate();
              booksChanged();
            }}
            onCancel={() => closeCreate()}
          />
        )}
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
              <span>
                {formatCalendarDay(selectedVoucher.voucherDate, loaded?.company?.country)}
              </span>
              {selectedVoucher.referenceNumber && (
                <span>Ref: {selectedVoucher.referenceNumber}</span>
              )}
            </div>
            {selectedVoucher.narration && (
              <p className={styles.detailNarration}>{selectedVoucher.narration}</p>
            )}

            <table className={styles.table} data-stack>
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
                    <td className={styles.mono} data-label="ID" title={entry.id}>
                      {selectedVoucher.voucherNumber}/{index + 1}
                    </td>
                    <td data-label="Ledger">
                      {entry.ledgerCode}
                      {/*
                        A foreign line shows what was actually typed and the rate it was converted
                        at. The Debit and Credit columns are always base currency, so without this
                        the line is indistinguishable from an ordinary one.
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
                    <td className={styles.mono} data-label="Debit">
                      {Number(entry.debit) > 0
                        ? formatMoney(entry.debit, {
                            currency: loaded?.company?.baseCurrency,
                            country: loaded?.company?.country,
                          })
                        : ''}
                    </td>
                    <td className={styles.mono} data-label="Credit">
                      {Number(entry.credit) > 0
                        ? formatMoney(entry.credit, {
                            currency: loaded?.company?.baseCurrency,
                            country: loaded?.company?.country,
                          })
                        : ''}
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
