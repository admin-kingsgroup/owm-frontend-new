import type { LedgerStatementReport } from '@/entities/report';

import { LedgerStatement } from './LedgerStatement';
import styles from './ReportsPage.module.css';

interface CashBankBookViewProps {
  /** Every cash or bank account's statement, one after another. Null while it is still loading. */
  books: LedgerStatementReport[] | null;
  /** Which of the two this is, for the sentence shown when the company keeps none. */
  kind: 'cash' | 'bank';
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * Tally's Cash Book and Bank Book: not one statement but every account of that kind, in a row.
 *
 * One component for both because they differ only in which accounts they gather — and a second
 * copy would be the place the two quietly grow apart.
 */
export function CashBankBookView({ books, kind, money }: CashBankBookViewProps) {
  return (
    <section className={styles.panel}>
      {books?.length === 0 ? (
        <p className={styles.empty}>This company has no {kind} account yet.</p>
      ) : (
        books?.map((entry) => (
          <LedgerStatement key={entry.ledger.id} statement={entry} money={money} heading />
        ))
      )}
    </section>
  );
}
