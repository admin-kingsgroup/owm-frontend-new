const API = process.env.VITE_API_BASE_URL ?? 'http://localhost:5099/api/v1';

/** Fixed, so a re-run signs in as the same person rather than filling the database with strangers. */
const ACCOUNT = {
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
    if (post && raised.body?.data?.id) {
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
