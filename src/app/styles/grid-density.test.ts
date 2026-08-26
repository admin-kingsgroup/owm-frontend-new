import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * One density, named once.
 *
 * Seven grids across the product write rows of figures, and they are read as one thing: a reader
 * moving from the trial balance to the voucher register to the chart of accounts should not feel
 * the rows change height under them. That is what `--grid-head-padding` and `--grid-cell-padding`
 * in `globals.css` are for.
 *
 * The rule has been broken twice, both times the same way and both times found only by grepping —
 * a new grid ships with a plausible `8px 10px` of its own, nothing fails, and the screens quietly
 * disagree. Nobody reviewing one file sees it. So the rule is checked here rather than remembered:
 * a grid that sets its own padding fails this test and says which line to change.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/**
 * The one grid that keeps its own.
 *
 * A party's ledgers are drawn inside that party's card, not as a statement of their own, and the
 * tighter row is the point there — it reads as detail belonging to the card above it. Listed by
 * name so that staying out of the rule is a decision on the record, not an omission.
 */
const DELIBERATE_EXCEPTIONS = new Set(['PartiesPanel.module.css']);

/** Every `*.module.css` under `src`, with its path relative to `src` for legible failures. */
function styleSheets(dir = SRC, prefix = ''): Array<{ name: string; path: string; css: string }> {
  const found: Array<{ name: string; path: string; css: string }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...styleSheets(full, `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.module.css'))
      found.push({ name: entry.name, path: `${prefix}${entry.name}`, css: readFileSync(full, 'utf8') });
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

/** Every rule whose selector names a `.table` heading or cell, with the padding it sets. */
function gridRules(css: string): Array<{ selector: string; part: 'th' | 'td'; padding: string }> {
  const rules: Array<{ selector: string; part: 'th' | 'td'; padding: string }> = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(css)) !== null) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const body = match[2];
    if (!/\.table\b[^,]*\b(th|td)\b/.test(selector)) continue;
    const padding = /(?:^|[;{\s])padding\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
    if (!padding) continue;
    rules.push({ selector, part: /\bth\b/.test(selector) ? 'th' : 'td', padding });
  }
  return rules;
}

describe('grid density', () => {
  const sheets = styleSheets();

  it('finds the stylesheets to check', () => {
    // A path that stops resolving would make every case below pass by having nothing to test.
    expect(sheets.length).toBeGreaterThan(5);
  });

  it('declares both tokens once, in globals.css', () => {
    const globals = readFileSync(join(SRC, 'app/styles/globals.css'), 'utf8');
    expect(globals).toContain('--grid-head-padding:');
    expect(globals).toContain('--grid-cell-padding:');
  });

  it('every grid takes its row height from the tokens', () => {
    const offenders: string[] = [];

    for (const sheet of sheets) {
      if (DELIBERATE_EXCEPTIONS.has(sheet.name)) continue;
      for (const rule of gridRules(withoutAtRuleBlocks(sheet.css))) {
        const wanted = rule.part === 'th' ? '--grid-head-padding' : '--grid-cell-padding';
        if (!rule.padding.includes(wanted)) {
          offenders.push(`${sheet.path}  ${rule.selector} { padding: ${rule.padding} }  → var(${wanted})`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('names every exception, and every name is a stylesheet that exists', () => {
    // An exception left behind after its file is renamed silently stops excusing anything.
    for (const name of DELIBERATE_EXCEPTIONS) {
      expect(sheets.some((sheet) => sheet.name === name)).toBe(true);
    }
  });

  it('the exception really does set its own, so the entry is earning its place', () => {
    for (const name of DELIBERATE_EXCEPTIONS) {
      const sheet = sheets.find((entry) => entry.name === name);
      const rules = gridRules(withoutAtRuleBlocks(sheet?.css ?? ''));
      expect(rules.some((rule) => !rule.padding.includes('--grid-'))).toBe(true);
    }
  });
});
