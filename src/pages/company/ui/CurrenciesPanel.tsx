import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';

import {
  createCurrency,
  listCurrencies,
  listExchangeRates,
  setExchangeRate,
} from '@/entities/currency';
import type { Currency, ExchangeRate, RateType } from '@/entities/currency';
import { Button, Input, Loading, Select, Table } from '@/shared/ui';
import { getErrorMessage, toCalendarDay } from '@/shared/lib';

import styles from './CurrenciesPanel.module.css';

export interface CurrenciesPanelProps {
  companyId: string;
  baseCurrency: string;
}

const RATE_TYPES: Array<{ value: RateType; label: string }> = [
  { value: 'STANDARD', label: 'Standard — used for valuation' },
  { value: 'SELLING', label: 'Selling — when receiving foreign currency' },
  { value: 'BUYING', label: 'Buying — when paying foreign currency' },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Currencies and their dated rates.
 *
 * Rates are never overwritten — each one is effective from a date, and a voucher takes the rate in
 * force on its own date. That is what keeps a voucher recorded at 82 recorded at 82 no matter what
 * the rate does afterwards.
 */
export function CurrenciesPanel({ companyId, baseCurrency }: CurrenciesPanelProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingCurrency, setAddingCurrency] = useState(false);
  const [code, setCode] = useState('');
  const [symbol, setSymbol] = useState('');
  const [currencyName, setCurrencyName] = useState('');

  const [rateCurrency, setRateCurrency] = useState('');
  const [rateType, setRateType] = useState<RateType>('STANDARD');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [rate, setRate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [currencyList, rateList] = await Promise.all([
          listCurrencies(companyId),
          listExchangeRates(companyId),
        ]);
        if (cancelled) return;
        setCurrencies(currencyList);
        setRates(rateList);
        setRateCurrency((current) => current || currencyList[0]?.code || '');
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load currencies'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function handleAddCurrency(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createCurrency(companyId, {
        code: code.toUpperCase(),
        symbol,
        name: currencyName,
      });
      setCurrencies((current) =>
        [...current, created].sort((a, b) => a.code.localeCompare(b.code)),
      );
      setRateCurrency((current) => current || created.code);
      setCode('');
      setSymbol('');
      setCurrencyName('');
      setAddingCurrency(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add currency'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetRate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = await setExchangeRate(companyId, {
        currencyCode: rateCurrency,
        effectiveFrom,
        rateType,
        rate: Number(rate),
      });
      setRates((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setRate('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save rate'));
    } finally {
      setSubmitting(false);
    }
  }

  /*
    Rendered both while the rates are loading and once they are. A spinner in place of the whole
    panel takes the heading with it, so the tab a reader just chose looks empty rather than busy.
  */
  const head = (
    <div className={styles.head}>
      <div>
        <h2 className={styles.title}>Currencies</h2>
        <p className={styles.hint}>
          Everything is reported in {baseCurrency}, this company&apos;s base currency. Add the other
          currencies it transacts in, then a rate for each date you post on.
        </p>
      </div>
      {!loading && !addingCurrency && (
        <Button variant="secondary" onClick={() => setAddingCurrency(true)}>
          <Plus size={14} /> Add currency
        </Button>
      )}
    </div>
  );

  if (loading)
    return (
      <div className={styles.panel}>
        {head}
        <Loading label="Loading currencies…" />
      </div>
    );

  return (
    <div className={styles.panel}>
      {head}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {addingCurrency && (
        <form className={styles.form} onSubmit={handleAddCurrency}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cur-code">
              Code
            </label>
            <Input
              id="cur-code"
              value={code}
              maxLength={3}
              placeholder="USD"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cur-symbol">
              Symbol
            </label>
            <Input
              id="cur-symbol"
              value={symbol}
              maxLength={5}
              placeholder="$"
              onChange={(event) => setSymbol(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cur-name">
              Name
            </label>
            <Input
              id="cur-name"
              value={currencyName}
              placeholder="US Dollar"
              onChange={(event) => setCurrencyName(event.target.value)}
              required
            />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAddingCurrency(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/*
        The empty state names the way out, the way every other empty grid in the product does. "No
        other currencies yet" on its own is a fact about the screen; a reader who has just switched
        multi-currency on is looking for what to do next, and the rates form below stays hidden
        until there is a currency to rate — so without it the tab reads as unfinished, not empty.
      */}
      {currencies.length === 0 ? (
        <p className={styles.hint}>
          No other currencies yet. Use <strong>Add currency</strong> above to add the first one —
          then give it a rate for each date you post on, and a voucher takes the rate in force on
          its own date.
        </p>
      ) : (
        <Table surface="plain" stack zebra={false}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Symbol</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((currency) => (
              <tr key={currency.id}>
                <td data-mono>{currency.code}</td>
                <td>{currency.symbol}</td>
                <td>{currency.name}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {currencies.length > 0 && (
        <>
          <h3 className={styles.title}>Exchange rates</h3>
          <form className={styles.form} onSubmit={handleSetRate}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rate-currency">
                Currency
              </label>
              <Select
                id="rate-currency"
                value={rateCurrency}
                onChange={(event) => setRateCurrency(event.target.value)}
              >
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </Select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rate-type">
                Rate type
              </label>
              <Select
                id="rate-type"
                value={rateType}
                onChange={(event) => setRateType(event.target.value as RateType)}
              >
                {RATE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rate-from">
                Effective from
              </label>
              <Input
                id="rate-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rate-value">
                {baseCurrency} per unit
              </label>
              <Input
                id="rate-value"
                type="number"
                step="0.0001"
                min="0"
                value={rate}
                placeholder="82.5000"
                onChange={(event) => setRate(event.target.value)}
                required
              />
            </div>
            <div className={styles.formActions}>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save rate'}
              </Button>
            </div>
          </form>

          {rates.length > 0 && (
            <Table surface="plain" stack sticky className={styles.ratesGrid}>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Type</th>
                  <th>Effective from</th>
                  <th data-num>Rate</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((entry) => (
                  <tr key={entry.id}>
                    <td data-mono>{entry.currencyCode}</td>
                    <td>{entry.rateType}</td>
                    <td>{toCalendarDay(entry.effectiveFrom)}</td>
                    <td data-num>{entry.rate}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
