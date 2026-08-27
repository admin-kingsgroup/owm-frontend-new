import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Plus, Receipt, ArrowRight, Lock, Pencil, Trash2, BarChart3 } from 'lucide-react';

import {
  getCompany,
  companyStatusVariant,
  companyTypeLabel,
  useCompanyStore,
} from '@/entities/company';
import type { Company } from '@/entities/company';
import { listAccountGroups, deleteAccountGroup } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import { listLedgers, deleteLedger, getOpeningBalanceSummary } from '@/entities/ledger';
import type { Ledger, OpeningBalanceSummary } from '@/entities/ledger';
import { listVoucherTypes, deleteVoucherType } from '@/entities/voucher-type';
import { listNumberSeries } from '@/entities/number-series';
import { listCurrencies } from '@/entities/currency';
import type { Currency } from '@/entities/currency';
import type { VoucherType } from '@/entities/voucher-type';
import type { NumberSeries } from '@/entities/number-series';
import { CreateAccountGroupForm } from '@/features/account-group';
import { CreateLedgerForm, EditLedgerForm } from '@/features/ledger';
import { CreateVoucherTypeForm, EditVoucherTypeForm } from '@/features/voucher-type';
import {
  Button,
  Modal,
  Loading,
  Badge,
  EmptyState,
  Panel,
  Table,
  Tabs,
  IconButton,
  IconButtonGroup,
  ConfirmDialog,
  toast,
} from '@/shared/ui';
import { getErrorMessage, formatRecordId, calendarYear, formatMoney } from '@/shared/lib';

import { AccountGroupTree } from './AccountGroupTree';
import { FinancialYearsPanel } from './FinancialYearsPanel';
import { CompanySettingsPanel } from './CompanySettingsPanel';
import { PartiesPanel } from './PartiesPanel';
import { CurrenciesPanel } from './CurrenciesPanel';
import { CompanyGateway } from './CompanyGateway';
import { PortfolioDashboard } from './PortfolioDashboard';
import { ImportExportPanel } from './ImportExportPanel';
import styles from './CompanyDashboardPage.module.css';

/**
 * The panels, in the order the strip draws them, with the words on the tabs.
 *
 * One list rather than two: the ids and the labels were separately maintained — the ids in an
 * array up here and the labels written into seven hand-built buttons three hundred lines below —
 * so adding a panel meant editing both and a renamed one could disagree with itself.
 */
const TABS = [
  { id: 'accounts', label: 'Chart of accounts' },
  { id: 'parties', label: 'Parties' },
  { id: 'voucher-types', label: 'Voucher types' },
  { id: 'financial-years', label: 'Financial years' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'import-export', label: 'Import & export' },
  { id: 'settings', label: 'Settings' },
] as const;

const TAB_IDS = TABS.map((tab) => tab.id);

type Tab = (typeof TABS)[number]['id'];

/**
 * What is waiting on a yes.
 *
 * One dialog for all three kinds rather than three, because only one can ever be open: the reader
 * has pressed a delete icon on a row, and until they answer nothing else on the screen is reachable.
 */
type Pending =
  | { kind: 'group'; group: AccountGroup }
  | { kind: 'ledger'; ledger: Ledger }
  | { kind: 'voucher-type'; voucherType: VoucherType };

function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

/** What the confirming button says, and what it will cost — one sentence per kind. */
function describe(pending: Pending): { title: string; consequence: string; confirmLabel: string } {
  switch (pending.kind) {
    case 'group':
      return {
        title: `Delete account group “${pending.group.name}”?`,
        consequence: 'This cannot be undone.',
        confirmLabel: 'Delete group',
      };
    case 'ledger':
      return {
        title: `Delete ledger “${pending.ledger.name}”?`,
        consequence: 'This cannot be undone.',
        confirmLabel: 'Delete ledger',
      };
    case 'voucher-type':
      return {
        title: `Delete voucher type “${pending.voucherType.name}”?`,
        consequence: 'This cannot be undone.',
        confirmLabel: 'Delete voucher type',
      };
  }
}

