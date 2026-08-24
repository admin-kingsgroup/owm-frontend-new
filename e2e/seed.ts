const API = process.env.VITE_API_BASE_URL ?? 'http://localhost:5099/api/v1';

/** Fixed, so a re-run signs in as the same person rather than filling the database with strangers. */
export const ACCOUNT = {
  name: 'Screenshot Owner',
  email: 'screenshots@owm.local',
  password: 'screenshots123',
};

export interface SeededCompany {
  token: string;
  companyId: string;
}

/**
 * Only what this file reads back. Typed loosely on purpose — it is a seeding helper talking to a
 * handful of endpoints, not a second copy of the API contract to keep in step with the first.
 */
interface SeedResponse {
  data?: {
    id?: string;
    accessToken?: string;
    token?: string;
    [key: string]: unknown;
  } & Array<Record<string, unknown>>;
  [key: string]: unknown;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: SeedResponse }> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * A company with books worth looking at.
 *
 * Screens drawn over an empty company hide most of what is worth checking — a balance column has
 * nothing to squeeze, a statement has no rows to misalign, and the attention list has nothing to
 * say. So this posts a few vouchers and leaves one as a draft, which is the state the gateway and
 * the status strip are actually designed around.
 *
 * Idempotent by intent: registering an account that exists simply logs in, and a company code that
 * exists is reused, so running the checks twice does not need a fresh database.
 */
export async function seed(): Promise<SeededCompany> {
  await call('/auth/register', { method: 'POST', body: ACCOUNT });

  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: ACCOUNT.email, password: ACCOUNT.password },
  });
  if (login.status !== 200) {
    throw new Error(`Could not sign in to ${API} — is the API running? (${login.status})`);
  }
  const token = login.body.data.accessToken ?? login.body.data.token;

  const existing = await call('/companies', { token });
  const already = existing.body?.data?.find(
    (company: { code: string }) => company.code === 'SHOT01',
  );
  if (already) return { token, companyId: already.id };

  const year = new Date().getUTCFullYear();
  const created = await call('/companies', {
    method: 'POST',
    token,
    body: {
      name: 'ADB - INR',
      code: 'SHOT01',
      type: 'PERSONAL',
      // The year containing today, so the frame resolves this one rather than an earlier year.
      financialYearStart: `${year}-01-01`,
      financialYearEnd: `${year}-12-31`,
      baseCurrency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
  });
  if (created.status !== 201) {
    throw new Error(`Could not create the company: ${JSON.stringify(created.body)}`);
  }

  const companyId = created.body.data.id;

  /*
    A company is seeded with a chart of groups but only five ledgers — cash, the profit and loss
    account and three forex accounts. None of them is a bank account, so a set of books worth
    screenshotting has to add its own, exactly as its owner would.

    Groups are chosen out of the company's own chart rather than named from memory. Naming them was
    how the salary account quietly failed to be created — which left the receipt unpostable, the
    bank overdrawn and a gateway reporting a negative net worth, all of it looking like a product
    fault rather than a seeding one.
  */
  const groups = await call(`/companies/${companyId}/account-groups`, { token });
  const groupCode = (...fragments: string[]) =>
    groups.body.data.find((group: { code: string }) =>
      fragments.some((fragment) => group.code.includes(fragment)),
    )?.code;

  const ledger = async (
    code: string,
    name: string,
    accountGroupCode: string | undefined,
    ledgerType: 'GENERAL' | 'BANK' = 'GENERAL',
  ) => {
    if (!accountGroupCode) throw new Error(`No account group found for ${code}`);
    const created = await call(`/companies/${companyId}/ledgers`, {
      method: 'POST',
      token,
      body: { code, name, accountGroupCode, ledgerType },
    });
    if (created.status !== 201) {
      throw new Error(`Could not create ${code}: ${JSON.stringify(created.body)}`);
    }
  };

  await ledger('HDFC_BANK', 'HDFC Bank — 4021', groupCode('BANK_ACCOUNTS'), 'BANK');
  await ledger('SALARY', 'Salary Income', groupCode('DIRECT_INCOME', 'INCOME'));
  await ledger('GROCERIES', 'Household & Groceries', groupCode('HOUSEHOLD', 'EXPENSES'));

  const voucher = async (
    voucherTypeCode: string,
    narration: string,
    entries: Array<{ ledgerCode: string; debit: number; credit: number }>,
    { post = true }: { post?: boolean } = {},
  ) => {
    const raised = await call(`/companies/${companyId}/vouchers`, {
      method: 'POST',
      token,
      body: { voucherTypeCode, voucherDate: `${year}-06-15`, narration, entries },
    });
    // Refusals surface here rather than leaving a company that looks seeded and is not.
    if (!raised.body?.data?.id) {
      throw new Error(`Could not raise "${narration}": ${JSON.stringify(raised.body)}`);
    }
    if (post) {
      await call(`/companies/${companyId}/vouchers/${raised.body.data.id}/post`, {
        method: 'POST',
        token,
      });
    }
  };

  // Money in, money out, and cash moved to the bank — enough for every statement to have rows.
  await voucher('RECEIPT', 'Salary for June', [
    { ledgerCode: 'HDFC_BANK', debit: 480000, credit: 0 },
    { ledgerCode: 'SALARY', debit: 0, credit: 480000 },
  ]);
  await voucher('PAYMENT', 'Monthly groceries', [
    { ledgerCode: 'GROCERIES', debit: 26400, credit: 0 },
    { ledgerCode: 'HDFC_BANK', debit: 0, credit: 26400 },
  ]);
  await voucher('CONTRA', 'Cash drawn for the week', [
    { ledgerCode: 'CASH', debit: 15000, credit: 0 },
    { ledgerCode: 'HDFC_BANK', debit: 0, credit: 15000 },
  ]);
  // Left unposted, so the gateway and the status strip have a backlog to report.
  await voucher(
    'PAYMENT',
    'Insurance premium — not yet posted',
    [
      { ledgerCode: 'GROCERIES', debit: 8600, credit: 0 },
      { ledgerCode: 'HDFC_BANK', debit: 0, credit: 8600 },
    ],
    { post: false },
  );

  return { token, companyId };
}

