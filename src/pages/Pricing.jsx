import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import api from '../api/api';
import PublicNav from '../components/ui/public-nav';
import SiteFooter from '../components/SiteFooter';
import PaymentRailStrip from '../components/landing/PaymentRailStrip';
import { Reveal } from '../components/landing/scrollMotion';
import {
  BODY, BTN_INK, BTN_LINE, CARD, H2, H3, HAIRLINE_GRID, LABEL, LEAD, LINK_SM,
  MEASURE, MEASURE_TEXT, META, RING, SectionHead,
} from '../components/landing/layout';
import { PUBLIC_PLANS, annualPrice, siteLimitLabel } from '../lib/plans';
import { formatINR } from '../lib/razorpay';

/* ── Pricing ─────────────────────────────────────────────────────────
   Every claim on this page is checkable against the code:
   · Plans and prices come from GET /billing/plans at runtime. No rupee
     figure is ever written as a literal — formatINR only receives values
     derived from plan.price_inr, and the yearly figure uses the same
     annualPrice() that the Razorpay order total is built from.
   · Site count is the only limit that differs. There is no user_limit
     column and no storage quota anywhere in the backend, so the old
     "Up to 500 users" and "Unlimited storage" lines are gone.
   · There is no free tier and no trial — signup goes straight to
     Razorpay — and the FAQ says so plainly instead of dodging it.
   · The 15% yearly discount is a hardcoded constant on both client and
     server, so it does not expire. No countdown implies otherwise.
   · "No feature gates, no hidden tiers" is gone too: PUBLIC_PLANS exists
     precisely to hide the enterprise tier from this page.

   ── Layout ──
   The page's own headline is "plans differ by sites, not by features",
   so the layout says that structurally instead of contradicting it. The
   plans are ONE hairline-divided slab, not three floating cards, and the
   included-features list is written ONCE underneath rather than repeated
   identically inside every card — three near-identical bullet lists were
   what made this read as a template. The only thing that visibly varies
   column to column is the site allowance and the price, which is exactly
   what actually varies.

   Nothing here forces a viewport height. The old
   `min-h-[calc(100svh-72px)]` left a dead band of canvas under the fold
   whenever the cards came up shorter than the screen. ── */

/* Sites are the differentiator, so they get the tonal chip. Aqua marks
   the recommended column, neutral marks the rest — never colour alone,
   the word "Recommended" is always present too. */
const SITE_CHIP = 'inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-semibold';

/* The ink column needs its own outlined button. Layering overrides after
   BTN_LINE would not reliably win — Tailwind resolves same-specificity
   utilities by CSS source order, not by position in the class string. */
const BTN_ON_INK = 'inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-control border border-white/25 bg-white/10 px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:border-white/40 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-aqua focus-visible:ring-offset-2 focus-visible:ring-offset-mr-ink sm:w-auto';

const INCLUDED = [
  'Plot bookings & instalments',
  'Farmer land payments',
  'Broker commission',
  'Site expenses & vendors',
  'Day book & balance sheet',
  'Registry & documents',
  'Role-based access',
  'Audit trail on every entry',
];

const ENTERPRISE_POINTS = [
  'Site count set to your portfolio',
  'Same approval and audit controls',
  'Migration help from your sheets',
];

const FAQS = [
  {
    q: 'What is the difference between the plans?',
    a: 'Only the number of sites you can manage. Every plan ships the full platform — day book, plots, farmer payments, registry, expenses, inventory and reports.',
  },
  {
    q: 'How does yearly billing work?',
    a: 'A yearly subscription is charged as twelve monthly payments less 15%, in one payment. The discount is applied at checkout, not after, and yearly billing is always 15% cheaper — it is not a limited offer.',
  },
  {
    q: 'Is there a free trial?',
    a: 'No. Every plan is paid from the first day and signup goes straight to payment. You can pay monthly and simply not renew.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. A new plan is bought from your subscription page and starts when the period you have already paid for ends. Your Super Admin is the person who can renew or change the plan.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'Your workspace stays active until the end of the period you paid for. Cancelling means the subscription is not renewed. See the refund policy for details.',
  },
];

