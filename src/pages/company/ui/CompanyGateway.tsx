import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Company } from '@/entities/company';
import { getBalanceSheet } from '@/entities/report';
import type { BalanceSheetReport } from '@/entities/report';
import type { VoucherType } from '@/entities/voucher-type';
import { formatMoney, formatCalendarDay, getErrorMessage } from '@/shared/lib';
import { useCompanyReadout } from '@/widgets/app-shell';

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
  const [error, setError] = useState<string | null>(null);

  /*
    The difference and the draft count come from the frame, which has already read them for the
    context strip. Asking again would be three more round trips for figures already on screen.
  */
  const { context } = useCompanyReadout();

  useEffect(() => {
    const id = company.id;
    let cancelled = false;

    getBalanceSheet(id)
      .then((sheet) => {
        if (!cancelled) setBalanceSheet(sheet);
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

  const activeTypes = voucherTypes.filter((type) => type.isActive);
  const drafts = context?.draftVouchers ?? null;

  /*
    Only what is genuinely outstanding, and each fault reported once. The opening-balance difference
    is deliberately not a separate line: every posted voucher balances, so the trial balance
    difference *is* the opening difference. Two lines would report one fault twice, and disagree the
    moment one of them was read at a different time.
  */
  const attention = [
    drafts && drafts > 0
      ? {
          key: 'drafts',
          label: `${drafts} draft ${drafts === 1 ? 'voucher' : 'vouchers'} awaiting post`,
          to: `${base}/vouchers?status=DRAFT`,
          tone: styles.warn,
        }
      : null,
    context && Number(context.difference) !== 0
      ? {
          key: 'difference',
          label: `Books out by ${money(context.difference)} — debits do not equal credits`,
          to: `${base}/reports?report=trial-balance`,
          tone: styles.bad,
        }
      : null,
    context?.period.financialYearStatus === 'CLOSED'
      ? {
          key: 'closed',
          label: `Financial year ${context.period.financialYearLabel} is closed to new vouchers`,
          to: `${base}?tab=financial-years`,
          tone: styles.warn,
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
                {/*
                  The statement's own top-level groups, in its own order and under its own two
                  headings — nothing is named here, so a company with a different chart of accounts
                  still reads correctly. Without the headings the two lists ran together and the
                  only thing separating a holding from a debt was the sign in front of it.

                  Each figure carries Dr or Cr, the way the statements themselves show it.
                */}
                {[
                  { heading: 'Assets', nodes: balanceSheet.assets },
                  { heading: 'Liabilities', nodes: balanceSheet.liabilities },
                ].map((section) => (
                  <tbody key={section.heading}>
                    <tr>
                      <th scope="colgroup" colSpan={2} className={styles.figuresHeading}>
                        {section.heading}
                      </th>
                    </tr>
                    {section.nodes.length === 0 ? (
                      <tr>
                        <td colSpan={2} className={styles.figuresEmpty}>
                          None
                        </td>
                      </tr>
                    ) : (
                      section.nodes.map((node) => (
                        <tr key={node.id} className={styles.figureRow}>
                          {/*
                            Every other figure in this product opens the working behind it, and
                            these were the exception — the one place a reader could see a number
                            they wanted to question and had to go and find the report themselves.

                            The link sits on the name rather than the amount: it is the reliable
                            place to click, it reads as a link, and it keeps the amount column
                            scanning as a column of figures. The row lights up so the whole line
                            still reads as the thing being opened.
                          */}
                          <td>
                            <Link
                              className={styles.figureLink}
                              to={
                                /*
                                  A row is usually a group and occasionally an account — the node
                                  says which, and the two are asked for by different parameters.
                                  Sending an account's id as a group's was the first version of
                                  this, and it would have opened a summary of nothing on any
                                  company whose chart puts an account at the top level.
                                */
                                node.kind === 'ledger'
                                  ? `${base}/reports?report=ledger&ledgerId=${node.id}`
                                  : `${base}/reports?report=monthly-summary&groupId=${node.id}`
                              }
                            >
                              {node.name}
                            </Link>
                          </td>
                          <td className={styles.amount}>
                            {money(node.balance)}{' '}
                            <span className={styles.side}>
                              {node.balanceSide === 'DEBIT' ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                ))}
                {netWorth !== null && (
                  <tfoot>
                    <tr className={styles.total}>
                      <th scope="row">Net worth</th>
                      <td className={styles.amount}>{money(netWorth)}</td>
                    </tr>
                  </tfoot>
                )}
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
