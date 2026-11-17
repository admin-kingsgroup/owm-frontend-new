import {
  checkLines,
  emptyLine,
  parseAmount,
  type DraftLine,
  type ReadLines,
} from './statement-table';

/**
 * Reads an ISO 20022 bank statement — camt.053 (end of day), and its cousins camt.052 (intraday)
 * and camt.054 (notifications), which use the same `Ntry` blocks.
 *
 * Unlike a CSV there is nothing to map: every field has a fixed name. The namespace differs by
 * version (camt.053.001.02 to .08), so elements are found by local name and the version ignored.
 */

/** The element at a path of child names under `parent`, by local name. */
function first(parent: Element, ...path: string[]): Element | null {
  let current: Element | null = parent;
  for (const name of path) {
    if (!current) return null;
    current = Array.from(current.children).find((child) => child.localName === name) ?? null;
  }
  return current;
}

function textAt(parent: Element, ...path: string[]): string {
  return first(parent, ...path)?.textContent?.trim() ?? '';
}

function allByName(parent: Element | Document, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

/** A date or date-time element under `parent`: `<Dt>2026-11-03</Dt>` or `<DtTm>2026-11-03T…</DtTm>`. */
function dateUnder(parent: Element, name: string): string {
  const holder = first(parent, name);
  if (!holder) return '';
  return (textAt(holder, 'Dt') || textAt(holder, 'DtTm')).slice(0, 10);
}

/** A reference worth matching on: not empty, and not the "NOTPROVIDED" placeholder banks fill in. */
function usable(value: string): string {
  return value && value.toUpperCase() !== 'NOTPROVIDED' ? value : '';
}

/** One `Ntry` — a booked movement on the account — as a statement line. */
function readEntry(entry: Element): DraftLine {
  const line = emptyLine();
  const amount = parseAmount(textAt(entry, 'Amt'));
  const direction = textAt(entry, 'CdtDbtInd');
  line.txnDate = dateUnder(entry, 'BookgDt') || dateUnder(entry, 'ValDt');
  line.valueDate = dateUnder(entry, 'ValDt');

  const details = allByName(entry, 'TxDtls')[0];
  const reference = details
    ? usable(textAt(details, 'Refs', 'ChqNb')) ||
      usable(textAt(details, 'Refs', 'EndToEndId')) ||
      usable(textAt(details, 'Refs', 'TxId')) ||
      usable(textAt(details, 'Refs', 'AcctSvcrRef'))
    : '';
  line.reference =
    reference || usable(textAt(entry, 'AcctSvcrRef')) || usable(textAt(entry, 'NtryRef'));

  const words: string[] = [];
  const additional = textAt(entry, 'AddtlNtryInf');
  if (additional) words.push(additional);
  if (details) {
    const party =
      direction === 'CRDT'
        ? textAt(details, 'RltdPties', 'Dbtr', 'Nm') ||
          textAt(details, 'RltdPties', 'Dbtr', 'Pty', 'Nm')
        : textAt(details, 'RltdPties', 'Cdtr', 'Nm') ||
          textAt(details, 'RltdPties', 'Cdtr', 'Pty', 'Nm');
    if (party) words.push(party);
    for (const unstructured of allByName(details, 'Ustrd')) {
      const value = unstructured.textContent?.trim();
      if (value) words.push(value);
    }
    const extra = textAt(details, 'AddtlTxInf');
    if (extra) words.push(extra);
  }
  line.description = [...new Set(words)].join(' · ');

  if (!amount) line.issues.push(`Could not read the amount "${textAt(entry, 'Amt')}"`);
  else if (direction === 'CRDT') line.deposit = amount.value;
  else if (direction === 'DBIT') line.withdrawal = amount.value;
  else line.issues.push('The entry does not say whether it is a credit or a debit');

  // A pending entry has not happened yet; only booked ones belong in a reconciliation.
  const status = textAt(entry, 'Sts') || textAt(entry, 'Sts', 'Cd');
  if (status && status !== 'BOOK') {
    line.include = false;
    line.issues.push(`Not booked yet (status ${status}) — left out`);
  }
  return line;
}

export function isCamtXml(text: string): boolean {
  return /<\s*(\w+:)?BkToCstmr(Stmt|AcctRpt|DbtCdtNtfctn)\b/.test(text);
}

export function parseCamt(text: string): ReadLines {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('That XML file is damaged and could not be read.');
  }
  if (!isCamtXml(text)) {
    throw new Error(
      'That XML file is not a bank statement in the ISO 20022 camt.053 format. Ask the bank for camt.053, or download the statement as CSV, Excel or PDF instead.',
    );
  }

  const statements = [
    ...allByName(doc, 'Stmt'),
    ...allByName(doc, 'Rpt'),
    ...allByName(doc, 'Ntfctn'),
  ];
  if (statements.length === 0) throw new Error('That camt file has no statement in it.');

  // One statement per day for the same account is normal; several accounts in one file is not.
  const accountOf = (statement: Element) =>
    textAt(statement, 'Acct', 'Id', 'IBAN') || textAt(statement, 'Acct', 'Id', 'Othr', 'Id');
  const accounts = new Set(statements.map(accountOf));
  if (accounts.size > 1) {
    throw new Error(
      `That file holds statements for ${accounts.size} different accounts. Download one account at a time.`,
    );
  }

  let openingBalance: string | undefined;
  let closingBalance: string | undefined;
  const lines: DraftLine[] = [];

  for (const statement of statements) {
    for (const balance of allByName(statement, 'Bal')) {
      const code = textAt(balance, 'Tp', 'CdOrPrtry', 'Cd');
      const amount = parseAmount(textAt(balance, 'Amt'));
      if (!amount) continue;
      const signed = textAt(balance, 'CdtDbtInd') === 'DBIT' ? `-${amount.value}` : amount.value;
      // The first statement's opening and the last one's closing frame the whole file.
      if ((code === 'OPBD' || code === 'PRCD') && openingBalance === undefined)
        openingBalance = signed;
      if (code === 'CLBD') closingBalance = signed;
    }
    lines.push(...allByName(statement, 'Ntry').map(readEntry));
  }

  return checkLines({ lines, openingBalance, closingBalance });
}
