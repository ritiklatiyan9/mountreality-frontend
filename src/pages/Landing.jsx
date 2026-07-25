import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, ShieldCheck } from 'lucide-react';
import PublicNav from '../components/ui/public-nav';
import SiteFooter from '../components/SiteFooter';
import HeroWindow from '../components/landing/HeroWindow';
import PaymentRailStrip from '../components/landing/PaymentRailStrip';
import {
  ApprovalFlowMock, FiledAgainstMock, RoleMatrixMock, ScreenshotMock,
} from '../components/landing/mockups';
import { Parallax, Reveal } from '../components/landing/scrollMotion';
import { useSmoothScroll } from '../components/landing/useSmoothScroll';
import {
  BODY, BTN_INK, BTN_LINE, CARD, H1, H2, H3, HAIRLINE_GRID, LEAD, LINK_SM,
  MEASURE, MEASURE_TEXT, META, RING, SectionHead,
} from '../components/landing/layout';

/* ── MountReality landing ────────────────────────────────────────────
   Full-bleed. Sections own their backgrounds and borders; the inner
   MEASURE div owns gutters and width. See components/landing/layout.jsx.

   The product is the argument: HeroWindow mounts the app's own charts
   and gauge, and every mockup below is built from the app's real
   StatusPill and CurrencyValue, so the marketing surface cannot drift
   from the product.

   Honesty rules this page keeps:
   · Illustrative figures come only from demoLedger.js, are guarded by
     demoLedger.check.mjs, and carry a visible "demo data" caption.
   · The logo wall shows payment rails the product genuinely supports —
     never customer logos, which would be a fabricated endorsement.
   · There is no free tier and no trial (signup goes straight to
     Razorpay), so no "start free" or "no card required" claim appears.
   · Every claim here is verifiable against Pricing.jsx.  ── */

const FEATURE_CELLS = [
  {
    mock: <ScreenshotMock src="/compphoto/one.png" alt="MountReality approval queue, with entries waiting for sign-off" />,
    title: 'Approve before it posts',
    copy: 'An entry waits in pending with its bill image and its full history until someone with the authority signs it off. Nothing skips the queue, and nothing unreviewed reaches a report.',
  },
  {
    mock: <ScreenshotMock src="/compphoto/two.png" alt="MountReality figures recomputed for the selected period" />,
    title: 'One period, every site',
    copy: 'Change the range and every figure on the screen recomputes against the same approved ledger — one site, one phase, or the whole portfolio.',
  },
  {
    mock: <RoleMatrixMock />,
    title: 'Access that actually restricts',
    copy: 'A site manager sees their site. The accountant sees the books. Nobody sees everything by default.',
  },
];

const MODULES = [
  { title: 'Plot bookings & instalments', copy: 'Booking, instalment schedule and receipts per plot, with the buyer and the agent attached.' },
  { title: 'Farmer land payments', copy: 'What was committed against a survey number, what has been paid, and what is still owed.' },
  { title: 'Broker commission', copy: 'Commission per plot and per agent, recovered or paid, reconciled against the sale it came from.' },
  { title: 'Site expenses & vendors', copy: 'Vouchers with a bill image, a category and an approver — not a photo in someone’s phone.' },
  { title: 'Day book & balance sheet', copy: 'Cash and bank books that build themselves from approved entries, per site or consolidated.' },
  { title: 'Registry & documents', copy: 'Registry records mapped to the payment that funded them, with the paperwork stored alongside.' },
];

const CONTROLS = [
  { title: 'Roles that actually restrict', copy: 'A site manager sees their site. The accountant sees the books. Nobody sees everything by default.' },
  { title: 'A complete audit trail', copy: 'Who created it, who changed it, who approved it, and when — on every transaction, permanently.' },
  { title: 'Approval gates', copy: 'Unreviewed activity stays out of your reports until someone with the authority signs it off.' },
];

