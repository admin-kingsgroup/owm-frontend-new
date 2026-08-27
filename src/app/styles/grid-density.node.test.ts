import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Every density, named in one place.
 *
 * The grids across the product are read as one thing: a reader moving from the trial balance to
 * the voucher register to the chart of accounts should not feel the rows change height under them.
 * That is what the `--grid-*-padding*` tokens in `globals.css` are for.
 *
 * The rule has been broken repeatedly, always the same way and always found only by grepping — a
 * new grid ships with a plausible `8px 10px` of its own, nothing fails, and the screens quietly
 * disagree. Nobody reviewing one file sees it. So it is checked here rather than remembered.
 *
 * The product has three densities and that is deliberate: the statement density for a grid
 * standing on its own, a tighter one for a grid drawn inside another record's card, and a card
 * density for a summary extract that lines up with its card's own gutter. What this file insists
 * on is that a grid picks one of them by name — never that there is only ever one.
 *
 * Most of the grids are now the single shared Table in `shared/ui`, which draws the first two from
 * the tokens directly, so there is much less left to get wrong than when this was written.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Grids allowed to set their own padding rather than take it from a token.
 *
 * Two, each because it is not a grid of figures at all. Listed by name so that staying out of the
 * rule is a decision on the record rather than an omission — which is the point of the whole file.
 *
 * The parties panel used to be a third. It still sits tighter than a statement does, but that
 * density is now `--grid-*-padding-tight` in globals.css and the shared Table draws it from there,
 * so it no longer needs excusing.
 */
const DELIBERATE_EXCEPTIONS = new Map<string, string>([
  [
    'CreateVoucherForm.module.css',
    'A data-entry grid, not a statement: every cell holds an input, and the row height is set by ' +
      'the control inside it rather than by the figure it will eventually contain.',
  ],
  [
    'ImportExportPanel.module.css',
    'The refusal list from an import — rows of messages about what could not be read, which is ' +
      'prose rather than a column of figures and wants to sit tighter than a ledger.',
  ],
]);

