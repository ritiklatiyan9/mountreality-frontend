import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpenCheck, FileStack, Handshake,
  LandPlot, ReceiptText, ShieldCheck, Sprout,
} from 'lucide-react';
import SiteFooter from '../components/SiteFooter';
import CinematicHero from '../components/landing/CinematicHero';
import PaymentRailStrip from '../components/landing/PaymentRailStrip';
import {
  ApprovalFlowMock, FiledAgainstMock, RoleMatrixMock, ScreenshotMock,
} from '../components/landing/mockups';
import { Parallax, Reveal } from '../components/landing/scrollMotion';
import {
  BODY, BTN_LINE, BTN_PRIMARY, CARD, H2, H3, LINK_SM,
  MEASURE, MEASURE_TEXT, META, PANEL, SectionHead,
} from '../components/landing/layout';

/* ── MountReality landing ────────────────────────────────────────────
   Full-bleed. Sections own their backgrounds and borders; the inner
   MEASURE div owns gutters and width. See components/landing/layout.jsx.

   Type is the app's SF Pro stack throughout — no webfont, no second
   family. Emphasis inside a headline is carried by colour alone, which is
   the only device that does not change the letterforms. Blue is the page's
   primary action colour; ink is kept for the dark band. Cards share the
   PANEL treatment so every band's surfaces match.

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
    copy: 'An entry waits with its bill image and full history until someone with the authority signs it off. Nothing unreviewed reaches a report.',
  },
  {
    mock: <ScreenshotMock src="/compphoto/two.png" alt="MountReality figures recomputed for the selected period" />,
    title: 'One period, every site',
    copy: 'Change the range and every figure recomputes against the same approved ledger — one site, one phase, or the whole portfolio.',
  },
  {
    mock: <RoleMatrixMock />,
    title: 'Access that actually restricts',
    copy: 'A site manager sees their site. The accountant sees the books. Nobody sees everything by default.',
  },
];

/* One icon per module, one family, one weight — wayfinding for a
   six-item grid, not decoration. Each maps to the object the module
   records against. */
const MODULES = [
  { icon: LandPlot, title: 'Plot bookings & instalments', copy: 'Booking, instalment schedule and receipts per plot, with the buyer and the agent attached.' },
  { icon: Sprout, title: 'Farmer land payments', copy: 'What was committed against a survey number, what has been paid, and what is still owed.' },
  { icon: Handshake, title: 'Broker commission', copy: 'Commission per plot and per agent, recovered or paid, reconciled against the sale it came from.' },
  { icon: ReceiptText, title: 'Site expenses & vendors', copy: 'Vouchers with a bill image, a category and an approver — not a photo in someone’s phone.' },
  { icon: BookOpenCheck, title: 'Day book & balance sheet', copy: 'Cash and bank books that build themselves from approved entries, per site or consolidated.' },
  { icon: FileStack, title: 'Registry & documents', copy: 'Registry records mapped to the payment that funded them, with the paperwork stored alongside.' },
];

const CONTROLS = [
  { title: 'Roles that actually restrict', copy: 'A site manager sees their site. The accountant sees the books. Nobody sees everything by default.' },
  { title: 'A complete audit trail', copy: 'Who created it, who changed it, who approved it, and when — on every transaction, permanently.' },
  { title: 'Approval gates', copy: 'Unreviewed activity stays out of your reports until someone with the authority signs it off.' },
];

/* Mockups sit on a canvas inset inside each white panel: the tonal step
   is what keeps a white-on-white mock (RoleMatrix, ApprovalFlow) from
   losing its edge, and it reads as the app sitting on its own canvas. */
const MOCK_WELL = 'overflow-hidden rounded-panel-sm bg-mr-shell p-3';

