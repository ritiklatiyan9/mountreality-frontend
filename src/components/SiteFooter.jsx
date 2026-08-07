import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';

/* ── Public footer ───────────────────────────────────────────────────
   Light, three rows, no dark slab. The old #080e1a block was a fifth
   black matching neither the page nor the app, and every contrast
   failure on the public site lived inside it — slate-600 on #080e1a is
   2.5:1. Every colour here is mr-text or mr-muted (5.1:1 on canvas).

   The three /#platform links are gone rather than fixed: as react-router
   <Link>s they navigated without ever scrolling to the section, so all
   three were silently inert. ── */

const PRODUCT = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
  { to: '/login', label: 'Sign in' },
  { to: '/signup', label: 'Create account' },
];

const LEGAL = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/refund', label: 'Refund Policy' },
  { to: '/shipping', label: 'Delivery Policy' },
];

const LINK = 'rounded-sm text-mr-muted transition-colors duration-150 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2';

export const SiteFooter = () => (
  <footer className="border-t border-mr-line bg-mr-shell py-12">
    <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-6">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-sm text-[15px] font-semibold tracking-[-0.02em] text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
          >
            <BrandMark size="md" />
            MountReality
          </Link>
          <p className="mt-2 max-w-[46ch] text-[13px] text-mr-muted">
            One approved set of books for colony and land developers running multiple sites.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {PRODUCT.map((link) => (
            <Link key={link.to} to={link.to} className={LINK}>{link.label}</Link>
          ))}
        </nav>
      </div>

      <nav aria-label="Legal" className="mt-10 flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-mr-line pt-6 text-[12px]">
        {LEGAL.map((link, index) => (
          <span key={link.to} className="inline-flex items-center gap-1">
            {index > 0 && <span className="text-mr-faint" aria-hidden="true">·</span>}
            <Link to={link.to} className={LINK}>{link.label}</Link>
          </span>
        ))}
      </nav>

      <p className="mt-4 text-[12px] text-mr-muted">
        © {new Date().getFullYear()} MountReality ·{' '}
        <a href="mailto:support@mountreality.in" className={LINK}>support@mountreality.in</a>
      </p>
    </div>
  </footer>
);

export default SiteFooter;
