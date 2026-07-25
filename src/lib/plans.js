/** Plans that are no longer sold self-serve. Existing subscribers keep theirs —
 * this only hides the card on /pricing and the signup flow, so an Enterprise
 * customer can still see and renew their plan on /subscription. */
const HIDDEN_PLAN_CODES = ['enterprise'];

export const PUBLIC_PLANS = (plans = []) => plans.filter((p) => !HIDDEN_PLAN_CODES.includes(p.code));

export default PUBLIC_PLANS;

/* ── Money, in one place ─────────────────────────────────────────────
   Mirrors billedAmount() in billing.controller.js, which is
   Math.round(price * 12 * (1 - ANNUAL_DISCOUNT_PERCENT/100)) with
   ANNUAL_DISCOUNT_PERCENT = 15. The 0.85 used to be written out
   separately in PlanCards and Pricing; two copies of a number that has
   to equal what Razorpay actually charges is one copy too many.
   Guarded by plans.check.mjs. */
export const annualPrice = (monthlyInr) => Math.round((Number(monthlyInr) || 0) * 12 * 0.85);

/** Sites are the only limit that differs between plans. 999999 is the
 *  unlimited sentinel seeded by migration 087. */
export const siteLimitLabel = (plan) => {
  const limit = Number(plan?.site_limit) || 0;
  if (limit >= 999999) return 'Unlimited sites';
  return `${limit} site${limit === 1 ? '' : 's'}`;
};
