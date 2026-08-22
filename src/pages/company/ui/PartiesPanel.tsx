import { useEffect, useState } from 'react';

import {
  listLedgers,
  updateLedger,
  getOpeningBills,
  setOpeningBills,
  type Ledger,
  type OpeningBill,
} from '@/entities/ledger';
import { listAccountGroups, type AccountGroup } from '@/entities/account-group';
import { Button, Input, Loading } from '@/shared/ui';
import { cn, getErrorMessage } from '@/shared/lib';

import styles from './PartiesPanel.module.css';

interface PartiesPanelProps {
  companyId: string;
}

/** The groups a party lives under. Anything else is an account, not somebody the company deals with. */
const PARTY_GROUPS = ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS'];

interface DraftBill {
  reference: string;
  billDate: string;
  dueDate: string;
  amount: string;
}

const asDraft = (bill: OpeningBill): DraftBill => ({
  reference: bill.reference,
  billDate: bill.billDate.slice(0, 10),
  dueDate: bill.dueDate?.slice(0, 10) ?? '',
  amount: bill.amount,
});

/**
 * The customers and suppliers the company deals with, and what each of them was owed on day one.
 *
 * Separate from the chart of accounts because it answers a different question. That screen is
 * about the shape of the books; this is about the people in them — their GSTIN for a return, the
 * terms agreed with them, and the invoices carried in from whatever they were kept in before.
 *
 * Those carried-in invoices matter more than they look. Without them a party's opening balance is
 * one lump with no invoices behind it, and every ageing bucket is wrong until the last of the old
 * invoices is paid off — the report says nothing is overdue when the oldest debt in the book is.
 */
