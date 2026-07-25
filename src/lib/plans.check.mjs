/* Run: node src/lib/plans.check.mjs
   The displayed yearly price must equal what Razorpay is asked to charge.
   These are the two live plan prices from migration 087. */
import assert from 'node:assert/strict';
import { PUBLIC_PLANS, annualPrice, siteLimitLabel } from './plans.js';

assert.equal(annualPrice(4999), 50990, 'starter yearly');
assert.equal(annualPrice(9499), 96890, 'professional yearly');
assert.equal(annualPrice(0), 0, 'missing price must not produce NaN');
assert.equal(annualPrice(undefined), 0);

// 15% off twelve months, stated the other way round.
assert.equal(annualPrice(4999), Math.round(4999 * 12 * 0.85));

assert.equal(PUBLIC_PLANS([{ code: 'enterprise' }, { code: 'starter' }]).length, 1, 'enterprise stays hidden');

assert.equal(siteLimitLabel({ site_limit: 1 }), '1 site');
assert.equal(siteLimitLabel({ site_limit: 10 }), '10 sites');
assert.equal(siteLimitLabel({ site_limit: 999999 }), 'Unlimited sites');

console.log('plans ok — starter ₹50,990/yr, professional ₹96,890/yr');
