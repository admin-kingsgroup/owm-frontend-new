import { useEffect, useState } from 'react';
import { Lock, Upload } from 'lucide-react';

import { listAccountGroups } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import {
  getForecast,
  listMappings,
  listSnapshots,
  lockSnapshot,
  previewImport,
  runImport,
  saveMappings,
} from '@/entities/kg';
import type {
  Business,
  ForecastResult,
  ImportPreview,
  LedgerMapping,
  Partner,
  Snapshot,
} from '@/entities/kg';
import { Button, Input, Select, Textarea, Badge, EmptyState, Loading } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface BusinessWorkspaceProps {
  companyId: string;
  business: Business;
  partners: Partner[];
}

/** Only equity groups may carry a partner tag — the server enforces the same rule. */
const PARTNER_CAPITAL_GROUPS = ['CAPITAL', 'RESERVES_SURPLUS'];

const now = new Date();

/**
 * One business's month: paste the statement, place anything new, import, lock.
 *
 * The order is the point. **Preview writes nothing** and returns the ledgers with nowhere to go —
 * that list becomes the work queue right here, so placing them and importing is one sitting rather
 * than a round trip through another screen. The import stays blocked until the queue is empty,
 * because a row with nowhere to go must stop the import rather than vanish from a total.
 */
export function BusinessWorkspace({ companyId, business, partners }: BusinessWorkspaceProps) {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);

  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  /** Group chosen for each unmapped ledger, keyed by the name exactly as it arrived. */
  const [placements, setPlacements] = useState<Record<string, { group: string; partner: string }>>(
    {},
  );

  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [groupsResult, mappingsResult, snapshotsResult, forecastResult] = await Promise.all([
          listAccountGroups(companyId),
          listMappings(companyId, business.id),
          listSnapshots(companyId, business.id),
          getForecast(companyId, business.id),
        ]);
        if (cancelled) return;
        setGroups(groupsResult);
        setMappings(mappingsResult);
        setSnapshots(snapshotsResult);
        setForecasts(forecastResult);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this business'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, business.id]);

  async function refresh() {
    const [mappingsResult, snapshotsResult, forecastResult] = await Promise.all([
      listMappings(companyId, business.id),
      listSnapshots(companyId, business.id),
      getForecast(companyId, business.id),
    ]);
    setMappings(mappingsResult);
    setSnapshots(snapshotsResult);
    setForecasts(forecastResult);
  }

  async function handleFile(file: File) {
    setCsv(await file.text());
    setPreview(null);
    setNotice(null);
  }

  async function handlePreview() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await previewImport(companyId, business.id, csv);
      setPreview(result);
      // Default every unplaced ledger to nothing chosen, so nothing is filed by accident.
      setPlacements(
        Object.fromEntries(result.unmapped.map((name) => [name, { group: '', partner: '' }])),
      );
    } catch (err) {
      setPreview(null);
      setError(getErrorMessage(err, 'Could not read that file'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePlacements() {
    const rows = Object.entries(placements)
      .filter(([, choice]) => choice.group)
      .map(([ledgerName, choice]) => ({
        ledgerName,
        accountGroupCode: choice.group,
        ...(choice.partner ? { partnerId: choice.partner } : {}),
      }));

    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await saveMappings(companyId, business.id, rows);
      await refresh();
      // Re-read the file so the unmapped list reflects what was just placed.
      setPreview(await previewImport(companyId, business.id, csv));
      setNotice(`Placed ${rows.length} ledger${rows.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save those placements'));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const result = await runImport(companyId, business.id, csv, year, month);
      await refresh();
      setPreview(null);
      setCsv('');
      setNotice(
        `Imported as revision ${result.snapshot.revision}. It is a draft until you lock it.`,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not import that statement'));
    } finally {
      setBusy(false);
    }
  }

  async function handleLock(snapshot: Snapshot) {
    setBusy(true);
    setError(null);
    try {
      await lockSnapshot(companyId, business.id, snapshot.id);
      await refresh();
      setNotice('Locked. Its figures are now final and appear in the portfolio.');
    } catch (err) {
      // The tie-out and the missing-rate check both refuse here, and both say exactly what is wrong.
      setError(getErrorMessage(err, 'Could not lock that snapshot'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label={`Loading ${business.name}…`} />;

  const readyToImport = preview !== null && preview.unmapped.length === 0;

  return (
    <div className={styles.workspace}>
      <h3 className={styles.sectionTitle}>{business.name} — import a month</h3>

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.inlineForm}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
          aria-label="Choose a CSV statement"
        />
        <Button variant="secondary" onClick={handlePreview} disabled={!csv || busy}>
          <Upload size={14} /> Check the file
        </Button>
      </div>

      <Textarea
        rows={5}
        placeholder="…or paste the statement here"
        value={csv}
        onChange={(event) => {
          setCsv(event.target.value);
          setPreview(null);
        }}
      />

      {preview && (
        <>
          <p className={styles.hint}>
            Read {preview.rows.length} ledger{preview.rows.length === 1 ? '' : 's'}.
            {preview.skipped.length > 0 &&
              ` Skipped ${preview.skipped.length}: ${preview.skipped
                .map((row) => `${row.text} (${row.reason})`)
                .join('; ')}.`}
          </p>

          {preview.unmapped.length > 0 && (
            <div className={styles.placements}>
              <p className={styles.warn}>
                {preview.unmapped.length} ledger
                {preview.unmapped.length === 1 ? ' has' : 's have'} nowhere to go. Place them below —
                the import stays blocked until then, because a row with no home would otherwise
                vanish from every total.
              </p>

              {preview.unmapped.map((name) => {
                const choice = placements[name] ?? { group: '', partner: '' };
                const isEquity = PARTNER_CAPITAL_GROUPS.includes(choice.group);

                return (
                  <div key={name} className={styles.placementRow}>
                    <span className={styles.placementName}>{name}</span>
                    <Select
                      value={choice.group}
                      onChange={(event) =>
                        setPlacements({
                          ...placements,
                          // Changing away from equity drops any partner chosen, since the server
                          // only accepts a partner tag on a capital ledger.
                          [name]: {
                            group: event.target.value,
                            partner: PARTNER_CAPITAL_GROUPS.includes(event.target.value)
                              ? choice.partner
                              : '',
                          },
                        })
                      }
                      aria-label={`Group for ${name}`}
                    >
                      <option value="">Choose a group…</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.code}>
                          {group.name}
                        </option>
                      ))}
                    </Select>

                    {isEquity && business.partners.length > 0 && (
                      <Select
                        value={choice.partner}
                        onChange={(event) =>
                          setPlacements({
                            ...placements,
                            [name]: { ...choice, partner: event.target.value },
                          })
                        }
                        aria-label={`Partner for ${name}`}
                      >
                        <option value="">Whole business</option>
                        {business.partners.map((share) => (
                          <option key={share.partnerId} value={share.partnerId}>
                            {share.partnerName}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                );
              })}

              <Button variant="secondary" onClick={handleSavePlacements} disabled={busy}>
                Save placements
              </Button>
            </div>
          )}

          {readyToImport && (
            <div className={styles.inlineForm}>
              <Input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                aria-label="Year"
              />
              <Select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                aria-label="Month"
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Date(Date.UTC(2000, index, 1)).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </Select>
              <Button variant="primary" onClick={handleImport} disabled={busy}>
                Import this month
              </Button>
            </div>
          )}
        </>
      )}

      <h3 className={styles.sectionTitle}>
        Ledgers already placed{mappings.length > 0 ? ` (${mappings.length})` : ''}
      </h3>
      {mappings.length === 0 ? (
        <p className={styles.hint}>
          None yet. Placing a ledger is a one-time job per business — every later month matches on
          the name, so only genuinely new accounts ever need a decision again.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ledger</th>
              <th>Group</th>
              <th>Partner</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>{mapping.ledgerName}</td>
                <td className={styles.mono}>
                  {groups.find((group) => group.code === mapping.accountGroupCode)?.name ??
                    mapping.accountGroupCode}
                </td>
                <td>
                  {mapping.partnerId ? (
                    <Badge variant="neutral">
                      {business.partners.find((share) => share.partnerId === mapping.partnerId)
                        ?.partnerName ?? 'Unknown'}
                    </Badge>
                  ) : (
                    <span className={styles.hint}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className={styles.sectionTitle}>Months reported</h3>
      {snapshots.length === 0 ? (
        <EmptyState
          title="Nothing imported yet"
          description="Import a statement above. It arrives as a draft, and locking it is what makes its figures final."
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Period</th>
              <th>Rev</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Turnover</th>
              <th>Net profit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td className={styles.mono}>
                  {snapshot.periodYear}-{String(snapshot.periodMonth).padStart(2, '0')}
                </td>
                <td className={styles.mono}>{snapshot.revision}</td>
                <td>
                  <Badge variant={snapshot.status === 'LOCKED' ? 'success' : 'neutral'}>
                    {snapshot.status}
                  </Badge>
                </td>
                <td className={styles.mono}>{snapshot.rowCount}</td>
                <td className={styles.mono}>{snapshot.metrics?.turnover ?? '—'}</td>
                <td className={styles.mono}>{snapshot.metrics?.netProfit ?? '—'}</td>
                <td>
                  {snapshot.status === 'DRAFT' && (
                    <Button variant="secondary" onClick={() => handleLock(snapshot)} disabled={busy}>
                      <Lock size={13} /> Lock
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className={styles.sectionTitle}>Where it is heading</h3>
      {forecasts.map((result) => (
        <div key={result.metric} className={styles.forecast}>
          <strong className={styles.forecastTitle}>
            {result.metric === 'turnover' ? 'Turnover' : 'Net profit'}
          </strong>
          {result.refusedBecause ? (
            // Shown as written: refusing and saying why is more use than a line through three points.
            <p className={styles.hint}>{result.refusedBecause}</p>
          ) : (
            <p className={styles.hint}>
              From {result.basedOnMonths} months:{' '}
              {result.points
                .map(
                  (point) =>
                    `${point.periodYear}-${String(point.periodMonth).padStart(2, '0')} ` +
                    `${point.value} (${point.low} to ${point.high})`,
                )
                .join(' · ')}
            </p>
          )}
        </div>
      ))}

      {partners.length === 0 && business.partners.length === 0 && (
        <p className={styles.hint}>This business is wholly owned, so no partner split applies.</p>
      )}
    </div>
  );
}
