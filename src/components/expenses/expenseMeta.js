/* ── Expense vocabulary ──────────────────────────────────────────────
   Mode, status and source labels moved onto the brand ramp. Values and
   keys are unchanged — only the colour classes differ, and colour is now
   semantic: aqua/blue for where money moved, lime for settled, amber for
   waiting, coral for a problem. ── */

export const PAYMENT_MODE_OPTIONS = [
  'CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST',
];

export const MODE_CHIP = {
  CASH: 'bg-mr-aqua-soft text-mr-aqua-ink',
  UPI: 'bg-mr-aqua-soft text-mr-aqua-ink',
  CHEQUE: 'bg-mr-amber-soft text-mr-amber-ink',
  BANK: 'bg-mr-blue-soft text-mr-blue',
  TRANSFER: 'bg-mr-blue-soft text-mr-blue',
  NEFT: 'bg-mr-blue-soft text-mr-blue',
  RTGS: 'bg-mr-blue-soft text-mr-blue',
  IMPS: 'bg-mr-blue-soft text-mr-blue',
  ADJUST: 'bg-mr-surface-2 text-mr-muted',
  DEFAULT: 'bg-mr-surface-2 text-mr-muted',
};

export const STATUS_CHIP = {
  pending: { label: 'Pending', chip: 'bg-mr-amber-soft text-mr-amber-ink' },
  approved: { label: 'Approved', chip: 'bg-mr-lime-soft text-mr-lime-ink' },
  rejected: { label: 'Rejected', chip: 'bg-mr-coral-soft text-mr-coral-ink' },
};

/* Entries pulled in from another module are read-only here; the label
   tells the user where to go and the row actions route them there. */
export const SOURCE_META = {
  farmer_payment: { label: 'Farmer payment', route: '/farmer-payments' },
  commission: { label: 'Commission', route: '/commissions' },
  vendor_payment: { label: 'Vendor payment', route: '/vendors' },
  personal_ledger: { label: 'Personal ledger', route: '/personal-ledger' },
  daybook: { label: 'Day book', route: '/daybook' },
};

export const PERIOD_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

/** A non-cash entry without a bill is the one thing that needs chasing. */
export const isMissingBill = (exp) =>
  !!exp.payment_mode && exp.payment_mode !== 'CASH' && !exp.bill_url;