/** Every `*.module.css` under `src`, with its path relative to `src` for legible failures. */
function styleSheets(dir = SRC, prefix = ''): Array<{ name: string; path: string; css: string }> {
  const found: Array<{ name: string; path: string; css: string }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...styleSheets(full, `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.module.css'))
      found.push({
        name: entry.name,
        path: `${prefix}${entry.name}`,
        css: readFileSync(full, 'utf8'),
      });
  }
  return found;
}

/**
 * Drops `@media`, `@supports` and the like, braces balanced.
 *
 * A print block legitimately re-spaces a grid for paper, and a coarse-pointer block legitimately
 * opens the rows up for a finger. Neither is the screen density this guards, and counting braces
 * is the only way to skip a block whose body itself contains braces.
 */
function withoutAtRuleBlocks(css: string): string {
  let out = '';
  for (let i = 0; i < css.length; i++) {
    if (css[i] !== '@') {
      out += css[i];
      continue;
    }
    const open = css.indexOf('{', i);
    if (open === -1) {
      out += css.slice(i);
      break;
    }
    /* Not every at-rule wraps a block — `@import url(...);` ends at the semicolon. */
    const semicolon = css.indexOf(';', i);
    if (semicolon !== -1 && semicolon < open) {
      i = semicolon;
      continue;
    }
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) break;
    }
    i = j;
  }
  return out;
}

/**
 * Every rule that pads a table heading or cell, with the padding it sets.
 *
 * Any selector, not only ones naming `.table`.
 *
 * That was the blind spot. The rule only ever looked at `.table th` and `.table td`, so a grid
 * called anything else was free to invent its own row height and nothing said a word — which is
 * exactly what had happened: the company dashboard's `.figures` had been running a third density
 * of its own the whole time, and the guard written to catch that could not see it.
 *
 * Every density in the product is now a token in globals.css and every grid names one, so the
 * check no longer has to guess which selectors count as a grid.
 */
function gridRules(css: string): Array<{ selector: string; part: 'th' | 'td'; padding: string }> {
  const rules: Array<{ selector: string; part: 'th' | 'td'; padding: string }> = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(css)) !== null) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const body = match[2];
    if (!/\b(th|td)\b/.test(selector)) continue;
    const padding = /(?:^|[;{\s])padding\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
    if (!padding) continue;
    /*
      A `th` inside `tfoot` is a row label — `<th scope="row">Total</th>` — not a column heading.
      It sits in the totals row beside the figures it names and has to line up with them, so it
      takes the cell padding like they do. Given the head padding it would stand a step taller than
      its own row and the label would no longer sit level with the amount it introduces.
    */
    const columnHeading = /\bth\b/.test(selector) && !/\btfoot\b/.test(selector);
    rules.push({ selector, part: columnHeading ? 'th' : 'td', padding });
  }
  return rules;
}

describe('grid density', () => {
  const sheets = styleSheets();

  it('finds the stylesheets to check', () => {
    // A path that stops resolving would make every case below pass by having nothing to test.
    expect(sheets.length).toBeGreaterThan(5);
  });

  it('declares every density once, in globals.css', () => {
    const globals = readFileSync(join(SRC, 'app/styles/globals.css'), 'utf8');

    /*
      All three of them, declared together.

      The statement density that every grid standing on its own uses; the nested one for a grid
      drawn inside another record's card; and the card one for a summary extract that has to line
      up with the card's own gutter. Naming them here is what makes "how many row heights does this
      product have" a question with an answer.
    */
    for (const token of [
      '--grid-head-padding',
      '--grid-cell-padding',
      '--grid-head-padding-tight',
      '--grid-cell-padding-tight',
      '--grid-head-padding-card',
      '--grid-cell-padding-card',
      '--grid-foot-padding-card',
      '--grid-section-padding-card',
    ]) {
      expect(globals).toContain(`${token}:`);
    }
  });

  it('every grid takes its row height from a named density', () => {
    const offenders: string[] = [];

    for (const sheet of sheets) {
      if (DELIBERATE_EXCEPTIONS.has(sheet.name)) continue;
      for (const rule of gridRules(withoutAtRuleBlocks(sheet.css))) {
        /*
          Any of the named densities will do, rather than one specific token.

          Which of the three a grid belongs to is a judgement about what the grid *is* — a
          statement, detail inside a record, a summary in a card — and that judgement belongs with
          the grid. What cannot be left to judgement is inventing a fourth silently, which is what
          this catches: a padding written as a literal names no density at all.
        */
        if (!/var\(--grid-[a-z-]*padding[a-z-]*\)/.test(rule.padding)) {
          offenders.push(
            `${sheet.path}  ${rule.selector} { padding: ${rule.padding} }  → a var(--grid-*-padding*)`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('names every exception, and every name is a stylesheet that exists', () => {
    // An exception left behind after its file is renamed silently stops excusing anything.
    for (const [name] of DELIBERATE_EXCEPTIONS) {
      expect(sheets.some((sheet) => sheet.name === name)).toBe(true);
    }
  });

  it('every exception carries a reason', () => {
    // A bare filename on the list is how "we decided this" becomes "nobody got round to it".
    for (const [name, why] of DELIBERATE_EXCEPTIONS) {
      expect(why.length, `${name} needs a reason`).toBeGreaterThan(40);
    }
  });

  it('the exception really does set its own, so the entry is earning its place', () => {
    for (const [name] of DELIBERATE_EXCEPTIONS) {
      const sheet = sheets.find((entry) => entry.name === name);
      const rules = gridRules(withoutAtRuleBlocks(sheet?.css ?? ''));
      expect(rules.some((rule) => !rule.padding.includes('--grid-'))).toBe(true);
    }
  });
});
