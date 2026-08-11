import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { DEMO_LEDGER } from './demoLedger';
import { LINK_SM, META, RING } from './layout';
import BrandMark from '../BrandMark';

/* ── Auth shell ──────────────────────────────────────────────────────
   The frame shared by /login and /signup: form on the left, a quiet
   proof panel on the right.

   The gap problem this fixes: the public header is a floating pill with
   its own `pt-3 sm:pt-4`, so page content that starts at `py-0` sits
   flush under a rounded, inset bar and reads as broken. Every public
   page below the pill needs its own top breathing room — that value
   lives here (`pt-10 sm:pt-14`) rather than being re-guessed per page.

   The right panel deliberately shows no rupee figures. A sign-in screen
   is the last place to advertise numbers a visitor cannot check, and
   the only honest ones we have are already labelled demo data on the
   landing page. It shows what the product does instead. ── */

const PROOF = [
  'Plot instalments, farmer payouts and commission in one ledger',
  'Nothing posts to the books until someone approves it',
  'Every entry keeps who recorded it, who changed it and when',
  'Per-role access — a site manager never sees the whole portfolio',
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="w-full">
      {/* Proof reads left, action sits right — the reading order lands the
          eye on the form last, which is where it should stop. The form
          STAYS FIRST IN THE DOM: the aside is decorative and hidden below
          lg, so keyboard and screen-reader users must reach the fields
          first, not the ink panel's link. `order` swaps only the visual. */}
      <div className="mx-auto grid w-full max-w-[1120px] items-start gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1fr)] lg:gap-16 lg:pb-24">
        {/* ── Form — a card, not fields floating on the page wash ── */}
        <div className="mx-auto w-full max-w-[440px] rounded-panel border border-mr-line bg-mr-paper p-6 shadow-[0_10px_32px_-18px_rgba(16,17,20,0.14)] sm:p-8 lg:order-2 lg:mx-0 lg:justify-self-end">
          <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-mr-text">
            {title}
          </h1>
          {subtitle && <p className="mt-2.5 text-[15px] leading-[1.6] text-mr-muted">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className={`mt-8 border-t border-mr-line pt-5 ${META}`}>{footer}</div>}
        </div>

        {/* ── Proof panel — hidden on small screens, where the form is
             the only thing that matters ── */}
        <aside className="relative hidden self-stretch overflow-hidden rounded-panel bg-mr-ink p-8 lg:order-1 lg:flex lg:flex-col lg:justify-between">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{ background: 'radial-gradient(75% 60% at 85% 0%, rgba(80,221,235,0.24) 0%, rgba(47,107,255,0.12) 42%, rgba(16,17,20,0) 74%)' }}
          />

          <div className="relative">
            <p className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-mr-aqua">
              <BrandMark size="md" />
              MountReality
            </p>
            <p className="mt-5 max-w-[26ch] text-[clamp(1.375rem,2vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
              One approved set of books for every site you build.
            </p>

            <ul className="mt-8 space-y-3.5">
              {PROOF.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.55] text-white/75">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-mr-aqua" strokeWidth={2.2} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-10 border-t border-mr-aqua/25 pt-6">
            <p className="text-[12px] text-white/60">
              Built for colony and land developers running more than one site.
              <br />
              Currently modelled on {DEMO_LEDGER.site.split(' · ')[0]} — see the{' '}
              <Link to="/" className={`${LINK_SM} text-mr-aqua ${RING}`}>live figures on the home page</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
