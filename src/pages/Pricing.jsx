import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import api from '../api/api';
import PublicNav from '../components/ui/public-nav';
import SiteFooter from '../components/SiteFooter';
import PaymentRailStrip from '../components/landing/PaymentRailStrip';
import { Reveal } from '../components/landing/scrollMotion';
import {
  BODY, BTN_INK, BTN_LINE, CARD, H2, H3, HAIRLINE_GRID, LEAD, LINK_SM,
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
     Razorpay — and the FAQ now says so plainly instead of dodging it.
   · The 15% yearly discount is a hardcoded constant on both client and
     server, so it does not expire. The countdown that implied it does
     is deleted.
   · "No feature gates, no hidden tiers" is gone too: PUBLIC_PLANS exists
     precisely to hide the enterprise tier from this page. ── */

/* Card accents. Only the recommended card carries a wash, and it is one
   soft three-stop ramp of existing tokens — restrained, not a rainbow. */
const CARD_TONE = {
  recommended: {
    wash: 'linear-gradient(180deg, rgba(80,221,235,0.30) 0%, rgba(185,255,69,0.16) 34%, rgba(255,255,255,0) 72%)',
    tick: 'text-mr-aqua-ink',
  },
  plain: { wash: null, tick: 'text-mr-lime-ink' },
};

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
     in migration 087 and is still a fossil in PlanCards' icon map. */
  const recommendedId = plans.length
    ? plans.reduce((best, p) => (Number(p.site_limit) > Number(best.site_limit) ? p : best), plans[0]).id
    : null;

  const choosePlan = (plan) => {
    // Carry both choices across — the old handler discarded them, so
    // /signup always restarted at monthly with nothing selected.
    navigate('/signup', { state: { planId: plan.id, billingCycle: cycle } });
  };

  return (
    <div className="auth-type min-h-screen w-full bg-mr-canvas text-mr-text">
      <PublicNav active="pricing" />

      <main id="main" className="w-full">
        {/* ── 1. Hero + plans — sized to land in one viewport ──
             min-h uses svh so mobile browser chrome does not push the
             cards below the fold on first paint. */}
        <section className="flex w-full flex-col lg:min-h-[calc(100svh-72px)]">
          <div className={`${MEASURE} pb-8 pt-10 sm:pb-10 sm:pt-14`}>
            <div className={MEASURE_TEXT}>
              <h1 className="text-balance text-[clamp(1.875rem,3.6vw,2.75rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-mr-text">
                Plans differ by sites, not by features.
              </h1>
              <p className={`mr-rise mt-4 max-w-[58ch] ${LEAD}`} style={{ animationDelay: '60ms' }}>
                Every plan ships the whole platform — day book, plot bookings, farmer payments,
                broker commission, registry and reports. The only thing you choose is how many sites
                you run, and whether you pay monthly or yearly.
              </p>

              {/* Native radios in a fieldset: arrow-key selection, one tab
                  stop, a group name and checked state, with no JS beyond
                  setCycle. A role="radio" button group would need
                  hand-written arrow handling and a roving tabindex. */}
              <fieldset className="mr-rise mt-6" style={{ animationDelay: '120ms' }}>
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
                      <span className="flex h-10 cursor-pointer items-center justify-center bg-mr-surface px-5 text-[14px] font-medium text-mr-muted transition-colors duration-150 hover:text-mr-text peer-checked:bg-mr-ink peer-checked:font-semibold peer-checked:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-mr-blue">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <p className={`mt-3 ${META}`}>
                Yearly is twelve months less 15%, charged once. The discount is applied at checkout,
                not after.
              </p>
            </div>
          </div>

          {/* ── 2. Plans ── */}
          <div className={`${MEASURE} pb-14 sm:pb-16`}>
            {status === 'loading' && (
              <>
                {/* Two placeholder cells, matching the two public plans —
                    the old three-cell skeleton reflowed into an empty gap. */}
                <div className={`${HAIRLINE_GRID} sm:grid-cols-2`} aria-busy="true">
                  {[0, 1].map((i) => (
                    <div key={i} className="bg-mr-surface p-5 sm:p-8">
                      <div className="h-5" />
                      <div className="mt-1 h-4 w-28 rounded-sm bg-mr-surface-2" />
                      <div className="mt-6 h-10 w-40 rounded-sm bg-mr-surface-2" />
                      <div className="mt-2 h-4 w-48 rounded-sm bg-mr-surface-2" />
                      <div className="mt-8 h-11 rounded-control bg-mr-surface-2" />
                    </div>
                  ))}
                </div>
                <p className="sr-only" role="status">Loading plans…</p>
              </>
            )}

            {status === 'error' && (
              <div className={HAIRLINE_GRID}>
                <div className="bg-mr-surface p-5 sm:p-8" role="alert">
                  <p className={H3}>Plans could not be loaded</p>
                  <p className={`mt-1.5 max-w-[52ch] ${BODY}`}>
                    Prices come from our billing service, so we would rather show nothing than show a
                    stale figure. Try again, or write to us and we will send the current plans.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-5">
                    <button type="button" onClick={() => { setStatus('loading'); setAttempt((n) => n + 1); }} className={BTN_INK}>
                      Try again
                    </button>
                    <a href="mailto:support@mountreality.in" className={LINK_SM}>
                      support@mountreality.in →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <Reveal className="grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => {
                  const monthly = Number(plan.price_inr) || 0;
                  const yearly = annualPrice(monthly);
                  const recommended = plan.id === recommendedId;
                  const tone = recommended ? CARD_TONE.recommended : CARD_TONE.plain;

                  return (
                    <div
                      key={plan.id}
                      className="relative flex flex-col overflow-hidden rounded-panel border border-mr-line bg-mr-surface"
                    >
                      {/* One soft wash, recommended card only */}
                      {tone.wash && (
                        <div
                          className="pointer-events-none absolute inset-x-0 top-0 h-[260px]"
                          aria-hidden="true"
                          style={{ background: tone.wash }}
                        />
                      )}

                      <div className="relative flex flex-1 flex-col p-6 sm:p-7">
                        <div className="flex items-baseline justify-between gap-3">
                          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-mr-text">{plan.name}</h2>
                          {recommended && (
                            <span className="rounded-full bg-mr-ink px-2.5 py-1 text-[12px] font-medium text-white">
                              Recommended
                            </span>
                          )}
                        </div>

                        <p className="mt-5 flex items-baseline gap-2">
                          <span className="text-[40px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-mr-text">
                            {formatINR(isAnnual ? yearly : monthly)}
                          </span>
                          <span className="text-[13px] leading-tight text-mr-muted">
                            {isAnnual ? 'per year' : 'per month'}
                            <br />
                            {siteLimitLabel(plan)}
                          </span>
                        </p>

                        <p className={`mt-2 min-h-[32px] tabular-nums ${META}`}>
                          {isAnnual
                            ? `${formatINR(monthly * 12)} billed monthly — you save ${formatINR(monthly * 12 - yearly)}`
                            : `${formatINR(yearly)}/year on yearly billing`}
                        </p>

                        <button
                          type="button"
                          onClick={() => choosePlan(plan)}
                          className={`mt-6 w-full justify-center ${recommended ? BTN_INK : BTN_LINE}`}
                        >
                          Get started
                          {recommended && <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
                        </button>

                        <ul className="mt-7 space-y-3 border-t border-mr-line pt-6">
                          {INCLUDED.slice(0, 6).map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-mr-text">
                              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tone.tick}`} strokeWidth={2.4} aria-hidden="true" />
                              {item}
                            </li>
                          ))}
                        </ul>

                        <p className={`mt-auto pt-6 ${META}`}>
                          Every feature on every plan · {siteLimitLabel(plan)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Third cell. The enterprise tier exists but is deliberately
                    not sold self-serve (PUBLIC_PLANS hides it), so this is a
                    real route to it rather than an invented plan. */}
                <div className="relative flex flex-col overflow-hidden rounded-panel border border-mr-line bg-mr-ink">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[260px]"
                    aria-hidden="true"
                    style={{ background: 'linear-gradient(180deg, rgba(80,221,235,0.22) 0%, rgba(47,107,255,0.12) 40%, rgba(16,17,20,0) 76%)' }}
                  />
                  <div className="relative flex flex-1 flex-col p-6 sm:p-7">
                    <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-white">More sites</h2>

                    <p className="mt-5 text-[40px] font-semibold leading-none tracking-[-0.045em] text-white">
                      Let&rsquo;s talk
                    </p>
                    <p className="mt-2 min-h-[32px] text-[12px] text-white/60">
                      For portfolios past the plans on the left
                    </p>

                    <a href="mailto:support@mountreality.in" className={`mt-6 w-full justify-center ${BTN_LINE}`}>
                      Contact us
                    </a>

                    <ul className="mt-7 space-y-3 border-t border-mr-aqua/25 pt-6">
                      {['Every feature on every plan', 'Site count set to your portfolio', 'Same approval and audit controls', 'Razorpay billing, GST invoiced', 'Migration help from your sheets', 'A person who answers the phone'].map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[14px] leading-[1.5] text-white">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-mr-aqua" strokeWidth={2.4} aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-auto pt-6 text-[12px] text-white/60">
                      Existing enterprise subscriptions renew as normal.
                    </p>
                  </div>
                </div>
              </Reveal>
            )}

            <p className={`mt-6 ${META}`}>
              Payments secured by Razorpay · Cancel or change plans any time · GST invoice on every payment
            </p>
          </div>
        </section>

        {/* ── 3. Payment rails ── */}
        <Reveal><PaymentRailStrip /></Reveal>

        {/* ── 4. Questions ── */}
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

        {/* ── 5. Close ── */}
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
