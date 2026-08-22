// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { Company, CompanyType } from '@/entities/company';

import { CompanySwitcher } from './CompanySwitcher';

const company = (patch: Partial<Company> = {}): Company => ({
  id: 'c1',
  name: 'ADB - INR',
  code: 'ADBINR',
  type: 'PERSONAL' as CompanyType,
  financialYearStart: '2026-04-01T00:00:00.000Z',
  financialYearEnd: '2027-03-31T00:00:00.000Z',
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  initialized: true,
  seedVersion: 1,
  features: {
    billWiseDetails: true,
    multiCurrency: true,
    costCentres: false,
    inventory: false,
    gst: false,
  },
  ...patch,
});

/** Echoes the current URL, so a switch can be checked by where it actually went. */
function Here() {
  const location = useLocation();
  return <div data-testid="here">{location.pathname}</div>;
}

function renderSwitcher(options: { companies: Company[] | null; at?: string }) {
  const at = options.at ?? '/companies/c1/reports';
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/companies/:companyId/*"
          element={
            <>
              <CompanySwitcher companyId="c1" companies={options.companies} />
              <Here />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /ADB - INR/ }));

/**
 * The switcher is the one control that can silently take somebody into the wrong company's books.
 * These cover the promise it makes — you keep the screen you were reading — and the two states
 * where it must not appear at all, because a trigger that opens onto one option is a dead control.
 */
describe('CompanySwitcher', () => {
  afterEach(cleanup);

  const two = [company(), company({ id: 'c2', name: 'ADB - USD', code: 'ADBUSD' })];

  it('keeps you on the same screen when you switch', () => {
    renderSwitcher({ companies: two });
    open();

    fireEvent.click(screen.getByRole('menuitem', { name: /ADB - USD/ }));

    // Not /companies/c2 — switching while reading Reports lands on the other company's Reports.
    expect(screen.getByTestId('here').textContent).toBe('/companies/c2/reports');
  });

  it('stays put when the company chosen is the one already open', () => {
    renderSwitcher({ companies: two });
    open();

    fireEvent.click(screen.getByRole('menuitem', { name: /ADB - INR/ }));

    expect(screen.getByTestId('here').textContent).toBe('/companies/c1/reports');
  });

  it('carries a deeper section across as well', () => {
    renderSwitcher({ companies: two, at: '/companies/c1/reports/day-book' });
    open();

    fireEvent.click(screen.getByRole('menuitem', { name: /ADB - USD/ }));

    expect(screen.getByTestId('here').textContent).toBe('/companies/c2/reports/day-book');
  });

  it('renders nothing when there is nothing to switch between', () => {
    const { container } = renderSwitcher({ companies: [company()] });
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('renders nothing before the list has arrived', () => {
    const { container } = renderSwitcher({ companies: null });
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('renders nothing when the open company is not in the list', () => {
    // A stale bookmark into a company this user can no longer see: better absent than showing a
    // switcher whose trigger has no name to put on it.
    const { container } = renderSwitcher({
      companies: [company({ id: 'c2' }), company({ id: 'c3' })],
    });
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('sinks deactivated companies below the ones in daily use, and says which they are', () => {
    renderSwitcher({
      companies: [
        company({ id: 'c2', name: 'AAA Retired', code: 'AAA', status: 'INACTIVE' }),
        company(),
        company({ id: 'c3', name: 'ZZZ Active', code: 'ZZZ' }),
      ],
    });
    open();

    const names = screen.getAllByRole('menuitem').map((item) => item.textContent);
    // Alphabetically AAA leads; by status it trails. Status wins, or a retired company is the
    // first thing the eye lands on every time the menu opens.
    expect(names[names.length - 1]).toContain('AAA Retired');
    expect(names[names.length - 1]).toContain('Deactivated');
  });

  it('marks the company you are already in', () => {
    renderSwitcher({ companies: two });
    open();

    const current = screen.getByRole('menuitem', { name: /ADB - INR/ });
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('menuitem', { name: /ADB - USD/ }).getAttribute('aria-current')).toBe(
      null,
    );
  });

  it('closes on Escape', () => {
    renderSwitcher({ companies: two });
    open();
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
