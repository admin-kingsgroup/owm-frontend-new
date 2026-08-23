import type { AccountGroup } from '../model/types';

/** The two seeded groups a counterparty lives under. Everything else is an account, not a person. */
export const PARTY_GROUP_CODES = ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS'];

/**
 * A test for "does this group hold parties", built once from the company's chart of accounts.
 *
 * Beneath the two party groups counts, however deep: a company that files its customers by region
 * or by salesperson still has customers, and stopping at the top two would show an empty list to
 * exactly the people most likely to have organised their books that way.
 *
 * Returned as a closure rather than a per-call search because both callers ask it once per ledger,
 * and rebuilding the parent index for each of a few hundred ledgers is the difference between one
 * pass and hundreds.
 */
export function partyGroupTest(groups: AccountGroup[]): (groupId: string) => boolean {
  const byId = new Map(groups.map((group) => [group.id, group]));

  return (groupId: string) => {
    const seen = new Set<string>();
    let cursor = byId.get(groupId);

    while (cursor) {
      if (PARTY_GROUP_CODES.includes(cursor.code)) return true;
      // A ring in the data must not hang the walk; it simply is not a party group.
      if (!cursor.parentId || seen.has(cursor.parentId)) return false;
      seen.add(cursor.parentId);
      cursor = byId.get(cursor.parentId);
    }

    return false;
  };
}
