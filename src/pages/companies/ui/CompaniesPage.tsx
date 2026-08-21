import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, ArrowRight, Pencil, Power } from 'lucide-react';

import { updateCompany, companyStatusVariant, useCompanyStore } from '@/entities/company';
import type { Company } from '@/entities/company';
import { getGroupOverview } from '@/entities/report';
import type { CompanyOverview, GroupOverview } from '@/entities/report';
import { CreateCompanyForm, EditCompanyForm } from '@/features/company';
import { Button, Modal, Loading, EmptyState, Badge, Sparkline } from '@/shared/ui';
import { cn, formatMoney, getErrorMessage } from '@/shared/lib';

import styles from './CompaniesPage.module.css';

/** Plain words for the stored company type — the enum value is not what a person should read. */
const COMPANY_TYPE_LABELS: Record<string, string> = {
  TRADING: 'Trading business',
  PERSONAL: 'Personal wealth ledger',
  ANALYTICS: 'Portfolio analytics',
};

export function CompaniesPage() {
  const navigate = useNavigate();

  // One shared list, so the topbar switcher and this page cannot disagree and a company created
  // here is visible everywhere immediately.
  const companies = useCompanyStore((state) => state.companies);
  const companiesLoaded = useCompanyStore((state) => state.loaded);
  const companiesError = useCompanyStore((state) => state.error);
  const loadCompanies = useCompanyStore((state) => state.load);
  const upsertCompany = useCompanyStore((state) => state.upsert);

  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The figures failing is a degraded page, not a broken one — kept apart from `error`. */
  const [figuresError, setFiguresError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The list and the figures are independent: either failing must not take the other down. The
    // list is owned by the store; only the figures are local to this screen.
    void loadCompanies();
    getGroupOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setFiguresError(getErrorMessage(err, 'Could not load figures for these companies'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadCompanies]);

  /**
   * Which country's conventions to group a figure by. A per-currency total has no single company
   * behind it, so it takes the country of the first company using that currency — which is the
   * right answer whenever a currency belongs to one region, and no worse than the browser's guess
   * when it does not.
   */
  const countryOf = useCallback(
    (currency: string) => companies?.find((c) => c.baseCurrency === currency)?.country,
    [companies],
  );

  const figuresById = useMemo(
    () => new Map((overview?.companies ?? []).map((row) => [row.companyId, row])),
    [overview],
  );

  /**
   * The group strip. Currencies are listed separately because the API totals them separately —
   * a group holding an INR company beside a USD one has no single cash position.
   */
  const groupStats = useMemo(() => {
    if (!overview) return [];

    const { totals } = overview;
    const multiCurrency = totals.byCurrency.length > 1;

    // With a single company the strip would restate that company's own card word for word. The
    // counts still earn their place, because the card does not carry them.
    const currencyStats =
      totals.companyCount <= 1
        ? []
        : totals.byCurrency.flatMap((total) => {
            const country = countryOf(total.currency);
            return [
              {
                key: `${total.currency}-cash`,
                label: multiCurrency ? `Cash & bank · ${total.currency}` : 'Cash & bank',
                value: formatMoney(total.cashAndBank, { currency: total.currency, country }),
                negative: Number(total.cashAndBank) < 0,
              },
              {
                key: `${total.currency}-profit`,
                label: multiCurrency ? `Net profit · ${total.currency}` : 'Net profit',
                value: formatMoney(total.netProfit, { currency: total.currency, country }),
                negative: Number(total.netProfit) < 0,
              },
            ];
          });

    return [
      ...currencyStats,
      {
        key: 'drafts',
        label: 'Awaiting posting',
        value: String(totals.draftVoucherCount),
        negative: false,
      },
      {
        key: 'years',
        label: 'Open years',
        value: `${totals.openYearCount} of ${totals.companyCount}`,
        negative: false,
      },
      // Only worth a slot when there is something to explain — it is the reason the figures above
      // do not add up to what the list below shows.
      ...(totals.inactiveCount > 0
        ? [
            {
              key: 'inactive',
              label: 'Deactivated',
              value: `${totals.inactiveCount} · not counted`,
              negative: false,
            },
          ]
        : []),
    ];
  }, [overview, countryOf]);

  function handleCreated(company: Company) {
    upsertCompany(company);
    setCreateModalOpen(false);
    navigate(`/companies/${company.id}`);
  }

  function handleEdited(company: Company) {
    setEditingCompany(null);
    upsertCompany(company);
  }

  async function handleToggleStatus(company: Company) {
    if (company.status === 'ACTIVE') {
      const confirmed = window.confirm(
        `Deactivate ${company.name}? It will be hidden from day-to-day use, but nothing is deleted — you can reactivate it any time.`,
      );
      if (!confirmed) return;
    }

    setTogglingId(company.id);
    setError(null);
    try {
      const updated = await updateCompany(company.id, {
        status: company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      upsertCompany(updated);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update company status'));
    } finally {
      setTogglingId(null);
    }
  }

  function renderFigures(
    figures: CompanyOverview | undefined,
    companyId: string,
    country?: string,
  ) {
    if (!figures) return null;

    // A company that cannot be reported on still belongs on the list. Saying why beats showing
    // zeroes that read as real balances.
    if (figures.error) {
      return <p className={styles.cardNotice}>{figures.error}</p>;
    }

    return (
      <>
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Cash &amp; bank</span>
            <span
              className={cn(
                styles.figureValue,
                Number(figures.cashAndBank) < 0 && styles.figureNegative,
              )}
            >
              {formatMoney(figures.cashAndBank, { currency: figures.baseCurrency, country })}
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Net profit</span>
            <span
              className={cn(
                styles.figureValue,
                Number(figures.netProfit) < 0 && styles.figureNegative,
              )}
            >
              {formatMoney(figures.netProfit, { currency: figures.baseCurrency, country })}
            </span>
          </div>
          {/*
            The line is normalised to its own range, so it shows direction of travel only — the
            figure beside it carries the amount. Nothing is drawn before two months exist, rather
            than a flat line implying a history that is not there.
          */}
          {figures.trend.length > 1 && (
            <Sparkline
              values={figures.trend.map((point) => Number(point.cashAndBank))}
              color={Number(figures.netProfit) < 0 ? 'var(--data-2)' : 'var(--data-1)'}
              label={`Cash and bank over ${figures.trend.length} months`}
            />
          )}
        </div>

        <div className={styles.cardTags}>
          {figures.financialYearLabel && (
            <span
              className={cn(
                styles.tag,
                figures.financialYearStatus === 'CLOSED' && styles.tagMuted,
              )}
            >
              FY {figures.financialYearLabel}
              {figures.financialYearStatus === 'CLOSED' && ' · closed'}
            </span>
          )}
          {figures.draftVoucherCount > 0 && (
            <button
              type="button"
              className={styles.tagAction}
              onClick={() => navigate(`/companies/${companyId}/vouchers`)}
            >
              {figures.draftVoucherCount} awaiting posting
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Companies</h1>
          <p className={styles.subtitle}>Every company gets its own chart of accounts and books.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> New company
        </Button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/*
        `loaded` rather than `companies !== null`: a failed request has no data either, and
        treating the two the same left the error message sitting above a spinner that never
        stopped.
      */}
      {!companiesLoaded ? (
        <Loading label="Loading companies…" />
      ) : companiesError ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Could not load companies"
          description={companiesError}
          action={
            <Button type="button" variant="ghost" onClick={() => void loadCompanies(true)}>
              Try again
            </Button>
          }
        />
      ) : !companies || companies.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No companies yet"
          description="Create your first company to auto-generate its chart of accounts, ledgers, and voucher types."
        />
      ) : (
        <>
          {groupStats.length > 0 && (
            <div className={styles.totals}>
              {groupStats.map((stat) => (
                <div key={stat.key} className={styles.stat}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={cn(styles.statValue, stat.negative && styles.figureNegative)}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {figuresError && (
            <p className={styles.notice} role="status">
              {figuresError}. The companies below are listed without their balances.
            </p>
          )}

          <div className={styles.grid}>
            {companies.map((company) => (
              <div key={company.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardCode}>{company.code}</span>
                  <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
                </div>
                <p className={styles.cardName}>{company.name}</p>
                <p className={styles.cardMeta}>
                  {/*
                    Three companies of two different kinds sit in this list. Without the type they
                    are told apart only by a code someone has to remember the meaning of.
                  */}
                  {COMPANY_TYPE_LABELS[company.type] ?? company.type} · {company.baseCurrency} ·{' '}
                  {company.country}
                </p>

                {renderFigures(figuresById.get(company.id), company.id, company.country)}

                <div className={styles.cardFooter}>
                  {/*
                    A real link, and — through .cardLink::after — one whose hit area is the whole
                    card. The 52x16px of text on its own was the only way into a company, so a
                    click anywhere else on the card selected text and read as an unresponsive card.
                  */}
                  <Link
                    to={`/companies/${company.id}`}
                    className={styles.cardLink}
                    aria-label={`Open ${company.name}`}
                  >
                    Open <ArrowRight size={14} />
                  </Link>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Edit company"
                      onClick={() => setEditingCompany(company)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={
                        company.status === 'ACTIVE' ? 'Deactivate company' : 'Activate company'
                      }
                      disabled={togglingId === company.id}
                      onClick={() => handleToggleStatus(company)}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New company">
        <CreateCompanyForm onCreated={handleCreated} onCancel={() => setCreateModalOpen(false)} />
      </Modal>

      <Modal
        open={editingCompany !== null}
        onClose={() => setEditingCompany(null)}
        title="Edit company"
      >
        {editingCompany && (
          <EditCompanyForm
            company={editingCompany}
            onSaved={handleEdited}
            onCancel={() => setEditingCompany(null)}
          />
        )}
      </Modal>
    </div>
  );
}
