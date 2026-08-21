import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, ArrowRight, Pencil, Power } from 'lucide-react';

import { listCompanies, updateCompany, companyStatusVariant } from '@/entities/company';
import type { Company } from '@/entities/company';
import { getGroupOverview } from '@/entities/report';
import type { CompanyOverview, GroupOverview } from '@/entities/report';
import { CreateCompanyForm, EditCompanyForm } from '@/features/company';
import { Button, Modal, Loading, EmptyState, Badge } from '@/shared/ui';
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

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The figures failing is a degraded page, not a broken one — kept apart from `error`. */
  const [figuresError, setFiguresError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Settled rather than all: the company list is what the page needs in order to render at all,
    // and the figures enrich it. Either one failing must not take the other down with it.
    Promise.allSettled([listCompanies(), getGroupOverview()]).then(([list, figures]) => {
      if (cancelled) return;

      if (list.status === 'fulfilled') {
        setCompanies(list.value);
      } else {
        setError(getErrorMessage(list.reason, 'Could not load companies'));
      }

      if (figures.status === 'fulfilled') {
        setOverview(figures.value);
      } else {
        setFiguresError(
          getErrorMessage(figures.reason, 'Could not load figures for these companies'),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

    const multiCurrency = overview.totals.byCurrency.length > 1;
    const currencyStats = overview.totals.byCurrency.flatMap((total) => [
      {
        key: `${total.currency}-cash`,
        label: multiCurrency ? `Cash & bank · ${total.currency}` : 'Cash & bank',
        value: formatMoney(total.cashAndBank, { currency: total.currency }),
        negative: Number(total.cashAndBank) < 0,
      },
      {
        key: `${total.currency}-profit`,
        label: multiCurrency ? `Net profit · ${total.currency}` : 'Net profit',
        value: formatMoney(total.netProfit, { currency: total.currency }),
        negative: Number(total.netProfit) < 0,
      },
    ]);

    return [
      ...currencyStats,
      {
        key: 'drafts',
        label: 'Awaiting posting',
        value: String(overview.totals.draftVoucherCount),
        negative: false,
      },
      {
        key: 'years',
        label: 'Open years',
        value: `${overview.totals.openYearCount} of ${overview.totals.companyCount}`,
        negative: false,
      },
    ];
  }, [overview]);

  function handleCreated(company: Company) {
    setCreateModalOpen(false);
    navigate(`/companies/${company.id}`);
  }

  function handleEdited(company: Company) {
    setEditingCompany(null);
    setCompanies((current) => current?.map((c) => (c.id === company.id ? company : c)) ?? current);
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
      setCompanies(
        (current) => current?.map((c) => (c.id === updated.id ? updated : c)) ?? current,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update company status'));
    } finally {
      setTogglingId(null);
    }
  }

  function renderFigures(figures: CompanyOverview | undefined, companyId: string) {
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
              {formatMoney(figures.cashAndBank, { currency: figures.baseCurrency })}
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
              {formatMoney(figures.netProfit, { currency: figures.baseCurrency })}
            </span>
          </div>
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

      {!companies ? (
        <Loading label="Loading companies…" />
      ) : companies.length === 0 ? (
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

                {renderFigures(figuresById.get(company.id), company.id)}

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
