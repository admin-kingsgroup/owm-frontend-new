import { useEffect, useState } from 'react';

import {
  getPendingDefaultMasters,
  syncDefaultMasters,
  updateCompany,
} from '@/entities/company';
import type {
  Company,
  CompanyFeatures,
  PendingMasters,
  SeedResult,
} from '@/entities/company';
import { Button, Checkbox } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CompanySettingsPanel.module.css';

export interface CompanySettingsPanelProps {
  company: Company;
  onChanged: (company: Company) => void;
  /**
   * A sync inserted masters. The account groups, ledgers, voucher types and number series it
   * created are the same lists the panels beside this one are showing, and they were read once
   * when the screen opened — so without this the panel reports "added 3 account groups" and the
   * chart of accounts one tab away still shows the chart from before.
   */
  onMastersSynced: () => void;
}

/**
 * Tally's F11. Each switch changes what the software will accept, not just what it shows — so the
 * hints say what turning it on actually lets you do, rather than restating the name.
 */
type FeatureKey = keyof CompanyFeatures;

/**
 * `available` may depend on the company, not just on whether we built the feature — GST is Indian
 * law, so it is offered to Indian companies and to nobody else. The server enforces the same rule;
 * this is here so the switch explains itself rather than failing on save.
 */
/*
  Three switches used to sit here that are gone from the company entirely: cost centres and
  inventory, which nothing read, and GST — OWM does no taxation, so a tax switch was offering a
  competence the product does not have. A field in the API that nothing reads is the same lie one
  layer down from a switch that does nothing.
*/
const FEATURES: Array<{
  key: FeatureKey;
  label: string;
  hint: string;
  available: (company: Company) => boolean;
  unavailableHint?: (company: Company) => string;
}> = [
  {
    key: 'billWiseDetails',
    label: 'Maintain balances bill by bill',
    hint: 'Track what each customer and supplier owes per invoice, with ageing. Also required before exchange gain or loss can be worked out on settlement.',
    available: () => true,
  },
  {
    key: 'multiCurrency',
    label: 'Multi-currency',
    hint: 'Record vouchers in other currencies at a dated exchange rate. Reports still total in the base currency.',
    available: () => true,
  },
];

/**
 * A set of master counts, in words — "3 account groups, 2 voucher types and 2 number series".
 *
 * Written once because it is said twice, of the same numbers: before, as what is waiting, and
 * after, as what was inserted. Two spellings of one list would eventually disagree about the very
 * thing a reader is checking. `null` when every count is zero, which the two callers word for
 * themselves — "nothing waiting" and "nothing added" are different sentences.
 */
