// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { useMenuKeys } from './use-menu-keys';

function Menu({ current }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useMenuKeys(open, menuRef);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <div role="menu" ref={menuRef}>
          {['Alpha', 'Beta', 'Gamma'].map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              aria-current={name === current ? 'true' : undefined}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const focused = () => document.activeElement?.textContent;
const press = (key: string) => fireEvent.keyDown(screen.getByRole('menu'), { key, bubbles: true });

/**
 * A dropdown that only answers Tab makes the reader traverse the page to leave it. These cover the
 * behaviour a keyboard user expects of anything calling itself a menu.
 */
describe('useMenuKeys', () => {
  afterEach(cleanup);

  it('focuses the first item when the menu opens', () => {
    render(<Menu />);
    fireEvent.click(screen.getByText('open'));
    expect(focused()).toBe('Alpha');
  });

  it('opens on the current item when there is one', () => {
    render(<Menu current="Beta" />);
    fireEvent.click(screen.getByText('open'));
    expect(focused()).toBe('Beta');
  });

  it('moves down and up, and wraps at both ends', () => {
    render(<Menu />);
    fireEvent.click(screen.getByText('open'));

    press('ArrowDown');
    expect(focused()).toBe('Beta');
    press('ArrowDown');
    expect(focused()).toBe('Gamma');
    // Past the last item, back to the first.
    press('ArrowDown');
    expect(focused()).toBe('Alpha');
    // And backwards off the first, round to the last.
    press('ArrowUp');
    expect(focused()).toBe('Gamma');
  });

  it('jumps to the ends with Home and End', () => {
    render(<Menu />);
    fireEvent.click(screen.getByText('open'));

    press('End');
    expect(focused()).toBe('Gamma');
    press('Home');
    expect(focused()).toBe('Alpha');
  });

  it('leaves other keys alone, so typing and Escape still reach the menu', () => {
    render(<Menu />);
    fireEvent.click(screen.getByText('open'));

    press('ArrowDown');
    const before = focused();
    press('Escape');
    press('a');
    expect(focused()).toBe(before);
  });
});
