import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

import type { StatementWorkspace } from '@/entities/bank-statement';
import type { BankReconciliationReport } from '@/entities/report';
import {
  ReconciliationBoard,
  UploadStatementDialog,
  type LedgerOption,
  type SavedColumnMap,
} from '@/features/bank-statement';
import { Button, toast } from '@/shared/ui';

interface BankStatementSectionProps {
  companyId: string;
  ledgerId: string;
  ledgerName: string;
  /** Every ledger a voucher raised from the statement could post its other side to. */
  ledgers: LedgerOption[];
  /** The books' figures for the period, for the balances and the bridge between them. */
  report: BankReconciliationReport;
  money: (value: string) => string;
  day: (value: string) => string;
  /** Reads the reconciliation report again, after the books' marks have moved. */
  onBooksChanged: () => void;
}

/**
 * The statement upload and the reconciliation board, where the books and the bank face each other.
 *
 * Composed here rather than inside either feature, because they are two separate actions — reading
 * a file, and settling its lines — that meet only on this screen.
 */
export function BankStatementSection({
  companyId,
  ledgerId,
  ledgerName,
  ledgers,
  report,
  money,
  day,
  onBooksChanged,
}: BankStatementSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savedMap, setSavedMap] = useState<SavedColumnMap | null>(null);

  const remember = useCallback((workspace: StatementWorkspace) => {
    // Stored as the server was handed it; read back only if it still has the shape it was saved in.
    const saved = workspace.lastColumnMap;
    const usable =
      saved &&
      Array.isArray(saved.headers) &&
      Array.isArray(saved.roles) &&
      typeof saved.dateOrder === 'string';
    setSavedMap(usable ? (saved as unknown as SavedColumnMap) : null);
  }, []);

  return (
    <>
      <ReconciliationBoard
        companyId={companyId}
        ledgerId={ledgerId}
        ledgerName={ledgerName}
        ledgers={ledgers}
        report={report}
        money={money}
        day={day}
        refreshKey={refreshKey}
        onLoaded={remember}
        onBooksChanged={onBooksChanged}
        actions={
          <Button onClick={() => setUploading(true)}>
            <Upload size={16} aria-hidden /> Upload statement
          </Button>
        }
      />
      <UploadStatementDialog
        open={uploading}
        onClose={() => setUploading(false)}
        companyId={companyId}
        ledgerId={ledgerId}
        ledgerName={ledgerName}
        savedMap={savedMap}
        money={money}
        onUploaded={(result) => {
          toast.success(
            `${result.stored} line${result.stored === 1 ? '' : 's'} uploaded` +
              (result.duplicates ? `, ${result.duplicates} already there` : '') +
              ` · ${result.suggested} matched with the books, waiting to be confirmed`,
          );
          setRefreshKey((key) => key + 1);
        }}
      />
    </>
  );
}