/**
 * Whether this company has the panel at all. Currencies exists only behind multi-currency, and now
 * that the open panel comes from the URL a bookmark kept after the feature was switched off would
 * otherwise land on a tab strip with nothing selected and an empty page under it. A company still
 * loading is given the benefit of the doubt.
 */
function isAvailable(tab: Tab, company: Company | null): boolean {
  if (!company) return true;
  if (tab === 'currencies') return company.features.multiCurrency;
  return true;
}

export function CompanyDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const upsertCompany = useCompanyStore((state) => state.upsert);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Which panel is open lives in the URL: the Company and Masters menus link straight at one, and
   * reloading a page you were sent to should land where the link pointed rather than back on the
   * chart of accounts. An unknown id falls back to the first panel rather than showing nothing.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab =
    isTab(requestedTab) && isAvailable(requestedTab, company) ? requestedTab : 'accounts';

  /** With no panel asked for this screen is the gateway, which needs far less than the panels do. */
  const showTabs = requestedTab !== null;

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
  };

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [voucherTypeModalOpen, setVoucherTypeModalOpen] = useState(false);
  const [editingVoucherType, setEditingVoucherType] = useState<VoucherType | null>(null);
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null);
  /** The row waiting on a yes, and whether its deletion is in flight. */
  const [pending, setPending] = useState<Pending | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceSummary | null>(null);
  const [numberSeries, setNumberSeries] = useState<NumberSeries[]>([]);

  /** Bumped by anything that creates masters in bulk, so the lists below re-read what it made. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    /**
     * The gateway needs the company and its voucher types; the panels need the masters as well.
     *
     * Split because the gateway is the company's front door — the screen opened most often, and by
     * far the one that used to pay the most for it. Loading every master list to draw a menu and a
     * balance summary cost seven requests where two will do; the other five arrive when a panel
     * that actually reads them is opened.
     */
    async function load() {
      setLoading(true);
      try {
        const [companyResult, voucherTypesResult] = await Promise.all([
          getCompany(id),
          listVoucherTypes(id),
        ]);
        if (cancelled) return;
        setCompany(companyResult);
        setVoucherTypes(voucherTypesResult);

        if (!showTabs) return;

        const [groupsResult, ledgersResult, openingResult, seriesResult, currenciesResult] =
          await Promise.all([
            listAccountGroups(id),
            listLedgers(id),
            getOpeningBalanceSummary(id),
            listNumberSeries(id),
            // Optional context for the ledger form, not something the page depends on. A company
            // with multi-currency off has none, and failing the whole dashboard over that would
            // be the wrong trade.
            listCurrencies(id).catch(() => [] as Currency[]),
          ]);
        if (cancelled) return;
        setGroups(groupsResult);
        setLedgers(ledgersResult);
        setOpeningBalance(openingResult);
        setNumberSeries(seriesResult);
        setCurrencies(currenciesResult);
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
  }, [companyId, showTabs, reloadKey]);

  /**
   * A company edited here is the same record the switcher and the companies page are showing, so
   * the change is published to the shared store rather than kept in this screen's state.
   */
  function handleCompanyChanged(updated: Company) {
    setCompany(updated);
    upsertCompany(updated);
  }

  if (!companyId) return null;
  const id = companyId;

  /*
    Only while there is nothing to show. This screen reloads itself after a panel changes something
    — an import, an opening balance — and blanking the whole page to a spinner for that took the
    panel down with it: an import reported what it created and what it refused, and the report
    vanished in the same instant the numbers it described arrived. A refresh now happens underneath
    whatever is on screen, which is also what it looks like to anyone watching.

    Against the company being asked for, not merely against having one. Moving between companies
    also runs this effect, and what is on screen then belongs to the company being left — holding
    it up while the next one loads would show one company's books under another's name, which is a
    worse thing to show than a spinner.
  */
  if (loading && company?.id !== id) {
    return <Loading label="Loading company…" />;
  }

  if (error || !company) {
    return <p className={styles.error}>{error ?? 'Company not found'}</p>;
  }

  /*
    With no panel asked for, this screen is the company's dashboard rather than its settings — the
    screen the Dashboards menu names and the one entering a company lands on. Every panel below is
    still one ?tab= away, and that is what the Company and Masters menus link at.

    Which dashboard depends on what the company is for. An analytics workspace posts nothing, so it
    has no cash position, no drafts and no trial balance to report on; showing it the accounting
    dashboard would be four tiles of nil above a balance sheet that will never have anything in it.
  */
  if (!showTabs) {
    return company.type === 'ANALYTICS' ? (
      <PortfolioDashboard company={company} />
    ) : (
      <CompanyGateway company={company} voucherTypes={voucherTypes} />
    );
  }

  const visibleLedgers = selectedGroupId
    ? ledgers.filter((ledger) => ledger.accountGroupId === selectedGroupId)
    : ledgers;

  async function refreshOpeningBalance() {
    try {
      setOpeningBalance(await getOpeningBalanceSummary(id));
    } catch {
      // A stale difference figure is not worth surfacing an error over — the ledger edit that
      // triggered this already succeeded, and the next load will correct it.
    }
  }

  /**
   * Carries out whatever the reader has just said yes to.
   *
   * One path for all three kinds. Each said the same four things in its own words before — set a
   * deleting id, call the endpoint, filter the row out, catch into the page's error paragraph —
   * and the only real difference between them is which endpoint and which list.
   *
   * The outcome is now reported either way. A delete that worked used to be indistinguishable from
   * one that silently did nothing: the row left the table in both cases, because the table is this
   * screen's own state.
   */
  async function handleConfirmDelete() {
    if (!pending) return;

    setDeleting(true);
    setError(null);

    try {
      switch (pending.kind) {
        case 'group': {
          const { group } = pending;
          await deleteAccountGroup(id, group.id);
          setGroups((current) => current.filter((entry) => entry.id !== group.id));
          if (selectedGroupId === group.id) setSelectedGroupId(null);
          toast.success(`Account group “${group.name}” deleted.`);
          break;
        }
        case 'ledger': {
          const { ledger } = pending;
          await deleteLedger(id, ledger.id);
          setLedgers((current) => current.filter((entry) => entry.id !== ledger.id));
          void refreshOpeningBalance();
          toast.success(`Ledger “${ledger.name}” deleted.`);
          break;
        }
        case 'voucher-type': {
          const { voucherType } = pending;
          await deleteVoucherType(id, voucherType.id);
          setVoucherTypes((current) => current.filter((entry) => entry.id !== voucherType.id));
          toast.success(`Voucher type “${voucherType.name}” deleted.`);
          break;
        }
      }

      setPending(null);
    } catch (err) {
      /*
        The dialog stays open on a failure, holding the row it names. Closing it would leave the
        reader looking at a table with the row still in it and a message about why, which reads as
        though the wrong thing was deleted.
      */
      toast.error(getErrorMessage(err, 'Could not delete'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>{company.name}</h1>
            <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
            {/*
              The type decides the whole chart of accounts and cannot be changed afterwards, so it
              has to stay visible. Without it a personal ledger and a trading company are
              indistinguishable once created.
            */}
            <Badge variant="neutral">{companyTypeLabel(company.type)}</Badge>
          </div>
          <p className={styles.subtitle}>
            {company.code} · {company.baseCurrency} · {company.country} · FY{' '}
            {calendarYear(company.financialYearStart)}–{calendarYear(company.financialYearEnd)}
          </p>
        </div>
        {/*
          An analytics workspace posts nothing, so it has no vouchers to open. It gets the portfolio
          instead — the two are mutually exclusive by design.
        */}
        {company.type === 'ANALYTICS' ? (
          <Link to={`/companies/${companyId}/kg`} className={styles.vouchersLink}>
            <BarChart3 size={16} /> Open portfolio <ArrowRight size={14} />
          </Link>
        ) : (
          <Link to={`/companies/${companyId}/vouchers`} className={styles.vouchersLink}>
            <Receipt size={16} /> Open vouchers <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {openingBalance && openingBalance.difference !== '0.00' && (
        <div className={styles.openingDiff}>
          {/* Bare, like the ledger table below it. These three sat on the same tab as figures
              written without a symbol, so one screen stated the same currency two ways. */}
          <strong>Difference in opening balances:</strong>{' '}
          {formatMoney(openingBalance.difference, { country: company.country })}
          <span className={styles.openingDiffHint}>
            Debits {formatMoney(openingBalance.totalDebit, { country: company.country })} · credits{' '}
            {formatMoney(openingBalance.totalCredit, { country: company.country })}. Opening
            balances should net to zero once every ledger has been entered.
          </span>
        </div>
      )}

      {/*
        Built from the one TABS list, filtered by what this company actually has — a company
        without multi-currency has no currencies panel, and offering the tab would open an empty
        one. Announced as a tablist, which seven plain buttons in a row were not.
      */}
      <Tabs
        label="Company panels"
        value={tab}
        onChange={setTab}
        items={TABS.filter((entry) => isAvailable(entry.id, company))}
      />

      {/*
        Separate from the chart of accounts because it answers a different question: that screen is
        about the shape of the books, this is about the people in them.
      */}
      {tab === 'parties' && <PartiesPanel companyId={id} />}

      {tab === 'financial-years' && <FinancialYearsPanel companyId={id} />}

      {tab === 'currencies' && company.features.multiCurrency && (
        <CurrenciesPanel companyId={id} baseCurrency={company.baseCurrency} />
      )}

      {tab === 'import-export' && (
        <ImportExportPanel
          companyId={id}
          companyCode={company.code}
          groups={groups}
          ledgers={ledgers}
          currencies={currencies}
          /* Imported ledgers are the same records the chart of accounts shows, so it re-reads. */
          onImported={() => setReloadKey((key) => key + 1)}
        />
      )}

      {tab === 'settings' && (
        <CompanySettingsPanel
          company={company}
          onChanged={handleCompanyChanged}
          /* Syncing default masters creates groups, ledgers and voucher types the other
             panels are already showing, so they re-read what it made. */
          onMastersSynced={() => setReloadKey((key) => key + 1)}
        />
      )}

      {tab === 'accounts' && (
        <div className={styles.accountsLayout}>
          <Panel
            title="Account groups"
            actions={
              <Button type="button" variant="ghost" onClick={() => setGroupModalOpen(true)}>
                <Plus size={14} /> New
              </Button>
            }
          >
            <AccountGroupTree
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={setSelectedGroupId}
              onDelete={(group) => setPending({ kind: 'group', group })}
              deletingGroupId={pending?.kind === 'group' && deleting ? pending.group.id : null}
            />
          </Panel>

          <Panel
            title="Ledgers"
            flush={visibleLedgers.length > 0}
            actions={
              <Button type="button" variant="ghost" onClick={() => setLedgerModalOpen(true)}>
                <Plus size={14} /> New
              </Button>
            }
          >
            {visibleLedgers.length === 0 ? (
              <EmptyState title="No ledgers here" description="Create a ledger under this group." />
            ) : (
              /* A record list — one ledger per row with a handful of named fields — so it becomes
                 a list of cards on a phone rather than a sideways scroll. */
              <Table surface="plain" stack>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th data-num>Opening balance</th>
                    <th>Currency</th>
                    <th />
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLedgers.map((ledger) => (
                    <tr key={ledger.id}>
                      <td data-mono title={ledger.id}>
                        {formatRecordId(company.code, 'LED', ledger.code)}
                      </td>
                      <td data-mono>{ledger.code}</td>
                      <td>{ledger.name}</td>
                      <td>{ledger.ledgerType}</td>
                      <td data-num>
                        {/*
                          A figure and the side it falls on, written as the rest of the product
                          writes them: no symbol (the strip below names the currency), Dr/Cr rather
                          than DEBIT/CREDIT, and a dot for nil — a chart of accounts is mostly
                          accounts that have not opened with anything, and forty copies of 0.00
                          hide the few that have.
                        */}
                        {(() => {
                          const amount = formatMoney(ledger.openingBalance, {
                            country: company.country,
                            blankZero: true,
                          });
                          if (!amount) return <span className={styles.nil}>·</span>;
                          return (
                            <>
                              {amount}{' '}
                              <span className={styles.side}>
                                {ledger.openingBalanceType === 'DEBIT' ? 'Dr' : 'Cr'}
                              </span>
                            </>
                          );
                        })()}
                      </td>
                      {/*
                        Which accounts are foreign is the question the field exists to answer, so it
                        belongs in the list and not only inside the edit form. Base currency is shown
                        muted rather than left blank, so an empty cell never reads as missing data.
                      */}
                      <td data-mono>
                        {ledger.currencyId ? (
                          <Badge variant="neutral">
                            {currencies.find((currency) => currency.id === ledger.currencyId)
                              ?.code ?? 'Unknown'}
                          </Badge>
                        ) : (
                          <span className={styles.muted}>{company.baseCurrency}</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.rowFlags}>
                          {ledger.isSystem && <Lock size={13} aria-label="System ledger" />}
                          {!ledger.isActive && <Badge variant="neutral">Inactive</Badge>}
                        </div>
                      </td>
                      <td>
                        <IconButtonGroup>
                          <IconButton
                            label={`Edit ledger ${ledger.name}`}
                            onClick={() => setEditingLedger(ledger)}
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            label={`Delete ledger ${ledger.name}`}
                            variant="danger"
                            disabled={ledger.isSystem}
                            title={ledger.isSystem ? 'System ledgers cannot be deleted' : undefined}
                            onClick={() => setPending({ kind: 'ledger', ledger })}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </IconButtonGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {tab === 'voucher-types' && (
        <Panel
          title="Voucher types"
          flush
          actions={
            <Button type="button" variant="ghost" onClick={() => setVoucherTypeModalOpen(true)}>
              <Plus size={14} /> New
            </Button>
          }
        >
          <Table surface="plain" stack>
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
                  <td data-mono title={voucherType.id}>
                    {formatRecordId(company.code, 'VTY', voucherType.code)}
                  </td>
                  <td data-mono>{voucherType.code}</td>
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
                    <IconButtonGroup>
                      <IconButton
                        label={`Edit voucher type ${voucherType.name}`}
                        onClick={() => setEditingVoucherType(voucherType)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        label={`Delete voucher type ${voucherType.name}`}
                        variant="danger"
                        disabled={voucherType.isSystem}
                        title={
                          voucherType.isSystem
                            ? 'System voucher types cannot be deleted'
                            : undefined
                        }
                        onClick={() => setPending({ kind: 'voucher-type', voucherType })}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </IconButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
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
          currencies={currencies}
          baseCurrency={company.baseCurrency}
          onCreated={(ledger) => {
            setLedgers((current) => [...current, ledger]);
            setLedgerModalOpen(false);
          }}
          onCancel={() => setLedgerModalOpen(false)}
        />
      </Modal>

      <Modal
        open={editingLedger !== null}
        onClose={() => setEditingLedger(null)}
        title="Edit ledger"
      >
        {editingLedger && (
          <EditLedgerForm
            companyId={companyId}
            ledger={editingLedger}
            accountGroups={groups}
            currencies={currencies}
            baseCurrency={company.baseCurrency}
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

      {/*
        The one dialog behind all three delete icons. It replaces window.confirm(), which drew an
        operating-system box that ignored the theme, could not say more than a line, and labelled
        the destructive choice "OK".
      */}
      {pending && (
        <ConfirmDialog
          open
          destructive
          busy={deleting}
          {...describe(pending)}
          cancelLabel="Keep"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPending(null)}
        />
      )}

      <Modal
        open={editingVoucherType !== null}
        onClose={() => setEditingVoucherType(null)}
        title="Edit voucher type"
      >
        {editingVoucherType && (
          <EditVoucherTypeForm
            companyId={companyId}
            voucherType={editingVoucherType}
            companyCode={company.code}
            financialYearLabel={numberSeries[0]?.financialYear ?? ''}
            // A type whose counters have all issued nothing can still be reshaped.
            numberingEditable={numberSeries
              .filter((entry) => entry.voucherTypeId === editingVoucherType.id)
              .every((entry) => entry.currentNumber === 0)}
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