/**
 * A second company with bill-wise detail and multi-currency switched on.
 *
 * Receivables, Payables and Forex Gain/Loss only exist when those two features are, and the plain
 * company above has neither — so those three screens had never been drawn by any check, only
 * typechecked. ADB runs with both on, which makes them the screens most likely to break unseen.
 *
 * The books here are deliberately awkward in the ways those reports care about: a bill raised and
 * left unpaid, one part-settled, one already overdue, and a receivable held in a currency that is
 * not the company's own with the rate moved under it afterwards.
 */
export async function seedFeatured(token: string): Promise<string> {
  const existing = await call('/companies', { token });
  const already = existing.body?.data?.find(
    (company: { code: string }) => company.code === 'SHOT02',
  );
  /*
    Reusing an existing company is what makes a re-run cheap, but only if that company is actually
    finished. A run that fails partway now throws, which leaves the company created and its books
    half written — and the next run would hand that back and report success over it, which is the
    same silence this seeding was just fixed for. So the reuse is conditional on it having books.
  */
  if (already) {
    const vouchers = await call(`/companies/${already.id}/vouchers?page=1&limit=1`, { token });
    const total = (vouchers.body?.data as { total?: number } | undefined)?.total ?? 0;
    if (total > 0) return already.id as string;

    throw new Error(
      `Company SHOT02 exists but has no vouchers — a previous run failed partway. Drop it and run again.`,
    );
  }

  const year = new Date().getUTCFullYear();
  const created = await call('/companies', {
    method: 'POST',
    token,
    body: {
      name: 'ADB - Multi',
      code: 'SHOT02',
      type: 'PERSONAL',
      financialYearStart: `${year}-01-01`,
      financialYearEnd: `${year}-12-31`,
      baseCurrency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
  });
  if (created.status !== 201) {
    throw new Error(`Could not create the featured company: ${JSON.stringify(created.body)}`);
  }

  const companyId = created.body.data.id as string;

  // Both features on, which is what puts the three reports on the menu at all.
  await call(`/companies/${companyId}`, {
    method: 'PATCH',
    token,
    body: { features: { billWiseDetails: true, multiCurrency: true } },
  });

  await call(`/companies/${companyId}/currencies`, {
    method: 'POST',
    token,
    body: { code: 'USD', symbol: '$', name: 'US Dollar' },
  });
  // Two rates, so the second revalues the first and there is a gain to report.
  await call(`/companies/${companyId}/currencies/rates`, {
    method: 'POST',
    token,
    body: { currencyCode: 'USD', effectiveFrom: `${year}-01-01`, rate: 82 },
  });
  await call(`/companies/${companyId}/currencies/rates`, {
    method: 'POST',
    token,
    body: { currencyCode: 'USD', effectiveFrom: `${year}-07-01`, rate: 86 },
  });

  const groups = await call(`/companies/${companyId}/account-groups`, { token });
  const groupCode = (...fragments: string[]) =>
    groups.body.data.find((group: { code: string }) =>
      fragments.some((fragment) => group.code.includes(fragment)),
    )?.code as string | undefined;

  const ledger = async (body: Record<string, unknown>) => {
    const made = await call(`/companies/${companyId}/ledgers`, { method: 'POST', token, body });
    if (made.status !== 201) {
      throw new Error(`Could not create ${body.code}: ${JSON.stringify(made.body)}`);
    }
  };

  await ledger({
    code: 'HDFC_BANK',
    name: 'HDFC Bank — 4021',
    accountGroupCode: groupCode('BANK_ACCOUNTS'),
    ledgerType: 'BANK',
  });
  // Tracked bill by bill, which is what puts a party into Receivables and Payables at all.
  await ledger({
    code: 'TENANT',
    name: 'Tenant — Bandra flat',
    accountGroupCode: groupCode('LOANS_ADVANCES_ASSET', 'CURRENT_ASSETS'),
    maintainBillwise: true,
  });
  await ledger({
    code: 'CONSULTING_CLIENT',
    name: 'Consulting client — New York',
    accountGroupCode: groupCode('LOANS_ADVANCES_ASSET', 'CURRENT_ASSETS'),
    maintainBillwise: true,
    currencyCode: 'USD',
  });
  await ledger({
    code: 'BUILDER',
    name: 'Builder — renovation',
    accountGroupCode: groupCode('CURRENT_LIABILITIES'),
    maintainBillwise: true,
  });
  await ledger({
    code: 'RENT_INCOME',
    name: 'Rent Received',
    accountGroupCode: groupCode('DIRECT_INCOME', 'INCOME'),
  });
  await ledger({
    code: 'RENOVATION',
    name: 'Renovation',
    accountGroupCode: groupCode('INDIRECT_EXPENSES', 'EXPENSES'),
  });

  const voucher = async (
    voucherTypeCode: string,
    voucherDate: string,
    narration: string,
    entries: Array<Record<string, unknown>>,
  ) => {
    const raised = await call(`/companies/${companyId}/vouchers`, {
      method: 'POST',
      token,
      body: { voucherTypeCode, voucherDate, narration, entries },
    });

    /*
      Loudly, because a silent one is worse than none. This helper used to shrug a refusal off and
      carry on, and the whole company came out empty — every screen still drew, every check still
      passed, and Receivables reported "nothing outstanding" over books that had never been
      written. A seed that half works is a harness that lies.
    */
    if (!raised.body?.data?.id) {
      throw new Error(`Could not raise "${narration}": ${JSON.stringify(raised.body)}`);
    }

    const posted = await call(`/companies/${companyId}/vouchers/${raised.body.data.id}/post`, {
      method: 'POST',
      token,
    });
    if (posted.status !== 200) {
      throw new Error(`Could not post "${narration}": ${JSON.stringify(posted.body)}`);
    }

    return raised;
  };

  // A bill raised and never paid, dated early enough to be well overdue.
  await voucher('JOURNAL', `${year}-02-10`, 'Rent invoiced — February', [
    {
      ledgerCode: 'TENANT',
      debit: 120000,
      credit: 0,
      billAllocations: [
        {
          allocationType: 'NEW_REF',
          reference: 'RENT/FEB',
          amount: 120000,
          dueDate: `${year}-03-10`,
        },
      ],
    },
    { ledgerCode: 'RENT_INCOME', debit: 0, credit: 120000 },
  ]);

  // Raised, then part-settled — so one bill sits partly outstanding rather than all or nothing.
  await voucher('JOURNAL', `${year}-05-05`, 'Rent invoiced — May', [
    {
      ledgerCode: 'TENANT',
      debit: 120000,
      credit: 0,
      billAllocations: [
        {
          allocationType: 'NEW_REF',
          reference: 'RENT/MAY',
          amount: 120000,
          dueDate: `${year}-06-05`,
        },
      ],
    },
    { ledgerCode: 'RENT_INCOME', debit: 0, credit: 120000 },
  ]);
  await voucher('RECEIPT', `${year}-06-20`, 'Part payment against May rent', [
    { ledgerCode: 'HDFC_BANK', debit: 70000, credit: 0 },
    {
      ledgerCode: 'TENANT',
      debit: 0,
      credit: 70000,
      billAllocations: [{ allocationType: 'AGAINST_REF', reference: 'RENT/MAY', amount: 70000 }],
    },
  ]);

  // A receivable in a currency the company does not keep its books in, raised at the old rate.
  await voucher('JOURNAL', `${year}-03-15`, 'Consulting invoiced in USD', [
    {
      ledgerCode: 'CONSULTING_CLIENT',
      debit: 5000,
      credit: 0,
      currencyCode: 'USD',
      exchangeRate: 82,
      billAllocations: [
        {
          allocationType: 'NEW_REF',
          reference: 'CONS/0031',
          amount: 5000,
          dueDate: `${year}-04-15`,
        },
      ],
    },
    { ledgerCode: 'RENT_INCOME', debit: 0, credit: 410000 },
  ]);

  // Something owed the other way, so Payables is not an empty screen.
  await voucher('JOURNAL', `${year}-04-02`, 'Renovation billed', [
    { ledgerCode: 'RENOVATION', debit: 64000, credit: 0 },
    {
      ledgerCode: 'BUILDER',
      debit: 0,
      credit: 64000,
      billAllocations: [
        {
          allocationType: 'NEW_REF',
          reference: 'RENO/07',
          amount: 64000,
          dueDate: `${year}-05-02`,
        },
      ],
    },
  ]);

  return companyId;
}

/**
 * An analytics workspace, with a registry and nothing locked yet.
 *
 * KG Business is the only company of this type in the product, and its dashboard answers an
 * entirely different question from the accounting one — so until this existed, the portfolio
 * dashboard had never been drawn by any check, only typechecked.
 *
 * Deliberately without snapshots. The state that matters most on that screen is the one where
 * businesses are on the books and have not reported: it is the state a real month starts in, it is
 * what the "n of m reporting" tile exists to say out loud, and it is reachable without driving a
 * statement import through the API. A workspace where everything has reported is the easy case.
 */
export async function seedAnalytics(token: string): Promise<string> {
  const existing = await call('/companies', { token });
  const already = existing.body?.data?.find(
    (company: { code: string }) => company.code === 'SHOT03',
  );
  if (already) return already.id as string;

  const year = new Date().getUTCFullYear();
  const created = await call('/companies', {
    method: 'POST',
    token,
    body: {
      name: 'KG Business',
      code: 'SHOT03',
      type: 'ANALYTICS',
      financialYearStart: `${year}-01-01`,
      financialYearEnd: `${year}-12-31`,
      baseCurrency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
  });
  if (created.status !== 201) {
    throw new Error(`Could not create the analytics workspace: ${JSON.stringify(created.body)}`);
  }

  const companyId = created.body.data.id as string;

  const partner = async (code: string, name: string) => {
    const made = await call(`/companies/${companyId}/kg/partners`, {
      method: 'POST',
      token,
      body: { code, name },
    });
    if (!made.body?.data?.id) {
      throw new Error(`Could not create partner ${code}: ${JSON.stringify(made.body)}`);
    }
    return made.body.data.id as string;
  };

  const first = await partner('PTR_A', 'A. Rahman');
  const second = await partner('PTR_B', 'S. Devi');

  // A shared business and a wholly owned one — the two shapes the tie-out treats differently.
  const business = async (
    code: string,
    name: string,
    reportingCurrency: string,
    partners?: Array<{ partnerId: string; profitSharePercent: number }>,
  ) => {
    const made = await call(`/companies/${companyId}/kg/businesses`, {
      method: 'POST',
      token,
      body: { code, name, reportingCurrency, ...(partners ? { partners } : {}) },
    });
    if (!made.body?.data?.id) {
      throw new Error(`Could not create business ${code}: ${JSON.stringify(made.body)}`);
    }
  };

  await business('KG_TEXTILES', 'KG Textiles', 'INR', [
    { partnerId: first, profitSharePercent: 60 },
    { partnerId: second, profitSharePercent: 40 },
  ]);
  await business('KG_EXPORTS', 'KG Exports', 'USD');

  return companyId;
}

/**
 * A company that has invented a voucher type of its own.
 *
 * Its own company rather than a type added to one of the two above, because every other check
 * draws those and a seventh document would move menus, counts and pictures that have nothing to do
 * with this. What is being checked is the one case the fixed table of function keys cannot express:
 * a type with no key, which the button bar used to leave out altogether and which was therefore
 * only raisable by going back to the gateway to find it.
 */
export async function seedInvented(token: string): Promise<string> {
  const existing = await call('/companies', { token });
  const already = existing.body?.data?.find(
    (company: { code: string }) => company.code === 'SHOTINV',
  );
  if (already) return already.id;

  const year = new Date().getUTCFullYear();
  const created = await call('/companies', {
    method: 'POST',
    token,
    body: {
      name: 'ADB - Invented',
      code: 'SHOTINV',
      type: 'PERSONAL',
      financialYearStart: `${year}-01-01`,
      financialYearEnd: `${year}-12-31`,
      baseCurrency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
  });
  if (created.status !== 201) {
    throw new Error(`Could not create the invented-type company: ${JSON.stringify(created.body)}`);
  }

  const companyId = created.body.data.id;

  const type = await call(`/companies/${companyId}/voucher-types`, {
    method: 'POST',
    token,
    body: { code: 'PETTY_CASH', name: 'Petty Cash', category: 'PAYMENT' },
  });
  if (type.status !== 201) {
    throw new Error(`Could not create the voucher type: ${JSON.stringify(type.body)}`);
  }

  return companyId;
}
