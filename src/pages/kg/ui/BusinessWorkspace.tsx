import { useEffect, useState } from 'react';
import { Check, Lock, Upload } from 'lucide-react';

import { listAccountGroups } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import {
  getForecast,
  getTrajectory,
  listMappings,
  periodLabel,
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
  TrajectoryPoint,
} from '@/entities/kg';
import {
  Button,
  ChartLegend,
  Input,
  LineChart,
  Select,
  Textarea,
  Badge,
  EmptyState,
  PageSkeleton,
  Table,
} from '@/shared/ui';
import { cn, formatCompactMoney, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface BusinessWorkspaceProps {
  companyId: string;
  business: Business;
  partners: Partner[];
  /** The portfolio's country and currency: the forecast is in the portfolio's money. */
  country: string;
  portfolioCurrency: string;
  /** Called after an import or a lock, so the screen around this can redraw its month grid. */
  onSnapshotsChanged?: () => void;
}

const STEPS = ['Choose the statement', 'Place ledgers', 'Import the month', 'Lock'] as const;

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
export function BusinessWorkspace({
  companyId,
  business,
  partners,
  country,
  portfolioCurrency,
  onSnapshotsChanged,
}: BusinessWorkspaceProps) {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [mappings, setMappings] = useState<LedgerMapping[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
  const [metric, setMetric] = useState<'netProfit' | 'turnover'>('netProfit');

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
        const [groupsResult, mappingsResult, snapshotsResult, forecastResult, trajectoryResult] =
          await Promise.all([
            listAccountGroups(companyId),
            listMappings(companyId, business.id),
            listSnapshots(companyId, business.id),
            getForecast(companyId, business.id),
            getTrajectory(companyId, business.id),
          ]);
        if (cancelled) return;
        setGroups(groupsResult);
        setMappings(mappingsResult);
        setSnapshots(snapshotsResult);
        setForecasts(forecastResult);
        setTrajectory(trajectoryResult);
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
    const [mappingsResult, snapshotsResult, forecastResult, trajectoryResult] = await Promise.all([
      listMappings(companyId, business.id),
      listSnapshots(companyId, business.id),
      getForecast(companyId, business.id),
      getTrajectory(companyId, business.id),
    ]);
    setMappings(mappingsResult);
    setSnapshots(snapshotsResult);
    setForecasts(forecastResult);
    setTrajectory(trajectoryResult);
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
      onSnapshotsChanged?.();
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
      onSnapshotsChanged?.();
      setNotice('Locked. Its figures are now final and appear in the portfolio.');
    } catch (err) {
      // The tie-out and the missing-rate check both refuse here, and both say exactly what is wrong.
      setError(getErrorMessage(err, 'Could not lock that snapshot'));
    } finally {
      setBusy(false);
    }
  }

  /*
    Held in one place because it is rendered twice — while the month is loading and once it has.
    A spinner that replaces the whole panel takes the name of the business being loaded with it,
    which on a screen that shows one business at a time leaves nothing saying which one.
  */
  const title = <h3 className={styles.sectionTitle}>{business.name} — import a month</h3>;

  if (loading)
    return (
      <div className={styles.workspace}>
        {title}
        <PageSkeleton variant="rows" label={`Loading ${business.name}…`} />
      </div>
    );

  const readyToImport = preview !== null && preview.unmapped.length === 0;

  /*
    Where this month has got to, read off the state rather than kept beside it: a draft waiting is
    the last step whatever else is on screen, then a clean file, then one with ledgers to place.
  */
  const step = snapshots.some((snapshot) => snapshot.status === 'DRAFT')
    ? 4
    : readyToImport
      ? 3
      : preview
        ? 2
        : 1;

  const money = (value: string | number, currency = business.reportingCurrency) =>
    formatMoney(value, { country, currency });
  const locale = localeFor(country);

  return (
    <div className={styles.workspace}>
      {title}

      <ol className={styles.stepper} aria-label="Month-end steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(i + 1 < step && styles.stepDone, i + 1 === step && styles.stepNow)}
            aria-current={i + 1 === step ? 'step' : undefined}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {i + 1 < step ? <Check size={12} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

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
                {preview.unmapped.length === 1 ? ' has' : 's have'} nowhere to go. Place them below
                — the import stays blocked until then, because a row with no home would otherwise
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
        <Table surface="plain" stack>
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
        </Table>
      )}

      <h3 className={styles.sectionTitle}>Months reported</h3>
      {snapshots.length === 0 ? (
        <EmptyState
          title="Nothing imported yet"
          description="Import a statement above. It arrives as a draft, and locking it is what makes its figures final."
        />
      ) : (
        <Table surface="plain" stack>
          <thead>
            <tr>
              <th>Period</th>
              <th>Rev</th>
              <th>Status</th>
              <th data-num>Rows</th>
              <th data-num>Turnover · {business.reportingCurrency}</th>
              <th data-num>Net profit · {business.reportingCurrency}</th>
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
                  <Badge variant={snapshot.status === 'LOCKED' ? 'success' : 'warning'}>
                    {snapshot.status === 'LOCKED' ? 'Locked' : 'Draft'}
                  </Badge>
                </td>
                <td data-num>{snapshot.rowCount}</td>
                <td data-num>{snapshot.metrics ? money(snapshot.metrics.turnover) : '—'}</td>
                <td data-num>{snapshot.metrics ? money(snapshot.metrics.netProfit) : '—'}</td>
                <td>
                  {snapshot.status === 'DRAFT' && (
                    <Button
                      variant="secondary"
                      onClick={() => handleLock(snapshot)}
                      disabled={busy}
                    >
                      <Lock size={13} /> Lock
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ForecastChart
        forecasts={forecasts}
        trajectory={trajectory}
        metric={metric}
        onMetric={setMetric}
        money={(value) => money(value, portfolioCurrency)}
        axis={(value) => formatCompactMoney(value, { country, currency: portfolioCurrency })}
        label={(y, m) => periodLabel(y, m, locale, 'month')}
        title={(y, m) => `${periodLabel(y, m, locale, 'long')} ${y}`}
        currency={portfolioCurrency}
      />

      {partners.length === 0 && business.partners.length === 0 && (
        <p className={styles.hint}>This business is wholly owned, so no partner split applies.</p>
      )}
    </div>
  );
}

interface ForecastChartProps {
  forecasts: ForecastResult[];
  trajectory: TrajectoryPoint[];
  metric: 'netProfit' | 'turnover';
  onMetric: (metric: 'netProfit' | 'turnover') => void;
  money: (value: number) => string;
  axis: (value: number) => string;
  label: (year: number, month: number) => string;
  title: (year: number, month: number) => string;
  currency: string;
}

const MEASURES = [
  ['netProfit', 'Net profit'],
  ['turnover', 'Turnover'],
] as const;

/**
 * Where the business is heading: its locked months as a line, the projection carried on from the
 * last of them as a dashed one, and the likely range around it shaded.
 *
 * When the server declined to forecast it says why, and that is shown as written — refusing and
 * saying so is more use than a confident line drawn through three points.
 */
function ForecastChart({
  forecasts,
  trajectory,
  metric,
  onMetric,
  money,
  axis,
  label,
  title,
  currency,
}: ForecastChartProps) {
  const result = forecasts.find((entry) => entry.metric === metric);
  const actual = trajectory.map((point) => Number(point[metric]));
  const ahead = result && !result.refusedBecause && actual.length > 0 ? result.points : [];
  const last = actual.length - 1;

  const labels = [
    ...trajectory.map((p) => label(p.periodYear, p.periodMonth)),
    ...ahead.map((p) => label(p.periodYear, p.periodMonth)),
  ];
  const titles = [
    ...trajectory.map((p) => title(p.periodYear, p.periodMonth)),
    ...ahead.map((p) => `${title(p.periodYear, p.periodMonth)} · forecast`),
  ];
  // The projection starts at the last real month, so the dashed line leaves the solid one.
  const before: null[] = Array.from({ length: Math.max(0, last) }, () => null);
  const actualSeries: Array<number | null> = [...actual, ...ahead.map(() => null)];
  const forecastSeries = [...before, actual[last], ...ahead.map((p) => Number(p.value))];
  const low = [...before, actual[last], ...ahead.map((p) => Number(p.low))];
  const high = [...before, actual[last], ...ahead.map((p) => Number(p.high))];
  const name = metric === 'netProfit' ? 'Net profit' : 'Turnover';

  return (
    <section className={styles.forecastCard}>
      <div className={styles.forecastHead}>
        <h3 className={styles.sectionTitle}>Where it is heading</h3>
        <span className={styles.hint}>
          {result && !result.refusedBecause
            ? `From ${result.basedOnMonths} locked months, in ${currency}`
            : `In ${currency}`}
        </span>
        <div className={styles.segmented} role="group" aria-label="Measure">
          {MEASURES.map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={metric === id}
              className={cn(metric === id && styles.segmentOn)}
              onClick={() => onMetric(id)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {result?.refusedBecause && <p className={styles.hint}>{result.refusedBecause}</p>}

      {actual.length > 1 || ahead.length > 0 ? (
        <>
          <LineChart
            area
            labels={labels}
            tooltipLabels={titles}
            series={[
              { label: name, color: 'var(--series-1)', values: actualSeries },
              ...(ahead.length > 0
                ? [
                    {
                      label: 'Forecast',
                      color: 'var(--series-1)',
                      values: forecastSeries,
                      dashed: true,
                    },
                  ]
                : []),
            ]}
            band={
              ahead.length > 0
                ? { low, high, color: 'var(--series-1)', label: 'Likely range' }
                : undefined
            }
            marker={ahead.length > 0 ? { index: last, label: 'Forecast' } : undefined}
            formatValue={money}
            formatAxis={axis}
            height={220}
            caption={`${name} for each locked month, with the forecast after it`}
          />
          <ChartLegend
            items={[
              { label: 'Actual', color: 'var(--series-1)', line: true },
              ...(ahead.length > 0
                ? [
                    {
                      label: 'Forecast, shaded by its likely range',
                      color: 'var(--series-1)',
                      line: true,
                      dashed: true,
                    },
                  ]
                : []),
            ]}
          />
        </>
      ) : (
        !result?.refusedBecause && (
          <p className={styles.hint}>Lock two months or more and the trend is drawn here.</p>
        )
      )}
    </section>
  );
}
