import type { Locator, Page } from '@playwright/test';

/**
 * Opens the search (Ctrl+K) if it is not already open, types the query, and returns the options it
 * offers.
 *
 * The search is the map of the product now — every report, register, master screen and document a
 * company can raise, with the same feature rules deciding which exist that the menu bar used to
 * apply. What these checks used to ask of a menu, they ask of it.
 */
export async function search(page: Page, query = ''): Promise<Locator> {
  const field = page.getByRole('combobox');
  if (!(await field.isVisible().catch(() => false))) {
    await page.keyboard.press('Control+KeyK');
  }
  await field.fill(query);
  return page.getByRole('option');
}

/** The options under one heading of the search, in the order they are listed. */
export function inGroup(page: Page, group: string): Locator {
  return page.locator(`[role="option"][data-group="${group}"]`);
}
