// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { Figure } from './Figure';

/**
 * A figure and the side it falls on.
 *
 * This exists because of a bug that shipped: reports blank a nil so a statement whose columns are
 * mostly zero does not bury the two figures that are not, which left the side marker with nothing
 * to qualify. Every such row printed a lone "Dr" — read by anyone looking at it as a figure that
 * had failed to load rather than as a group holding nothing.
 */
afterEach(cleanup);

describe('Figure', () => {
  it('writes the amount with the side it falls on', () => {
    render(<Figure amount="40,35,200.00" side="DEBIT" />);
    expect(screen.getByText(/40,35,200\.00/)).toBeTruthy();
    expect(screen.getByText('Dr')).toBeTruthy();
  });

  it('marks a credit as one', () => {
    render(<Figure amount="42,15,200.00" side="CREDIT" />);
    expect(screen.getByText('Cr')).toBeTruthy();
  });

  it('draws a dot for nil, and no side with it', () => {
    const { container } = render(<Figure amount="" side="DEBIT" />);
    expect(container.textContent).toBe('·');
    expect(screen.queryByText('Dr')).toBeNull();
  });

  it('writes a figure that carries no side of its own', () => {
    const { container } = render(<Figure amount="1,80,000.00" />);
    expect(container.textContent).toBe('1,80,000.00');
  });

  it('draws the dot for nil whether or not a side was given', () => {
    const { container } = render(<Figure amount="" />);
    expect(container.textContent).toBe('·');
  });

  /*
    A nil is blank, not "0.00" — the caller has already formatted it. Anything else, including a
    figure that merely looks small, is a real amount and keeps its side.
  */
  it('treats a formatted zero as a figure, because the caller chose to keep it', () => {
    render(<Figure amount="0.00" side="CREDIT" />);
    expect(screen.getByText(/0\.00/)).toBeTruthy();
    expect(screen.getByText('Cr')).toBeTruthy();
  });
});
