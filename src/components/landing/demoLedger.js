/* ── Demo ledger figures — the single source for the whole landing page ──
   The hero card and the analytics panel both read this, so they cannot
   contradict each other.

   HONESTY: these are illustrative figures on a deliberately fictional
   site ("Demo Colony"), and every surface that shows them says so. They
   must also reconcile, so a prospect who checks the arithmetic finds it
   correct:

     opening 18,42,000 + in 64,80,500 − out 41,26,300 = closing 41,96,200

   The monthly series sums to the totals and the collection mix sums to
   incoming — both asserted in demoLedger.check.mjs. Edit one number and
   the check fails until you edit the rest. ── */

export const OPENING = 1842000;

export const MONTHS = [
  { label: 'Dec', in: 820000, out: 610300 },
  { label: 'Jan', in: 1140000, out: 702000 },
  { label: 'Feb', in: 960500, out: 588000 },
  { label: 'Mar', in: 1285000, out: 815000 },
  { label: 'Apr', in: 1105000, out: 664000 },
  { label: 'May', in: 1170000, out: 747000 },
];

export const COLLECTION_MIX = [
  { label: 'Plot instalments', value: 4180500, tone: 'bg-mr-aqua-ink' },
  { label: 'Registry & transfer', value: 1420000, tone: 'bg-mr-blue' },
  { label: 'Broker recovery', value: 880000, tone: 'bg-mr-lime-ink' },
];

const INCOMING = MONTHS.reduce((sum, m) => sum + m.in, 0);
const OUTGOING = MONTHS.reduce((sum, m) => sum + m.out, 0);

/* Running closing balance, derived from the same series rather than a
   second set of invented numbers. */
export const BALANCE_SERIES = MONTHS.reduce((acc, m) => {
  const previous = acc.length ? acc[acc.length - 1].balance : OPENING;
  acc.push({ label: m.label, balance: previous + m.in - m.out });
  return acc;
}, []);

export const DEMO_LEDGER = {
  site: 'Demo Colony · Phase II',
  period: 'Dec – May',
  opening: OPENING,
  incoming: INCOMING,
  outgoing: OUTGOING,
  closing: OPENING + INCOMING - OUTGOING,
};