export const Landing = () => {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);

  const openTour = () => dialogRef.current?.showModal();
  const closeTour = () => {
    videoRef.current?.pause();
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  return (
    <div className="auth-type mr-tech-field min-h-screen w-full bg-mr-shell text-mr-text">
      <main id="main" className="w-full">
        <CinematicHero />

        {/* ── 2. Payment rails — the honest logo wall ── */}
        <Reveal><PaymentRailStrip /></Reveal>

        {/* ── 3. How it works — three panels, one step each ── */}
        <section className="w-full">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="How it works"
                title="Recorded once, approved once, and the books are closed."
                body="The entry your site manager makes is the entry your accountant approves and the entry the balance sheet reads — no month-end assembly step left to get wrong."
              />
            </Reveal>

            <div className="mt-16 grid gap-5 sm:mt-20 lg:grid-cols-3">
              {FEATURE_CELLS.map((cell, index) => (
                <Reveal key={cell.title} delay={index * 0.07} className="h-full">
                  <div className={`${PANEL} flex h-full flex-col p-5 sm:p-6`}>
                    <div className={MOCK_WELL}>{cell.mock}</div>
                    <div className="flex flex-1 flex-col px-1 pb-1 pt-6">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mr-blue-soft text-[12px] font-semibold tabular-nums text-mr-blue" aria-hidden="true">
                        {index + 1}
                      </span>
                      <h3 className={`mt-3 ${H3}`}>{cell.title}</h3>
                      <p className={`mt-2 ${CARD}`}>{cell.copy}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <p className={`mt-8 ${META}`}>
              Interface fragments, shown with the same demo figures as the panel above.
            </p>
          </div>
        </section>

        {/* ── 4. The ledger — surface band, canvas cells ── */}
        <section className="w-full border-y border-mr-line bg-mr-paper">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="The ledger"
                title="Every figure walks back to the person who approved it."
                body="An audit trail is only useful if you can follow it in the direction you actually need — from a number in a report, back to the voucher, the bill image and the name on the approval."
              />
            </Reveal>

            <div className="mt-16 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <Reveal className="h-full">
                <div className="h-full rounded-panel border border-mr-line bg-mr-shell p-7 sm:p-9">
                  <h3 className={H3}>From a bill in someone&rsquo;s hand to a closed month</h3>
                  <p className={`mt-2.5 max-w-[44ch] ${CARD}`}>
                    Three states, in order, with a name against each one. Open any figure in a report
                    and walk back to the voucher and the person who approved it.
                  </p>
                  <Parallax distance={14} className="mt-8">
                    <ApprovalFlowMock />
                  </Parallax>
                </div>
              </Reveal>

              <Reveal delay={0.08} className="h-full">
                <div className="h-full rounded-panel border border-mr-line bg-mr-shell p-7 sm:p-9">
                  <h3 className={H3}>Filed against the thing it belongs to</h3>
                  <p className={`mt-2.5 max-w-[44ch] ${CARD}`}>
                    A payment attaches to the plot, the survey number, the vendor or the agent it
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

        {/* ── 5. The modules — one panel, hairline-divided cells ── */}
        <section className="w-full">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <SectionHead
                label="The modules"
                title="Built around how a colony actually runs."
                body="Not a general ledger with real-estate labels bolted on. Each module records the work as your team already does it, and writes back to the same books."
              />
            </Reveal>

            <Reveal delay={0.05} className={`mt-16 overflow-hidden ${PANEL}`}>
              <div className="grid gap-px bg-mr-line sm:grid-cols-2 lg:grid-cols-3">
                {MODULES.map((item) => (
                  <div key={item.title} className="group bg-mr-paper px-6 py-8 sm:px-8">
                    <span className="flex h-11 w-11 items-center justify-center rounded-control bg-mr-blue-soft text-mr-blue transition-colors duration-200 group-hover:bg-mr-blue group-hover:text-white">
                      <item.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <h3 className={`mt-5 ${H3}`}>{item.title}</h3>
                    <p className={`mt-2 max-w-[38ch] ${CARD}`}>{item.copy}</p>
                  </div>
                ))}
              </div>
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

        {/* ── 7. Close — a destination, not a footer ── */}
        <section className="w-full">
          <div className={`${MEASURE} py-24 sm:py-32`}>
            <Reveal>
              <div className={`relative isolate overflow-hidden px-6 py-16 text-center sm:px-10 sm:py-20 ${PANEL}`}>
                <div
                  className="pointer-events-none absolute inset-0 -z-10"
                  aria-hidden="true"
                  style={{ background: 'radial-gradient(60% 70% at 50% 0%, rgba(47,107,255,0.07) 0%, rgba(80,221,235,0.04) 45%, rgba(248,249,245,0) 78%)' }}
                />
                <div className={MEASURE_TEXT}>
                  <h2 className={`mx-auto max-w-[22ch] ${H2}`}>
                    Put every site on <span className="text-mr-blue">the same books.</span>
                  </h2>
                  <p className={`mx-auto mt-5 max-w-[52ch] ${BODY}`}>
                    Create your workspace, add your sites, and give your finance team one place where the
                    numbers are already reconciled.
                  </p>
                  <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                    <Link to="/signup" className={BTN_PRIMARY}>
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
