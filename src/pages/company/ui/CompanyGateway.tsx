import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Company } from '@/entities/company';
import { getBalanceSheet } from '@/entities/report';
import type { BalanceSheetReport } from '@/entities/report';
import { getOpeningBalanceSummary } from '@/entities/ledger';
import type { OpeningBalanceSummary } from '@/entities/ledger';
import { listVouchers } from '@/entities/voucher';
import type { VoucherType } from '@/entities/voucher-type';
import { formatMoney, formatCalendarDay, getErrorMessage } from '@/shared/lib';

import styles from './CompanyGateway.module.css';

interface CompanyGatewayProps {
  company: Company;
  voucherTypes: VoucherType[];
}

/**
 * The gateway: what this company holds, what it is waiting on, and every way into it.
 *
 * Tally opens on a menu rather than on a dashboard, and the reason holds here — the first thing
 * wanted is almost always a destination, not a chart. So the left of the screen is the menu written
 * out, and the right is the two things worth knowing before choosing one: what the books say, and
 * what is unfinished.
 *
 * Every figure is read from the same reports the statements are drawn from, so nothing here can
 * disagree with the Balance Sheet a click away.
 */
export function CompanyGateway({ company, voucherTypes }: CompanyGatewayProps) {
  const base = `/companies/${company.id}`;

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [opening, setOpening] = useState<OpeningBalanceSummary | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = company.id;
    let cancelled = false;

    Promise.all([
      getBalanceSheet(id),
      getOpeningBalanceSummary(id),
      // Only the count is wanted; one row is enough to carry the total back.
      listVouchers(id, { status: 'DRAFT', page: 1, limit: 1 }),
    ])
      .then(([sheet, openingResult, draftPage]) => {
        if (cancelled) return;
        setBalanceSheet(sheet);
        setOpening(openingResult);
        setDrafts(draftPage.total);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not read this company’s position'));
      });

    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const money = (value: string) =>
    formatMoney(value, { currency: company.baseCurrency, country: company.country });

  /**
   * Assets less liabilities. Taken from the statement's own totals rather than by adding the rows
   * up here, so the gateway cannot drift from the balance sheet by a rounding step.
   */
  const netWorth = balanceSheet
    ? (Number(balanceSheet.totals.assets) - Number(balanceSheet.totals.liabilities)).toFixed(2)
    : null;

  const openingDifference = opening && Number(opening.difference) !== 0 ? opening.difference : null;
  const activeTypes = voucherTypes.filter((type) => type.isActive);

  const attention = [
    drafts && drafts > 0
      ? {
          key: 'drafts',
          label: `${drafts} draft ${drafts === 1 ? 'voucher' : 'vouchers'} awaiting post`,
          to: `${base}/vouchers?status=DRAFT`,
          tone: styles.warn,
        }
      : null,
    openingDifference
      ? {
          key: 'opening',
          label: `Opening balances differ by ${money(openingDifference)}`,
          to: `${base}?tab=accounts`,
          tone: styles.bad,
        }
      : null,
    balanceSheet && Number(balanceSheet.totals.difference) !== 0
      ? {
          key: 'difference',
          label: `Balance sheet out by ${money(balanceSheet.totals.difference)}`,
          to: `${base}/reports?report=trial-balance`,
          tone: styles.bad,
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <div className={styles.gateway}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gateway of OWM</h1>
        <p className={styles.hint}>
          Press the underlined letter in the menu bar, or a function key from the strip on the
          right.
        </p>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Masters</h2>
            <Link className={styles.item} to={`${base}?tab=accounts`}>
              <span>Groups &amp; ledgers — chart of accounts</span>
            </Link>
            <Link className={styles.item} to={`${base}?tab=voucher-types`}>
              <span>Voucher types &amp; numbering</span>
              <span className={styles.count}>{voucherTypes.length}</span>
            </Link>
            {company.features.multiCurrency && (
              <Link className={styles.item} to={`${base}?tab=currencies`}>
                <span>Currencies &amp; rates</span>
              </Link>
            )}
            <Link className={styles.item} to={`${base}?tab=financial-years`}>
              <span>Financial years</span>
            </Link>
            <Link className={styles.item} to={`${base}?tab=settings`}>
              <span>Features &amp; settings</span>
            </Link>
          </section>

          {activeTypes.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Transactions</h2>
              {activeTypes.map((type) => (
                <Link
                  className={styles.item}
                  key={type.id}
                  to={`${base}/vouchers?new=${type.code}`}
                >
                  <span>{type.name}</span>
                  <span className={styles.code}>{type.code}</span>
                </Link>
              ))}
              <Link className={styles.item} to={`${base}/vouchers`}>
                <span>All vouchers &amp; day book</span>
              </Link>
            </section>
          )}
        </div>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Balances
              {balanceSheet && (
                <span className={styles.asOn}>
                  as on {formatCalendarDay(balanceSheet.period.to, company.country)}
                </span>
              )}
            </h2>

            {!balanceSheet && !error && <p className={styles.pending}>Reading the books…</p>}

            {balanceSheet && (
              <table className={styles.figures}>
                <tbody>
                  {/* The statement's own top-level groups, in its own order — nothing named here,
                      so a company with a different chart of accounts still reads correctly. */}
                  {balanceSheet.assets.map((node) => (
                    <tr key={node.id}>
                      <td>{node.name}</td>
                      <td className={styles.amount}>{money(node.balance)}</td>
                    </tr>
                  ))}
                  {balanceSheet.liabilities.map((node) => (
                    <tr key={node.id}>
                      <td>{node.name}</td>
                      <td className={styles.amount}>{money(node.balance)}</td>
                    </tr>
                  ))}
                  {netWorth !== null && (
                    <tr className={styles.total}>
                      <td>Net worth</td>
                      <td className={styles.amount}>{money(netWorth)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Needs attention</h2>
            {attention.length === 0 ? (
              <p className={styles.clear}>
                {drafts === null ? 'Checking…' : 'Nothing outstanding — the books are square.'}
              </p>
            ) : (
              attention.map((item) => (
                <Link className={styles.item} key={item.key} to={item.to}>
                  <span className={item.tone}>{item.label}</span>
                </Link>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