function wordCounts(counts: PendingMasters): string | null {
  const parts = [
    { count: counts.accountGroups, one: 'account group', many: 'account groups' },
    { count: counts.ledgers, one: 'ledger', many: 'ledgers' },
    { count: counts.voucherTypes, one: 'voucher type', many: 'voucher types' },
    { count: counts.numberSeries, one: 'number series', many: 'number series' },
  ]
    .filter((row) => row.count > 0)
    .map((row) => `${row.count} ${row.count === 1 ? row.one : row.many}`);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * What a sync inserted, in words.
 *
 * Counted from the server's own answer rather than assumed, because what a company is missing
 * depends on when it was created and what kind of books it keeps — two companies syncing on the
 * same day can receive different things, and a fixed sentence would be wrong for one of them.
 */
function describeSync(result: SeedResult): string {
  const list = wordCounts(result);
  return list === null
    ? `Nothing to add — this company is already on version ${result.seedVersion}.`
    : `Added ${list}. Now on version ${result.seedVersion}.`;
}

export function CompanySettingsPanel({
  company,
  onChanged,
  onMastersSynced,
}: CompanySettingsPanelProps) {
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  /*
    What the product is on, when the server said. It always does — but a page held open across a
    deploy, or a new bundle reaching a browser before the API answers from the new release, can
    have a company record from before the field existed. Read defensively so the screen can decline
    to claim anything rather than announce "up to date" against a number it never received.
  */
  const current =
    typeof company.currentSeedVersion === 'number' ? company.currentSeedVersion : null;

  /*
    Whether this company's stamp is older than the product's. Necessary for there to be anything to
    do, and not sufficient: a row carries the kind of company it belongs to as well as the version
    it arrived in, so a trading book created before a release of personal-only rows is behind by
    the number and missing nothing at all.
  */
  const behindByVersion = current !== null && company.seedVersion < current;

  /**
   * What a sync would actually insert, and which company that was asked about.
   *
   * Tagged rather than cleared when the company changes: this panel is not remounted by a switch,
   * and clearing would mean writing state from inside the effect, which is a cascading render for
   * something a comparison answers. An answer for a company no longer open is simply not read.
   */
  const [answered, setAnswered] = useState<{ companyId: string; counts: PendingMasters } | null>(
    null,
  );
  /* And which company the read failed for. Then the version is all there is to go on, which is
     where this screen was before it asked — offer the control rather than hide a needed one. */
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!behindByVersion) return;
    const id = company.id;
    let cancelled = false;

    getPendingDefaultMasters(id)
      .then((counts) => {
        if (!cancelled) setAnswered({ companyId: id, counts });
      })
      .catch(() => {
        if (!cancelled) setFailedFor(id);
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, behindByVersion]);

  const pending = answered?.companyId === company.id ? answered.counts : null;
  const pendingUnknown = failedFor === company.id;
  const waiting = pending === null ? null : wordCounts(pending);

  /*
    Offer the control only when pressing it would do something. A Sync whose whole outcome is
    "nothing to add" is a dead end, and the screen can find that out first.
  */
  const behind = behindByVersion && (pendingUnknown || waiting !== null);

  async function toggle(key: FeatureKey, value: boolean) {
    setSaving(key);
    setError(null);
    /* It described the last sync, not this switch, and left standing it reads as its result. */
    setSyncResult(null);
    try {
      onChanged(await updateCompany(company.id, { features: { [key]: value } }));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update this setting'));
    } finally {
      setSaving(null);
    }
  }

  /**
   * Brings this company up to the current default master set.
   *
   * The version it lands on comes back from the server, and is published to the shared company
   * record — which is what makes the new voucher types reach the Transactions menu and the button
   * bar without a reload. See useVoucherTypes, which re-reads when that version moves.
   */
  async function sync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await syncDefaultMasters(company.id);
      setSyncResult(describeSync(result));
      /*
        Seeding touches nothing else on the company record, so the version is patched in rather
        than the whole company read back — one round trip instead of two for one number.
      */
      if (result.seedVersion !== company.seedVersion) {
        onChanged({ ...company, seedVersion: result.seedVersion });
      }

      /*
        Only when something was actually inserted. A no-op sync has nothing for the other panels to
        re-read, and re-reading five master lists to show the same rows back is a cost for nothing.
      */
      if (result.accountGroups + result.ledgers + result.voucherTypes + result.numberSeries > 0) {
        onMastersSynced();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sync the default masters'));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div>
        <h2 className={styles.title}>Features</h2>
        <p className={styles.hint}>
          Everything starts off. Switch on only what this company needs — a feature left off keeps
          its fields out of the way entirely.
        </p>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.list}>
        {FEATURES.map((feature) => {
          const available = feature.available(company);

          return (
            <Checkbox
              key={feature.key}
              id={`feature-${feature.key}`}
              label={feature.label}
              hint={available ? feature.hint : (feature.unavailableHint?.(company) ?? feature.hint)}
              checked={company.features[feature.key]}
              disabled={!available || saving !== null}
              onChange={(event) => toggle(feature.key, event.target.checked)}
            />
          );
        })}
      </div>

      <dl className={styles.meta}>
        <div>
          <dt>Base currency</dt>
          <dd>{company.baseCurrency}</dd>
        </div>
        <div>
          <dt>Default masters</dt>
          <dd className={styles.masters}>
            {/*
              Both numbers when they differ, because one of them alone says nothing: "version 3" is
              only worth reading against what the product is on. Equal, the second would be noise —
              a company that is current says so in words instead.
            */}
            {/* Bare when there is nothing to read it against — see `current`. Saying "up to date"
                there would be the screen asserting something it has not been told. Both numbers
                whenever the stamp is older, and coloured only when something is actually waiting:
                amber is a prompt to act, and there is nothing to act on otherwise. */}
            {current === null ? (
              <span>version {company.seedVersion}</span>
            ) : behindByVersion ? (
              <span className={behind ? styles.behind : undefined}>
                version {company.seedVersion} of {current}
              </span>
            ) : (
              <span>version {company.seedVersion} · up to date</span>
            )}
            {/*
              Offered only when there is something to receive. Standing there on a current company
              it was a control whose whole answer was "nothing to add" — a question the screen can
              settle without anybody pressing anything.
            */}
            {behind && (
              <Button type="button" variant="secondary" onClick={sync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync'}
              </Button>
            )}
          </dd>
        </div>
      </dl>
      {/*
        Each note under the row it explains, in the order the row states them. Putting the sync
        paragraph first pushed the base-currency note three blocks below the words "Base currency",
        which is far enough that it reads as a note about the sync.
      */}
      <p className={styles.hint}>
        The base currency is fixed when the company is created — every report totals in it, and
        vouchers already posted are denominated in it.
      </p>
      {/*
        Said plainly, because "sync" is the one word here that could be read as two-way. It is not:
        the server only ever inserts. Shown only alongside the control it explains.
      */}
      {/*
        Its own line, in the ordinary ink. Named rather than implied — "something is waiting" is a
        reason to press a button, "3 account groups and 2 voucher types" is a reason and a
        description of the result — and it was the opening clause of five lines of grey, which is
        where a reader stops reading. The paragraph below explains the control; this is the fact.
      */}
      {behind && waiting !== null && (
        <p className={styles.waiting}>Waiting for this company: {waiting}.</p>
      )}
      {behind && (
        <p className={styles.hint}>
          Syncing gives this company the default account groups, ledgers and voucher types added to
          the product since it was created — a personal book created before Income and Expense
          existed, for instance. It only ever adds: anything renamed, edited or switched off here is
          left exactly as it is, and syncing twice adds nothing the second time.
        </p>
      )}
      {/* Behind by the number with nothing to receive. Said, rather than left as a bare "3 of 4"
          with no control and no reason — which reads as something the screen forgot to offer. */}
      {behindByVersion && !behind && waiting === null && pending !== null && (
        <p className={styles.hint}>
          Nothing in version {current} applies to this kind of books, so there is nothing to add.
        </p>
      )}
      {syncResult && (
        <p className={styles.result} role="status">
          {syncResult}
        </p>
      )}

      {/*
        Company status is deliberately not shown or changed here. Retiring a set of books is not a
        thing to do from a settings panel, and once it is not offered, neither is the way back —
        a lone "Reactivate" button describes a state this screen can no longer produce. Status
        remains an API concern; the company switcher is where a deactivated company is identified.
      */}
    </div>
  );
}
