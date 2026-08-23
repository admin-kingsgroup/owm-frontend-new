import { useState } from 'react';

import { syncDefaultMasters, updateCompany } from '@/entities/company';
import type { Company, CompanyFeatures, SeedResult } from '@/entities/company';
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
 * What a sync inserted, in words.
 *
 * Counted from the server's own answer rather than assumed, because what a company is missing
 * depends on when it was created and what kind of books it keeps — two companies syncing on the
 * same day can receive different things, and a fixed sentence would be wrong for one of them.
 */
function describeSync(result: SeedResult): string {
  const added = [
    { count: result.accountGroups, one: 'account group', many: 'account groups' },
    { count: result.ledgers, one: 'ledger', many: 'ledgers' },
    { count: result.voucherTypes, one: 'voucher type', many: 'voucher types' },
    { count: result.numberSeries, one: 'number series', many: 'number series' },
  ]
    .filter((row) => row.count > 0)
    .map((row) => `${row.count} ${row.count === 1 ? row.one : row.many}`);

  if (added.length === 0) {
    return `Nothing to add — this company is already on version ${result.seedVersion}.`;
  }

  const list =
    added.length === 1 ? added[0] : `${added.slice(0, -1).join(', ')} and ${added[added.length - 1]}`;
  return `Added ${list}. Now on version ${result.seedVersion}.`;
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
    Whether this company is missing anything the product has since added. The server states both
    numbers — see currentSeedVersion — so the screen can say there is something to do rather than
    leaving a reader to press a button and find out.
  */
  const behind = company.seedVersion < company.currentSeedVersion;

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
            {behind ? (
              <span className={styles.behind}>
                version {company.seedVersion} of {company.currentSeedVersion}
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
      {behind && (
        <p className={styles.hint}>
          Syncing gives this company the default account groups, ledgers and voucher types added to
          the product since it was created — a personal book created before Income and Expense
          existed, for instance. It only ever adds: anything renamed, edited or switched off here is
          left exactly as it is, and syncing twice adds nothing the second time.
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
