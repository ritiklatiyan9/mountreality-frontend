/* Run: node src/lib/money.check.mjs
   The gap in "₹64.81 L" must stay a non-breaking space. An ordinary space
   looks identical in every editor and in every diff, but lets a narrow
   column wrap the unit onto its own line — the number then reads as a
   different figure. Nothing else catches that, so it is asserted here.

   Every expected value below is built from the NB escape rather than a
   typed character, so this file contains no invisible whitespace either. */
import assert from 'node:assert/strict';
import { money, moneyCompact } from './utils.js';

const NB = '\u00A0';
const BREAKING = /\x20(?=Cr$|L$)/;

assert.equal(moneyCompact(4196200), `₹41.96${NB}L`);
assert.equal(moneyCompact(6480500), `₹64.81${NB}L`);
assert.equal(moneyCompact(12500000), `₹1.25${NB}Cr`);
assert.equal(moneyCompact(-4196200), `−₹41.96${NB}L`);

// Trailing .00 is dropped, and the gap survives that path too.
assert.equal(moneyCompact(5000000), `₹50${NB}L`);
assert.equal(moneyCompact(20000000), `₹2${NB}Cr`);

for (const value of [1e5, 4196200, 5000000, 1e7, 12500000, -9e6]) {
  assert.ok(!BREAKING.test(moneyCompact(value)), `breaking space in ${moneyCompact(value)}`);
}

// Below a lakh there is no unit at all, so no gap to protect.
assert.equal(moneyCompact(99999), '₹99,999');
assert.equal(moneyCompact(0), '₹0');

// The exact formatter stays untouched — it is what titles and aria labels read.
assert.equal(money(4196200), '₹41,96,200');
assert.equal(money(-1500), '−₹1,500');

console.log('money ok — compact units joined by a non-breaking space');
