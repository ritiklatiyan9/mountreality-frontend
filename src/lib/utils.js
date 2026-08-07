import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/* ── Indian rupee formatting ──────────────────────────────────────────
   money()        → ₹1,00,000 — exact, always safe to display.
   moneyCompact() → ₹1.25 Cr  — only where space forces it; the caller
                    must keep the exact value in a title/aria label.

   The gap before Cr/L is a non-breaking space (NB below), written as an
   escape so a whitespace-trimming editor cannot silently undo it: with an
   ordinary space a narrow column wraps between the number and its unit, so
   "₹64.81 L" renders as "₹64.81" over "L" and reads as a different
   figure. Fixed here rather than at the ~30 call sites. */
const NB = '\u00A0';
export function money(value) {
  const n = Number(value) || 0;
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function moneyCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.00$/, '')}${NB}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.00$/, '')}${NB}L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
