import { Link } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';

/* ── Cinematic hero ──────────────────────────────────────────────────
   Fullscreen hero over a still backdrop. No state and no effects: the
   image needs neither, which is why the whole rAF fade-loop, the
   `ended` restart timer and the reduced-motion branch that the video
   version carried are all gone rather than left dormant.

   The backdrop is decorative — the headline beside it already says what
   the page is — so it takes an empty alt and stays out of the
   accessibility tree instead of announcing a filename. ── */

const BG_SRC = '/bg.png';

const INK = '#000000';
const GREY = '#666666'; // spec says #6F6F6F; 4.31 on the shell, this is 4.93

/* Real routes only. The reference design's Studio / About / Journal have
   nowhere to go in this app, and a nav item that 404s is worse than a
   shorter nav. */
const LINKS = [
  { to: '/', label: 'Home', current: true },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

const PILL = 'rounded-full text-white transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2';
/* Two fills on one geometry: blue for signing in, black for the primary.
   mr-blue-deep rather than mr-blue — white on #2f6bff measures 4.4988,
   a hair under the 4.5 a 14px label needs. */
const CTA_BLUE = `${PILL} bg-mr-blue-deep hover:bg-mr-blue`;
const CTA_INK = `${PILL} bg-black`;

export default function CinematicHero() {
  /* The section itself is transparent on purpose: the page root already
     paints mr-tech-field, and repeating it here would stack two copies of
     the same gradient and make the hero visibly more saturated than
     everything below it. */
  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* ── Backdrop (z-0) ──
          A mask fades the bed top and bottom rather than covering it
          with a shell-coloured gradient. An overlay only hides the edge
          while the colour behind happens to match — which is exactly how
          a seam appeared when the palette was retinted. A mask dissolves
          the image into whatever is actually behind it, on any
          background.

          The offset scales with the viewport: a flat 300px left the bed
          only ~530px tall on a laptop, a 2.8:1 letterbox that
          object-cover had to crop about a third of the frame to fill. */}
      <div
        className="pointer-events-none absolute z-0"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          /* Same idea as .mr-fade-y, but the bottom stop moves 80% → 94%.
             The shared class dissolves the last fifth of the bed, and
             against a shell this light that reads as haze washing the
             terrace and the road out of the render. Set here rather than
             on the class because the mockup wells still want the long
             fade. */
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 15%, #000 94%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 15%, #000 94%, transparent 100%)',
        }}
        aria-hidden="true"
      >
        {/* Almost certainly the LCP element, so it is eager and
            high-priority — the defaults would let the browser discover it
            late and schedule it behind the JS. */}
        <img
          src={BG_SRC}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
          style={{ filter: 'brightness(0.85) saturate(0.78)' }}
        />
      </div>

      {/* ── Navigation (z-10) ── */}
      <header className="relative z-10">
        <nav
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-4 px-8 py-6"
          aria-label="Primary"
        >
          <Link
            to="/"
            className="flex items-center gap-2.5 text-3xl tracking-tight transition-opacity duration-150 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
            style={{ color: INK }}
          >
            <BrandMark size="md" />
            <span>MountReality<sup className="text-[0.5em] align-super">®</sup></span>
          </Link>

          {/* Order swaps on mobile so the links wrap to their own row
              underneath rather than being dropped — the footer carries no
              nav, so hiding them would strand phone visitors. */}
          <div className="order-3 flex w-full items-center gap-6 sm:order-2 sm:w-auto sm:gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={link.current ? 'page' : undefined}
                className="text-sm transition-colors hover:!text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
                style={{ color: link.current ? INK : GREY }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="order-2 flex items-center gap-2.5 sm:order-3">
            <Link to="/login" className={`${CTA_BLUE} px-6 py-2.5 text-sm`}>
              Sign in
            </Link>
            <Link to="/signup" className={`${CTA_INK} px-6 py-2.5 text-sm`}>
              Begin Journey
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero (z-10) ── */}
      <div
        className="relative z-10 flex flex-col items-center justify-center px-6 pb-40 text-center"
        style={{ paddingTop: 'calc(8rem + 60px)' }}
      >
        <h1
          className="animate-fade-rise max-w-full whitespace-nowrap font-normal"
          style={{ color: INK, lineHeight: 0.95, letterSpacing: '-2.46px', fontSize: 'clamp(1.5rem, 4.2vw, 6rem)' }}
        >
          Every plot. Every payment.{' '}
          <span style={{ color: GREY }}>One clear ledger.</span>
        </h1>

        <p
          className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed sm:text-lg"
          style={{ color: GREY }}
        >
          Track sales, land payouts, commissions and site costs in one place.
        </p>

        <Link to="/signup" className={`${CTA_INK} animate-fade-rise-delay-2 mt-12 px-14 py-5 text-base`}>
          Begin Journey
        </Link>
      </div>
    </section>
  );
}
