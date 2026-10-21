import type { Company } from '../model/types';

const ACCENTS = ['var(--series-1)', 'var(--series-3)', 'var(--series-2)', 'var(--series-4)'];

/**
 * The colour a company is marked with — its initials chip in the switcher and on the group cards.
 *
 * Taken from its code rather than its position in a list, so a company keeps its colour when
 * another is added, removed or renamed: the colour follows the entity, never its rank.
 */
export function companyAccent(company: Pick<Company, 'code'>): string {
  let hash = 0;
  for (const char of company.code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/** The two letters on a company's chip. */
export function companyInitials(company: Pick<Company, 'code' | 'name'>): string {
  const words = company.name.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
  const fromName = words.length > 1 ? `${words[0][0]}${words[1][0]}` : company.code.slice(0, 2);
  return fromName.toUpperCase();
}