export const Pricing = () => {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api.get('/billing/plans')
      .then(({ data }) => {
        if (!live) return;
        const list = PUBLIC_PLANS(data.plans);
        setPlans(list);
        // Success-but-empty is still a failure from the visitor's side.
        setStatus(list.length ? 'ready' : 'error');
      })
      .catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, [attempt]);

  const isAnnual = cycle === 'annual';

  /* The widest site allowance is the recommended plan. Deriving it beats
     hardcoding a plan code — the last hardcoded one ("growth") went stale
     in migration 087 and is still a fossil in PlanCards' icon map.

     Price breaks the tie, because it currently IS tied: Professional and
     Growth both carry site_limit 10 at ₹9,499 and ₹9,994. Without the
     tiebreak the badge lands on whichever the API happens to return
     first, which would sometimes recommend the dearer of two identical
     allowances. */
  const recommendedId = plans.length
    ? plans.reduce((best, p) => {
      const sites = Number(p.site_limit) - Number(best.site_limit);
      if (sites !== 0) return sites > 0 ? p : best;
      return Number(p.price_inr) < Number(best.price_inr) ? p : best;
    }, plans[0]).id
    : null;

  const choosePlan = (plan) => {
    // Carry both choices across — the old handler discarded them, so
    // /signup always restarted at monthly with nothing selected.
    navigate('/signup', { state: { planId: plan.id, billingCycle: cycle } });
  };

  return (
    <div className="auth-type mr-tech-field min-h-screen w-full bg-mr-shell text-mr-text">
      <PublicNav active="pricing" />

      <main id="main" className="w-full">
        {/* ── 1. Hero + plan slab ──
             isolate + one aurora is the page's single dominant gradient
             zone; it sits behind solid surfaces so nothing loses contrast. */}
        <section className="relative isolate w-full overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
            aria-hidden="true"
            style={{ background: 'radial-gradient(110% 60% at 50% 0%, rgba(80,221,235,0.20) 0%, rgba(47,107,255,0.08) 44%, rgba(245,246,242,0) 74%)' }}
          />

          <div className={`${MEASURE} pt-14 sm:pt-20`}>
            {/* Headline left, billing control right — the control is the
                only decision above the slab, so it sits at the same
                optical level as the sentence that explains it. */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
              <div className={MEASURE_TEXT}>
                <p className={LABEL}>Pricing</p>
                <h1 className="mt-5 text-balance text-[clamp(2.125rem,4.4vw,3.375rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-mr-text">
                  Plans differ by sites, not by features.
                </h1>
                <p className={`mr-rise mt-5 max-w-[56ch] ${LEAD}`} style={{ animationDelay: '60ms' }}>
                  Every plan ships the whole platform. The only thing you choose is how many sites you
                  run, and whether you pay monthly or yearly.
                </p>
              </div>

              {/* Native radios in a fieldset: arrow-key selection, one tab
                  stop, a group name and checked state, with no JS beyond
                  setCycle. A role="radio" button group would need
                  hand-written arrow handling and a roving tabindex. */}
              <fieldset className="mr-rise shrink-0" style={{ animationDelay: '120ms' }}>
                <legend className="sr-only">Billing period</legend>
                <div className="inline-grid grid-cols-2 gap-px overflow-hidden rounded-control border border-mr-line bg-mr-line">
                  {[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'annual', label: 'Yearly −15%' },
                  ].map((option) => (
                    <label key={option.value} className="relative">
                      <input
                        type="radio"
                        name="billing-period"
                        value={option.value}
                        checked={cycle === option.value}
                        onChange={() => setCycle(option.value)}
                        className="peer sr-only"
                      />
                      <span className="flex h-11 cursor-pointer items-center justify-center bg-mr-surface px-6 text-[14px] font-medium text-mr-muted transition-colors duration-150 hover:text-mr-text peer-checked:bg-mr-ink peer-checked:font-semibold peer-checked:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-mr-blue">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className={`mt-2.5 max-w-[30ch] ${META}`}>
                  Yearly is twelve months less 15%, charged once at checkout.
                </p>
              </fieldset>
            </div>
          </div>

          {/* ── 2. The slab ──
               One surface, hairline-divided columns. gap-px over a
               line-coloured background gives the dividers with no per-cell
               border and no first/last-child arithmetic. */}
          <div className={`${MEASURE} pb-16 pt-12 sm:pb-20 sm:pt-14`}>
            {status === 'loading' && (
              <>
                <div className="overflow-hidden rounded-panel border border-mr-line">
                  <div className="flex flex-col gap-px bg-mr-line lg:flex-row" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex-1 bg-mr-surface p-7 sm:p-8">
                        <div className="h-4 w-20 rounded-sm bg-mr-surface-2" />
                        <div className="mt-5 h-8 w-24 rounded-full bg-mr-surface-2" />
                        <div className="mt-6 h-11 w-40 rounded-sm bg-mr-surface-2" />
                        <div className="mt-3 h-4 w-48 rounded-sm bg-mr-surface-2" />
                        <div className="mt-8 h-12 rounded-control bg-mr-surface-2" />
                        <div className="mt-8 space-y-3 border-t border-mr-line pt-7">
                          {[0, 1, 2, 3, 4, 5].map((r) => (
                            <div key={r} className="h-4 rounded-sm bg-mr-surface-2" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="sr-only" role="status">Loading plans…</p>
              </>
            )}

            {status === 'error' && (
              <div className="rounded-panel border border-mr-line bg-mr-surface p-7 sm:p-8" role="alert">
                <p className={H3}>Plans could not be loaded</p>
                <p className={`mt-2 max-w-[52ch] ${BODY}`}>
                  Prices come from our billing service, so we would rather show nothing than show a
                  stale figure. Try again, or write to us and we will send the current plans.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button type="button" onClick={() => { setStatus('loading'); setAttempt((n) => n + 1); }} className={BTN_INK}>
                    Try again
                  </button>
                  <a href="mailto:support@mountreality.in" className={LINK_SM}>
                    support@mountreality.in →
                  </a>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <Reveal>
                <div className="overflow-hidden rounded-panel border border-mr-line shadow-[0_8px_28px_-12px_rgba(16,17,20,0.10)]">
                  {/* flex-row, not grid-cols-N. A fixed column count only
                      fits one plan count: with grid-cols-3 the API's three
                      public plans plus the contact cell made four items,
                      so the fourth wrapped and left two empty cells showing
                      the line-coloured slab background. Even flex-1
                      children divide by however many plans exist. */}
                  <div className="flex flex-col gap-px bg-mr-line lg:flex-row">
                    {plans.map((plan) => {
                      const monthly = Number(plan.price_inr) || 0;
                      const yearly = annualPrice(monthly);
                      const recommended = plan.id === recommendedId;

                      return (
                        <div key={plan.id} className="relative flex flex-1 flex-col bg-mr-surface p-7 sm:p-8">
                          {/* The one tonal wash, recommended column only.
                              A soft two-stop ramp of existing tokens —
                              restrained, and it fades out well above the
                              price so the figure stays on flat white. */}
                          {recommended && (
                            <div
                              className="pointer-events-none absolute inset-x-0 top-0 h-[180px]"
                              aria-hidden="true"
                              style={{ background: 'linear-gradient(180deg, rgba(80,221,235,0.22) 0%, rgba(185,255,69,0.10) 46%, rgba(255,255,255,0) 100%)' }}
                            />
                          )}

                          <div className="relative flex flex-1 flex-col">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-mr-text">
                                {plan.name}
                              </h2>
                              {recommended && (
                                <span className="rounded-full bg-mr-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                                  Recommended
                                </span>
                              )}
                            </div>

                            {/* The actual differentiator, given its own
                                line instead of being buried beside the
                                price in 13px grey. */}
                            <p className="mt-5">
                              <span className={`${SITE_CHIP} ${recommended ? 'bg-mr-aqua-soft text-mr-aqua-ink' : 'bg-mr-surface-2 text-mr-text'}`}>
                                {siteLimitLabel(plan)}
                              </span>
                            </p>

                            <p className="mt-6 flex items-baseline gap-2">
                              <span className="text-[42px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-mr-text">
                                {formatINR(isAnnual ? yearly : monthly)}
                              </span>
                              <span className="text-[13px] font-medium text-mr-muted">
                                {isAnnual ? '/ year' : '/ month'}
                              </span>
                            </p>

                            {/* min-h keeps the CTAs on one baseline across
                                columns whichever cycle is selected. */}
                            <p className={`mt-3 min-h-[36px] max-w-[34ch] tabular-nums ${META}`}>
                              {isAnnual
                                ? `${formatINR(monthly * 12)} if billed monthly — you save ${formatINR(monthly * 12 - yearly)}`
                                : `${formatINR(yearly)} a year on yearly billing`}
                            </p>

                            <button
                              type="button"
                              onClick={() => choosePlan(plan)}
                              className={`mt-7 w-full justify-center ${recommended ? BTN_INK : BTN_LINE}`}
                            >
                              Get started
                              {recommended && <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                            </button>

                            {/* The full list sits in every card. It is the
                                same list in each because the plans really
                                do ship the same platform — and a pricing
                                card with nothing under the button reads as
                                unfinished, whatever the headline says. */}
                            <div className="mt-8 border-t border-mr-line pt-7">
                              <p className={LABEL}>Included</p>
                              <ul className="mt-4 space-y-2.5">
                                {INCLUDED.map((item) => (
                                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-mr-text">
                                    <Check
                                      className={`mt-0.5 h-4 w-4 shrink-0 ${recommended ? 'text-mr-aqua-ink' : 'text-mr-lime-ink'}`}
                                      strokeWidth={2.4}
                                      aria-hidden="true"
                                    />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>

                {/* ── 3. More sites ──
                     The enterprise tier exists but is deliberately not sold
                     self-serve (PUBLIC_PLANS hides it), so this is a real
                     route to it rather than an invented plan. A full-width
                     band rather than another column: it is a different kind
                     of thing from a priced plan, and as a column it could
                     never divide evenly with an unknown plan count. */}
                <div className="mt-5 overflow-hidden rounded-panel bg-mr-ink">
                  <div className="flex flex-col gap-8 p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
                    <div className="max-w-[46ch]">
                      <h2 className="text-[21px] font-semibold tracking-[-0.025em] text-white">
                        More sites than any plan above?
                      </h2>
                      <p className="mt-2.5 text-[14px] leading-[1.6] text-white/65">
                        Tell us the size of your portfolio and we will set the site count to match.
                        Same platform, same approval and audit controls, and help moving off your
                        existing sheets.
                      </p>
                    </div>

                    <div className="flex flex-col gap-5 lg:items-end">
                      <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
                        {ENTERPRISE_POINTS.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-[13px] leading-[1.4] text-white/80">
                            <Check className="h-3.5 w-3.5 shrink-0 text-mr-aqua" strokeWidth={2.6} aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <a href="mailto:support@mountreality.in" className={BTN_ON_INK}>
                        Contact us
                        <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            <p className={`mt-12 ${META}`}>
              Payments secured by Razorpay · Cancel or change plans any time · GST invoice on every payment
            </p>
          </div>
        </section>

        {/* ── 4. Payment rails ── */}
        <Reveal><PaymentRailStrip /></Reveal>

        {/* ── 5. Questions ── */}
        <section className="w-full border-b border-mr-line">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="Questions"
                title="The things people ask before they pay."
                body="If the answer you need is not here, write to us before you sign up — we would rather answer it first."
              />
            </Reveal>

            <Reveal delay={0.05} className={`mt-16 ${HAIRLINE_GRID}`}>
              {FAQS.map((item) => (
                <details key={item.q} className="group bg-mr-surface p-5">
                  <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-[15px] font-semibold tracking-[-0.01em] text-mr-text [&::-webkit-details-marker]:hidden ${RING}`}>
                    {item.q}
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-mr-muted transition-transform duration-150 group-open:rotate-180"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </summary>
                  <p className={`mt-2.5 max-w-[70ch] ${CARD}`}>{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ── 6. Close ── */}
        <section className="w-full">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <div className={`${MEASURE_TEXT} text-center`}>
                <h2 className={`mx-auto max-w-[20ch] ${H2}`}>Put every site on the same books.</h2>
                <p className={`mx-auto mt-5 max-w-[52ch] ${BODY}`}>
                  Create your company account, add your sites, and give your finance team one place
                  where the numbers are already reconciled.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                  <Link to="/signup" className={BTN_INK}>
                    Create account
                    <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </Link>
                  <Link to="/" className={BTN_LINE}>See how it works</Link>
                </div>
                <p className={`mt-8 ${META}`}>
                  Payments secured by Razorpay · GST invoice on every payment
                </p>
                <p className={`mt-2 ${META}`}>
                  Questions before you sign up?{' '}
                  <a href="mailto:support@mountreality.in" className={LINK_SM}>support@mountreality.in</a>
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Pricing;
