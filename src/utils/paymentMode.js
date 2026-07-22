// Canonical payment-mode bucketing used across the Day Book UI.
//
// MUST stay in lockstep with two other copies of this rule:
//   - backend src/utils/paymentMode.js  (identical file)
//   - SQL     ledger_bucket()           (backend migration 081)
// Three implementations drifting apart is what put 'CASH IN HAND' in the bank
// book and classified 'GPAY' as cash. Change one, change all three, then run
// `npm run check:ledger` in the backend.
//
// POLICY (owner, 2026-07-22). There are two accounting books: Cash and Bank.
// Cheque remains a detail bucket for cheque lifecycle/reporting, but belongs to
// the Bank book. Only an explicit CASH-prefixed mode is physical cash; every
// other value (including blank/unrecognised modes) is non-cash and therefore
// belongs to Bank. This makes Cash + Bank exhaustive for every ledger row.

export const BUCKETS = ['cash', 'bank', 'cheque'];

// Matches CASH, CASH IN HAND, CASH-PAYMENT and CASH_PAYMENT without treating
// unrelated values such as CASHBACK or NON CASH as physical cash.
const CASH_PATTERN = /^CASH(?:[\s_-]|$)/;

// Returns one of: 'cash' | 'bank' | 'cheque'. Check order matches the SQL
// ledger_bucket() exactly: cheque detail wins first, explicit cash is next, and
// the exhaustive fallback is bank.
export function classifyPaymentMode(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s.includes('CHEQUE') || s.includes('CHQ')) return 'cheque';
  if (CASH_PATTERN.test(s)) return 'cash';
  return 'bank';
}

// Every book except cash. From the firm's side any non-cash mode settles
// through a bank account, so /daybook/bank aggregates these. Derived from
// BUCKETS rather than hardcoded — the callers used to spell the list out and
// went stale whenever a bucket changed, which silently dropped that bucket's
// money from the Bank Day Book opening balance.
export const NON_CASH_BUCKETS = BUCKETS.filter((b) => b !== 'cash');

// Labels used for the per-bucket Remaining breakdown on the Main Day Book.
export const BUCKET_LABELS = {
  cash:   'Cash',
  bank:   'Bank',
  cheque: 'Cheque',
};
