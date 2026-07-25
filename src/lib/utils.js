import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/* ── Indian rupee formatting ──────────────────────────────────────────
   money()        → ₹1,00,000 — exact, always safe to display.
   moneyCompact() → ₹1.25 Cr  — only where space forces it; the caller
                    must keep the exact value in a title/aria label. */
export function money(value) {
  const n = Number(value) || 0;
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function moneyCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.00$/, '')} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
