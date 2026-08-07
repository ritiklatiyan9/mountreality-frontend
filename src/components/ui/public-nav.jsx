import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LogIn, Menu, MessageSquare, Tag, X } from "lucide-react";

import { cn } from "@/lib/utils";
import BrandMark from '@/components/BrandMark';
import { MEASURE } from '@/components/landing/layout';

/* ── Public header — full-bleed bar ──────────────────────────────────
   Edge-to-edge and flush to the top: no outer inset, no max-width, no
   radius. It stays `sticky top-0` and in flow — which means none of the
   five pages that mount it need padding-top compensation. `fixed` would
   require a per-page top pad and would break Login/SignUp's flex-1
   panels.

   Still no backdrop-blur, and the reason is load-bearing: a non-`none`
   backdrop-filter makes the header a containing block for fixed
   descendants, which is why the mobile menu's `fixed inset-0` scrim once
   only covered the header's own strip.

   Every destination is a real route — the old /#platform anchors forced a
   full SPA reload from other pages and did nothing at all from the footer. ── */

const LINKS = [
  { to: "/pricing", label: "Pricing", key: "pricing", icon: Tag },
  { to: "/contact", label: "Contact", key: "contact", icon: MessageSquare },
];

const PRIMARY =
  "inline-flex items-center rounded-control bg-mr-blue-deep font-semibold text-white transition-colors duration-150 hover:bg-mr-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mr-canvas";

/* One shared shape for the quiet header controls, so the links, Sign in and
   the menu button share a hit area and a hover surface. */
const NAV_ITEM =
  "group flex h-10 items-center gap-2 rounded-control px-3 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mr-canvas";

/* ── Where the product lives ─────────────────────────────────────────
   Set VITE_CONSOLE_URL (e.g. https://console.mountreality.com) and the
   two account entry points leave the marketing origin as full page
   loads. Leave it unset — local dev, previews, and the current
   single-origin deploy — and they stay client-side routes, so the split
   can be switched on per environment without a code change.

   A full navigation is the point, not a limitation: crossing to another
   origin must not carry SPA state, and the console gets to serve its own
   CSP and its own cookie scope on arrival. ── */
const CONSOLE_URL = import.meta.env.VITE_CONSOLE_URL;

function AppLink({ to, className, onClick, children }) {
  if (CONSOLE_URL) {
    return (
      <a href={`${CONSOLE_URL.replace(/\/$/, "")}${to}`} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return <Link to={to} className={className} onClick={onClick}>{children}</Link>;
}

function SignInLink({ className, onClick, children }) {
  return <AppLink to="/login" className={className} onClick={onClick}>{children}</AppLink>;
}

export default function PublicNav({ active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Lock body scroll while the sheet is open, restoring the previous value
  // rather than blanking it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const showSignIn = active !== "login";
  const showSignUp = active !== "signup";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-mr-line bg-mr-surface">
      <a
        href="#main"
        className="sr-only rounded-control bg-mr-ink px-4 py-2 text-[13px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-50"
      >
        Skip to content
      </a>

      {/* The BAR is full-bleed; its CONTENT sits on the same measure as the
          page, so the wordmark starts on the same line as the headline under
          it. Its own px- scale drifted from MEASURE by 43px at 1470 and by
          268px at 1920 — the logo floated out into the margin on any wide
          screen. Importing the constant is the point: two copies of the
          gutter is how it came apart the first time. */}
      <nav
        className={cn(MEASURE, "flex h-16 items-center gap-4 sm:h-[68px] sm:gap-8")}
        aria-label="Primary"
      >
        <Link
          to="/"
          className="flex items-center gap-2 rounded-sm text-[15px] font-semibold tracking-[-0.02em] text-mr-text transition-opacity duration-150 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
        >
          <BrandMark size="sm" />
          MountReality
        </Link>

        <div className="ml-auto hidden items-center gap-1 sm:flex">
          {/* Icon + label in one padded hit area: the row reads as a set of
              controls rather than bare text, and the active page carries a
              filled surface instead of a colour-only difference. */}
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={active === link.key ? "page" : undefined}
              className={cn(
                NAV_ITEM,
                active === link.key
                  ? "bg-mr-surface-2 text-mr-text"
                  : "text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text",
              )}
            >
              <link.icon
                className={cn(
                  "h-[17px] w-[17px] transition-colors duration-150",
                  active === link.key ? "text-mr-blue" : "text-mr-faint group-hover:text-mr-blue",
                )}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              {link.label}
            </Link>
          ))}

          {/* Pricing and Contact are pages; Sign in and Create account are
              your account. Without the rule they read as one row of four
              equal links and Sign in gets lost among the marketing pages. */}
          {showSignIn && (
            <>
              <span className="mx-2 h-5 w-px bg-mr-line" aria-hidden="true" />
              <SignInLink className={cn(NAV_ITEM, "text-mr-muted hover:bg-mr-surface-2 hover:text-mr-text")}>
                <LogIn
                  className="h-[17px] w-[17px] text-mr-faint transition-colors duration-150 group-hover:text-mr-blue"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                Sign in
              </SignInLink>
            </>
          )}

          {showSignUp && (
            <AppLink to="/signup" className={cn(PRIMARY, "group ml-2 h-10 gap-1.5 rounded-control px-5 text-[13.5px]")}>
              Create account
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </AppLink>
          )}
        </div>

        {/* A bordered surface rather than a bare glyph: it reads as a
            control, and the 44px box clears the minimum touch target
            while the icon itself stays optically 20px. */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-control border border-mr-line bg-mr-surface text-mr-text transition-colors duration-150 hover:border-mr-line-strong hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue sm:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </nav>

      {/* Conditionally rendered — a closed menu left in the DOM with
          opacity-0 kept 8 invisible, aria-hidden tab stops in the tab order. */}
      {menuOpen && (
        <div className="sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-mr-ink/30"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed inset-x-3 top-3 z-50 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-panel border border-mr-line bg-mr-surface p-4 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] text-mr-text">
                <BrandMark size="sm" />
                MountReality
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-control border border-mr-line bg-mr-surface text-mr-text transition-colors hover:border-mr-line-strong hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-mr-line border-y border-mr-line">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 py-3.5 text-[17px] font-medium text-mr-text"
                >
                  <link.icon className="h-5 w-5 shrink-0 text-mr-blue" strokeWidth={1.9} aria-hidden="true" />
                  {link.label}
                </Link>
              ))}
              {showSignIn && (
                <SignInLink
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 py-3.5 text-[17px] font-medium text-mr-text"
                >
                  <LogIn className="h-5 w-5 shrink-0 text-mr-blue" strokeWidth={1.9} aria-hidden="true" />
                  Sign in
                </SignInLink>
              )}
            </div>

            {showSignUp && (
              <AppLink
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className={cn(PRIMARY, "mt-6 h-11 w-full justify-center px-5 text-[14px]")}
              >
                Create account
              </AppLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
