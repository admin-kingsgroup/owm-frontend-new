// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { CommandPalette } from './CommandPalette';
import type { CommandItem } from './CommandPalette';

const item = (label: string, group = 'Reports', patch: Partial<CommandItem> = {}): CommandItem => ({
  id: label,
  group,
  label,
  onSelect: vi.fn(),
  ...patch,
});

describe('CommandPalette', () => {
  afterEach(cleanup);

  it('finds an item by every word typed, in any order', () => {
    const items = [item('Balance Sheet'), item('Trial Balance'), item('Day Book')];
    render(<CommandPalette open onClose={() => {}} items={items} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'balance trial' } });

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Trial Balance',
    ]);
  });

  it('finds an item by a word it is only tagged with', () => {
    const items = [item('ADB - INR', 'Switch company', { keywords: 'ADBINR' })];
    render(<CommandPalette open onClose={() => {}} items={items} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'adbinr' } });

    expect(screen.getByRole('option', { name: /ADB - INR/ })).toBeTruthy();
  });

  it('moves with the arrow keys and runs the choice with Enter, closing first', () => {
    const items = [item('Balance Sheet'), item('Profit & Loss')];
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={items} />);
    const field = screen.getByRole('combobox');

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(
      screen.getByRole('option', { name: 'Profit & Loss' }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(items[1].onSelect).toHaveBeenCalled();
    expect(items[0].onSelect).not.toHaveBeenCalled();
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    render(<CommandPalette open onClose={() => {}} items={[item('Day Book')]} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zebra' } });

    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('draws nothing while closed', () => {
    render(<CommandPalette open={false} onClose={() => {}} items={[item('Day Book')]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
