/* Run: node src/components/landing/demoLedger.check.mjs
   Guards the one rule the landing page's credibility rests on — the
   illustrative figures must reconcile. Fails loudly if someone edits a
   month without editing the rest. */
import assert from 'node:assert/strict';
import { BALANCE_SERIES, COLLECTION_MIX, DEMO_LEDGER, MONTHS, OPENING } from './demoLedger.js';

const inSum = MONTHS.reduce((s, m) => s + m.in, 0);
const outSum = MONTHS.reduce((s, m) => s + m.out, 0);

assert.equal(DEMO_LEDGER.incoming, inSum, 'incoming must equal the monthly series');
assert.equal(DEMO_LEDGER.outgoing, outSum, 'outgoing must equal the monthly series');
assert.equal(DEMO_LEDGER.closing, OPENING + inSum - outSum, 'closing = opening + in − out');

assert.equal(
  COLLECTION_MIX.reduce((s, r) => s + r.value, 0),
  inSum,
  'the collection mix must add up to total incoming',
);

assert.equal(BALANCE_SERIES.length, MONTHS.length, 'one balance point per month');
assert.equal(
  BALANCE_SERIES[BALANCE_SERIES.length - 1].balance,
  DEMO_LEDGER.closing,
  'the trend must land on the closing balance',
);

// A gauge pinned near 0% or 100% reads as marketing rather than a real position.
const fill = DEMO_LEDGER.closing / (OPENING + inSum);
assert.ok(fill > 0.3 && fill < 0.7, `gauge fill ${Math.round(fill * 100)}% should look plausible`);

console.log('demoLedger ok —', `closing ${DEMO_LEDGER.closing.toLocaleString('en-IN')}, gauge ${Math.round(fill * 100)}%`);