export function PartiesPanel({ companyId }: PartiesPanelProps) {
  const [parties, setParties] = useState<Ledger[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [details, setDetails] = useState({
    gstin: '',
    pan: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    creditLimit: '',
    creditDays: '',
  });
  const [bills, setBills] = useState<DraftBill[]>([]);
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listLedgers(companyId), listAccountGroups(companyId)])
      .then(([ledgers, groups]: [Ledger[], AccountGroup[]]) => {
        if (cancelled) return;

        /*
          Everything under a party group, however deep — a company that has put its customers into
          sub-groups by region still has customers, and reading only the two top groups would show
          an empty screen to the people most likely to need this one.
        */
        const byId = new Map(groups.map((group) => [group.id, group]));
        const isPartyGroup = (groupId: string): boolean => {
          const seen = new Set<string>();
          let cursor = byId.get(groupId);
          while (cursor) {
            if (PARTY_GROUPS.includes(cursor.code)) return true;
            if (!cursor.parentId || seen.has(cursor.parentId)) return false;
            seen.add(cursor.parentId);
            cursor = byId.get(cursor.parentId);
          }
          return false;
        };

        setParties(
          ledgers
            .filter((ledger) => ledger.isActive && isPartyGroup(ledger.accountGroupId))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the parties'));
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const selected = parties?.find((party) => party.id === selectedId) ?? null;

  async function choose(party: Ledger) {
    setSelectedId(party.id);
    setSaved(null);
    setError(null);
    setDetails({
      gstin: party.gstin ?? '',
      pan: party.pan ?? '',
      address: party.address ?? '',
      contactEmail: party.contactEmail ?? '',
      contactPhone: party.contactPhone ?? '',
      creditLimit: party.creditLimit ?? '',
      creditDays: party.creditDays === undefined ? '' : String(party.creditDays),
    });
    setBills([]);
    setOpeningBalance(party.openingBalance);

    if (!party.maintainBillwise) return;

    try {
      const opening = await getOpeningBills(companyId, party.id);
      setBills(opening.bills.map(asDraft));
      setOpeningBalance(opening.openingBalance);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the opening invoices'));
    }
  }

  /** Empty means "clear it", which is why each field goes out as null rather than as an empty string. */
  const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      const updated = await updateLedger(companyId, selected.id, {
        gstin: orNull(details.gstin),
        pan: orNull(details.pan),
        address: orNull(details.address),
        contactEmail: orNull(details.contactEmail),
        contactPhone: orNull(details.contactPhone),
        creditLimit: details.creditLimit.trim() === '' ? null : Number(details.creditLimit),
        creditDays: details.creditDays.trim() === '' ? null : Number(details.creditDays),
      });

      setParties((current) =>
        (current ?? []).map((party) => (party.id === updated.id ? updated : party)),
      );

      if (selected.maintainBillwise) {
        const result = await setOpeningBills(
          companyId,
          selected.id,
          bills
            .filter((bill) => bill.reference.trim() !== '' && Number(bill.amount) > 0)
            .map((bill) => ({
              reference: bill.reference.trim(),
              billDate: bill.billDate,
              ...(bill.dueDate ? { dueDate: bill.dueDate } : {}),
              amount: Number(bill.amount),
            })),
        );
        setBills(result.bills.map(asDraft));
        setOpeningBalance(result.openingBalance);
      }

      setSaved('Saved');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this party'));
    } finally {
      setSaving(false);
    }
  }

  const billTotal = bills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const difference = Number(openingBalance) - billTotal;

  if (error && !parties) return <p className={styles.error}>{error}</p>;
  if (!parties) return <Loading label="Loading parties…" />;

  if (parties.length === 0) {
    return (
      <p className={styles.empty}>
        No customers or suppliers yet. Create a ledger under Sundry Debtors or Sundry Creditors and
        it will appear here.
      </p>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.list}>
        {parties.map((party) => (
          <button
            key={party.id}
            type="button"
            className={cn(styles.listItem, party.id === selectedId && styles.listItemActive)}
            onClick={() => void choose(party)}
          >
            <span className={styles.listName}>{party.name}</span>
            <span className={styles.listCode}>{party.code}</span>
          </button>
        ))}
      </div>

      {!selected ? (
        <p className={styles.empty}>Choose a party to see and change their details.</p>
      ) : (
        <div className={styles.detail}>
          <h2 className={styles.title}>{selected.name}</h2>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>GSTIN</span>
              <Input
                value={details.gstin}
                onChange={(event) => setDetails({ ...details, gstin: event.target.value })}
                placeholder="27AAPFU0939F1ZV"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>PAN</span>
              <Input
                value={details.pan}
                onChange={(event) => setDetails({ ...details, pan: event.target.value })}
                placeholder="AAPFU0939F"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <Input
                type="email"
                value={details.contactEmail}
                onChange={(event) => setDetails({ ...details, contactEmail: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Phone</span>
              <Input
                value={details.contactPhone}
                onChange={(event) => setDetails({ ...details, contactPhone: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Credit limit</span>
              <Input
                type="number"
                min="0"
                value={details.creditLimit}
                onChange={(event) => setDetails({ ...details, creditLimit: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Credit days</span>
              <Input
                type="number"
                min="0"
                value={details.creditDays}
                onChange={(event) => setDetails({ ...details, creditDays: event.target.value })}
              />
            </label>
            <label className={cn(styles.field, styles.fieldWide)}>
              <span className={styles.label}>Address</span>
              <Input
                value={details.address}
                onChange={(event) => setDetails({ ...details, address: event.target.value })}
              />
            </label>
          </div>

          {selected.maintainBillwise ? (
            <>
              <h3 className={styles.subtitle}>Invoices carried in</h3>
              <p className={styles.hint}>
                What this party owed, invoice by invoice, before the books started here. Without
                them the opening balance is one lump and every ageing bucket is wrong until the
                oldest of them is paid.
              </p>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Dated</th>
                    <th>Due</th>
                    <th className={styles.num}>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill, index) => (
                    <tr key={index}>
                      <td>
                        <Input
                          value={bill.reference}
                          aria-label={`Reference for invoice ${index + 1}`}
                          onChange={(event) =>
                            setBills(
                              bills.map((row, at) =>
                                at === index ? { ...row, reference: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={bill.billDate}
                          aria-label={`Date of invoice ${index + 1}`}
                          onChange={(event) =>
                            setBills(
                              bills.map((row, at) =>
                                at === index ? { ...row, billDate: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Input
                          type="date"
                          value={bill.dueDate}
                          aria-label={`Due date of invoice ${index + 1}`}
                          onChange={(event) =>
                            setBills(
                              bills.map((row, at) =>
                                at === index ? { ...row, dueDate: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          min="0"
                          value={bill.amount}
                          aria-label={`Amount of invoice ${index + 1}`}
                          onChange={(event) =>
                            setBills(
                              bills.map((row, at) =>
                                at === index ? { ...row, amount: event.target.value } : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => setBills(bills.filter((_, at) => at !== index))}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.billFooter}>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setBills([...bills, { reference: '', billDate: '', dueDate: '', amount: '' }])
                  }
                >
                  Add an invoice
                </Button>
                <span className={styles.footing}>
                  {billTotal.toFixed(2)} of {Number(openingBalance).toFixed(2)}
                  {/* Reported, not enforced: somebody entering these one at a time is out by the
                      rest of them until the last one is in. */}
                  {difference !== 0 && (
                    <span className={styles.difference}>
                      {' '}
                      · {Math.abs(difference).toFixed(2)} still unaccounted for
                    </span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <p className={styles.hint}>
              This account is not kept invoice by invoice, so it has no opening invoices. Turn on
              &ldquo;maintain balances bill by bill&rdquo; against the ledger to track it that way.
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {saved && (
            <p className={styles.saved} role="status">
              {saved}
            </p>
          )}

          <div className={styles.actions}>
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
