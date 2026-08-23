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
  currentSeedVersion: 1,
  features: {
    billWiseDetails: true,
    multiCurrency: true,
  },
  ...patch,
});

/** Echoes the current URL, so a switch can be checked by where it actually went. */
function Here() {
  const location = useLocation();
  return <div data-testid="here">{location.pathname}</div>;
}

function renderSwitcher(options: {
  companies: Company[] | null;
  at?: string;
  /** Absent for the screens outside a company — the selection list itself, diagnostics. */
  companyId?: string | null;
}) {
  const at = options.at ?? '/companies/c1/reports';
  const companyId = options.companyId === undefined ? 'c1' : (options.companyId ?? undefined);
  const element = (
    <>
      <CompanySwitcher companyId={companyId} companies={options.companies} />
      <Here />
    </>
  );

  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/companies/:companyId/*" element={element} />
        <Route path="/companies" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /ADB - INR/ }));

/** The companies on offer, without the footer item that opens the selection screen. */
const companyItems = () =>
  screen.getAllByRole('menuitem').filter((item) => !/All companies/.test(item.textContent ?? ''));

/**
 * The switcher is the one control that can silently take somebody into the wrong company's books —
 * and, since the menu bar and button bar stopped offering a second way to the selection screen, the
 * only company control in the product. These cover the promise it makes (you keep the screen you
 * were reading), the way out to the full list, and the states where it must still draw even though
 * there is nothing to switch between.
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

  it('still draws with a single company, because it is the only way to the selection screen', () => {
    // It used to hide here, on the reasoning that a menu of one is a dead control. That held while
    // the Company menu also reached /companies; now that it does not, hiding would strand anyone
    // whose installation holds one company with no way to create a second.
    renderSwitcher({ companies: [company()] });
    open();

    expect(companyItems()).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: /All companies/ })).toBeTruthy();
  });

  it('opens the selection screen from the footer item', () => {
    renderSwitcher({ companies: two });
    open();

    fireEvent.click(screen.getByRole('menuitem', { name: /All companies/ }));

    expect(screen.getByTestId('here').textContent).toBe('/companies');
  });

  it('offers the list from outside a company, and lands on the one chosen', () => {
    renderSwitcher({ companies: two, at: '/companies', companyId: null });

    // Nothing is open, so there is no name to put on the trigger — it asks instead.
    fireEvent.click(screen.getByRole('button', { name: /Select company/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /ADB - USD/ }));

    // No section to carry across from the selection screen, so the choice opens its dashboard.
    expect(screen.getByTestId('here').textContent).toBe('/companies/c2');
  });

  it('renders nothing before the list has arrived', () => {
    const { container } = renderSwitcher({ companies: null });
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('asks rather than hides when the open company is not in the list', () => {
    // A stale bookmark into a company this user can no longer see. There is no name for the
    // trigger, but hiding it now leaves the screen with no company control at all — so it reads as
    // the prompt it is, and the list behind it is the way out.
    renderSwitcher({ companies: [company({ id: 'c2' }), company({ id: 'c3' })] });

    fireEvent.click(screen.getByRole('button', { name: /Select company/ }));
    expect(companyItems()).toHaveLength(2);
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

    const names = companyItems().map((item) => item.textContent);
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
