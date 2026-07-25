import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import BrandMark from '@/components/BrandMark';

/* ── Public header — floating pill ───────────────────────────────────
   The shell is `sticky top-0` and transparent; the surface lives on the
   <nav>, which is rounded and inset. So it LOOKS like a floating pill
   with content scrolling under it, but it is still in flow — which means
   none of the five pages that mount it need padding-top compensation.
   `fixed` would require a per-page top pad and would break Login/SignUp's
   flex-1 panels.

   Still no backdrop-blur, and the reason is load-bearing: a non-`none`
   backdrop-filter makes the header a containing block for fixed
   descendants, which is why the mobile menu's `fixed inset-0` scrim once
   only covered the header's own strip.

   Every destination is a real route — the old /#platform anchors forced a
   full SPA reload from other pages and did nothing at all from the footer. ── */

const LINKS = [
  { to: "/pricing", label: "Pricing", key: "pricing" },
  { to: "/contact", label: "Contact", key: "contact" },
];

const PRIMARY =
  "inline-flex items-center rounded-control bg-mr-ink font-semibold text-white transition-colors duration-150 hover:bg-mr-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mr-canvas";

export default function PublicNav({
  active,
  compact = false,
}: { active?: string; compact?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll while the sheet is open, restoring the previous value
  // rather than blanking it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
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
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-5 sm:pt-4">
      <a
        href="#main"
        className="sr-only rounded-control bg-mr-ink px-4 py-2 text-[13px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-50"
      >
        Skip to content
      </a>

      <nav
        className={cn(
          "mx-auto flex h-12 items-center gap-4 rounded-full border border-mr-line bg-mr-surface/92 pl-4 pr-1.5",
          "shadow-[0_2px_10px_-4px_rgba(16,17,20,0.12)]",
          "sm:h-14 sm:gap-6 sm:pl-6 sm:pr-2",
          compact ? "max-w-[960px]" : "max-w-[1120px]",
        )}
        aria-label="Primary"
      >
        <Link
          to="/"
          className="flex items-center gap-2 rounded-sm text-[15px] font-semibold tracking-[-0.02em] text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
        >
          <BrandMark size="sm" />
          MountReality
        </Link>

        <div className="ml-auto hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={active === link.key ? "page" : undefined}
              className={cn(
                "rounded-sm text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2",
                active === link.key ? "text-mr-text" : "text-mr-muted hover:text-mr-text",
              )}
            >
              {link.label}
            </Link>
          ))}

          {showSignIn && (
            <Link
              to="/login"
              className="rounded-sm text-[14px] font-medium text-mr-muted transition-colors duration-150 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          )}

          {showSignUp && (
            <Link to="/signup" className={cn(PRIMARY, "h-10 rounded-full px-4 text-[13px]")}>
              Create account
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-mr-muted transition-colors duration-150 hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue sm:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
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
                className="flex h-10 w-10 items-center justify-center rounded-control text-mr-muted transition-colors hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-mr-line border-y border-mr-line">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3.5 text-[17px] font-medium text-mr-text"
                >
                  {link.label}
                </Link>
              ))}
              {showSignIn && (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block py-3.5 text-[17px] font-medium text-mr-text"
                >
                  Sign in
                </Link>
              )}
            </div>

            {showSignUp && (
              <Link
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className={cn(PRIMARY, "mt-6 h-11 w-full justify-center px-5 text-[14px]")}
              >
                Create account
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