export const Landing = () => {
  // Eased native scrolling on desktop pointers; a no-op under
  // prefers-reduced-motion and on touch, where momentum already exists.
  useSmoothScroll();

  const dialogRef = useRef(null);
  const videoRef = useRef(null);

  const openTour = () => dialogRef.current?.showModal();
  const closeTour = () => {
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  return (
    <div className="auth-type min-h-screen w-full bg-mr-canvas text-mr-text">
      <PublicNav active="home" />

      <main id="main" className="w-full">
        {/* ── 1. Hero — centred, with the product cropped by the fold ── */}
        <section className="relative isolate w-full overflow-hidden pb-0 pt-16 sm:pt-24">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[620px]"
            aria-hidden="true"
            style={{ background: 'linear-gradient(180deg, rgba(245,246,242,0) 0%, rgba(80,221,235,0.16) 42%, rgba(185,255,69,0.12) 66%, rgba(47,107,255,0.10) 84%, rgba(245,246,242,0) 100%)' }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[460px]"
            aria-hidden="true"
            style={{ background: 'radial-gradient(120% 70% at 50% 100%, rgba(80,221,235,0.22) 0%, rgba(47,107,255,0.10) 46%, rgba(245,246,242,0) 76%)' }}
          />

          <div className={MEASURE}>
            <div className={`${MEASURE_TEXT} text-center`}>
              <Link
                to="/pricing"
                className={`mr-rise inline-flex items-center gap-1.5 rounded-full border border-mr-line bg-mr-surface py-1.5 pl-3.5 pr-2.5 text-[12px] font-medium text-mr-muted transition-colors hover:border-mr-line-strong hover:text-mr-text ${RING}`}
              >
                Every feature on every plan
                <ChevronRight className="h-3.5 w-3.5 text-mr-faint" strokeWidth={2.2} aria-hidden="true" />
              </Link>

              {/* No animation on the h1 — an element that starts at
                  opacity 0 is not an LCP candidate until it paints, so
                  animating the largest text costs measured load time. */}
              <h1 className={`mx-auto mt-7 max-w-[19ch] ${H1}`}>
                Every site&rsquo;s money on one set of books.
              </h1>

              <p className={`mr-rise mx-auto mt-6 max-w-[58ch] text-balance ${LEAD}`} style={{ animationDelay: '60ms' }}>
                Plot instalments, farmer land payouts, broker commission and site expenses — recorded
                where the work happens, approved before they post, and reported from one ledger.
              </p>

              <div className="mr-rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '120ms' }}>
                <Link to="/signup" className={BTN_INK}>
                  Create account
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </Link>
                <Link to="/pricing" className={BTN_LINE}>See pricing</Link>
              </div>

              <p className={`mr-rise mt-6 ${META}`} style={{ animationDelay: '180ms' }}>
                Monthly or yearly · Yearly is twelve months less 15% · GST invoice on every payment
              </p>
            </div>
          </div>

          {/* The crop: a fixed-height wrapper carries the mask, because
              mask percentages resolve against the masked element's own
              box — on the tall child the stop would land off-screen. */}
          <div className="relative mx-auto mt-16 w-full max-w-[1180px] px-5 sm:mt-20 sm:px-8">
            <div className="mr-fade-b relative h-[320px] overflow-hidden sm:h-[420px] lg:h-[500px]">
              <HeroWindow />
            </div>
            {/* Outside the mask on purpose — the ₹ figures are visible, so
                the demo-data caption must be too, and uncroppable. */}
            <p className={`pointer-events-none absolute inset-x-5 bottom-5 text-center sm:inset-x-8 ${META}`}>
              Illustrative figures on demo data. The gauge, charts and number formatting are the live
              product components.
            </p>
          </div>
        </section>

        {/* ── 2. Payment rails — the honest logo wall ── */}
        <Reveal><PaymentRailStrip /></Reveal>

        {/* ── 3. How it works ── */}
        <section className="w-full border-b border-mr-line">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="How it works"
                title="Recorded once, approved once, and the books are already closed."
                body="Nothing here is a separate reporting tool. The entry your site manager makes is the entry your accountant approves and the entry the balance sheet reads — so there is no month-end assembly step left to get wrong."
              />
            </Reveal>

            <div className={`mt-16 ${HAIRLINE_GRID} sm:mt-20 lg:grid-cols-3`}>
              {FEATURE_CELLS.map((cell, index) => (
                <Reveal key={cell.title} delay={index * 0.07} className="bg-mr-canvas">
                  <div className="px-6 py-10 sm:px-8">
                    {cell.mock}
                    <h3 className={`mt-8 text-center ${H3}`}>{cell.title}</h3>
                    <p className={`mx-auto mt-2.5 max-w-[34ch] text-center ${CARD}`}>{cell.copy}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <p className={`mt-8 ${META}`}>
              Interface fragments, shown with the same demo figures as the panel above.
            </p>
          </div>
        </section>

        {/* ── 4. The ledger ── */}
        <section className="w-full border-b border-mr-line">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="The ledger"
                title="Every figure walks back to the person who approved it."
                body="An audit trail is only useful if you can follow it in the direction you actually need — from a number in a report, back to the voucher, the bill image and the name on the approval."
              />
            </Reveal>

            <div className={`mt-16 ${HAIRLINE_GRID} lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]`}>
              <Reveal className="bg-mr-canvas">
                <div className="p-8 sm:p-10">
                  <h3 className={H3}>From a bill in someone&rsquo;s hand to a closed month</h3>
                  <p className={`mt-2.5 max-w-[44ch] ${CARD}`}>
                    Three states, in order, with a name against each one. The flow is the audit trail —
                    open any figure in a report and walk back to the voucher and the person who approved it.
                  </p>
                  <Parallax distance={14} className="mt-8">
                    <ApprovalFlowMock />
                  </Parallax>
                </div>
              </Reveal>

              <Reveal delay={0.08} className="bg-mr-canvas">
                <div className="p-8 sm:p-10">
                  <h3 className={H3}>Filed against the thing it belongs to</h3>
                  <p className={`mt-2.5 max-w-[44ch] ${CARD}`}>
                    A payment is attached to the plot, the survey number, the vendor or the agent it
                    concerns — not to a folder someone has to remember the name of.
                  </p>
                  <Parallax distance={18} className="mt-8">
                    <FiledAgainstMock />
                  </Parallax>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 5. The modules ── */}
        <section className="w-full border-b border-mr-line">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="The modules"
                title="Built around how a colony actually runs."
                body="Not a general ledger with real-estate labels bolted on. Each module records the work as your team already does it, and writes back to the same books."
              />
            </Reveal>

            <Reveal delay={0.05} className={`mt-16 ${HAIRLINE_GRID} sm:grid-cols-2 lg:grid-cols-3`}>
              {MODULES.map((item, index) => (
                <div key={item.title} className="bg-mr-canvas px-6 py-8 sm:px-8">
                  <span className="text-[12px] font-semibold tabular-nums text-mr-muted" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className={`mt-3 ${H3}`}>{item.title}</h3>
                  <p className={`mt-2 max-w-[38ch] ${CARD}`}>{item.copy}</p>
                </div>
              ))}
            </Reveal>

            <p className={`mt-8 ${META}`}>
              Access is per role — a site manager sees their site, the accountant sees the books.
            </p>
          </div>
        </section>

        {/* ── 6. Control — the one full-bleed ink band ── */}
        <section className="relative isolate w-full overflow-hidden bg-mr-ink">
          <Parallax distance={20} className="pointer-events-none absolute inset-0 -z-10">
            <div
              className="h-full w-full"
              aria-hidden="true"
              style={{ background: 'radial-gradient(70% 60% at 82% 0%, rgba(80,221,235,0.22) 0%, rgba(47,107,255,0.12) 42%, rgba(16,17,20,0) 74%)' }}
            />
          </Parallax>

          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="Control"
                labelClass="text-mr-aqua"
                title="Your controls hold as the portfolio grows."
                titleClass="text-white"
              />
              <p className="mt-6 max-w-[54ch] text-[15px] leading-[1.6] text-white/70 lg:ml-[196px]">
                Give every person the access they need for their job, and nothing beyond it — without
                losing the ability to see exactly what happened to a number.
              </p>

              <div className="mt-16 grid gap-8 sm:grid-cols-3 lg:ml-[196px]">
                {CONTROLS.map((item) => (
                  <div key={item.title} className="border-t border-mr-aqua/30 pt-6">
                    <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-white/70">{item.copy}</p>
                  </div>
                ))}
              </div>

              <p className="mt-12 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-mr-aqua lg:ml-[196px]">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Built for accountable teams
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── 7. Close ── */}
        <section className="w-full">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <div className={`${MEASURE_TEXT} text-center`}>
                <h2 className={`mx-auto max-w-[20ch] ${H2}`}>Put every site on the same books.</h2>
                <p className={`mx-auto mt-5 max-w-[52ch] ${BODY}`}>
                  Create your workspace, add your sites, and give your finance team one place where the
                  numbers are already reconciled.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                  <Link to="/signup" className={BTN_INK}>
                    Create account
                    <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </Link>
                  <Link to="/pricing" className={BTN_LINE}>See pricing</Link>
                </div>
                <p className={`mt-8 ${META}`}>
                  Payments secured by Razorpay · GST invoice on every payment · Cancel or change plans any time
                </p>
                <p className={`mt-2 ${META}`}>
                  Questions before you sign up?{' '}
                  <a href="mailto:support@mountreality.in" className={LINK_SM}>support@mountreality.in</a>
                  <span className="mx-2 text-mr-faint" aria-hidden="true">·</span>
                  <button type="button" onClick={openTour} className={LINK_SM}>
                    Watch the 12-second tour →
                  </button>
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Product tour — click to play, never autoplay. A native <dialog>
          brings its own focus trap, Esc handling and backdrop. */}
      <dialog
        ref={dialogRef}
        onClose={closeTour}
        className="w-[min(92vw,880px)] rounded-panel border border-mr-line bg-mr-surface p-2 backdrop:bg-mr-ink/50"
        aria-label="MountReality product tour"
      >
        <video
          ref={videoRef}
          src="/promo.mp4"
          controls
          playsInline
          preload="none"
          className="block w-full rounded-panel-sm"
        />
        <div className="flex justify-end p-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={`${LINK_SM} text-[13px]`}
          >
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
};

export default Landing;
