/* ── Public-page layout kit ──────────────────────────────────────────
   The landing page is full-bleed. The rule that keeps it readable:

     <section>  owns backgrounds, border-y, ink fills, washes — w-full
     <div MEASURE>  owns gutters and max-width — never a background

   Never put both on one element, and never use w-screen or 100vw: they
   overflow by the scrollbar width and give the page a horizontal
   scrollbar. w-full + inset-x-0 only. ── */

export const MEASURE = 'mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12';
export const MEASURE_TEXT = 'mx-auto w-full max-w-[760px]';

/* Type scale — nothing below 12px anywhere on the public site. */
export const H1 = 'text-balance text-[clamp(2.25rem,5.6vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-mr-text';
export const H2 = 'text-[clamp(1.875rem,3.6vw,3rem)] font-semibold leading-[1.04] tracking-[-0.042em] text-mr-text';
export const H3 = 'text-[17px] font-semibold tracking-[-0.02em] text-mr-text';
export const LEAD = 'text-[clamp(1rem,1.3vw,1.1875rem)] leading-[1.5] tracking-[-0.01em] text-mr-muted';
export const BODY = 'text-[15px] leading-[1.6] text-mr-muted';
export const CARD = 'text-[14px] leading-[1.6] text-mr-muted';
export const META = 'text-[12px] text-mr-muted';
export const LABEL = 'text-[12px] font-semibold uppercase tracking-[0.14em] text-mr-muted';

/* Focus rings — pick the one matching the surface the control sits on,
   so the offset ring is not drawn against the wrong colour. */
export const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mr-canvas';
export const RING_ON_SURFACE = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mr-surface';

export const BTN_INK = `inline-flex h-12 items-center gap-2 rounded-control bg-mr-ink px-6 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-mr-ink-2 ${RING}`;
export const BTN_LINE = `inline-flex h-12 items-center gap-2 rounded-control border border-mr-line bg-mr-surface px-6 text-[15px] font-semibold text-mr-text transition-colors duration-150 hover:border-mr-line-strong hover:bg-mr-surface-2 ${RING}`;
export const LINK_SM = `rounded-sm text-[12px] font-semibold text-mr-blue underline-offset-4 transition-colors hover:underline ${RING}`;

/* Hairline grid: gap-px over a line-coloured background gives dividers
   with no per-cell border and no first/last-child arithmetic. */
export const HAIRLINE_GRID = 'grid gap-px bg-mr-line';

/* ── Section head ────────────────────────────────────────────────────
   Tiny label pinned at the far left of the measure, then headline and
   body as two columns. `self-end` baselines the paragraph to the bottom
   of the headline block — that is what gives the layout its calm. */
export function SectionHead({ label, title, body, titleClass = '', labelClass = '' }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,148px)_minmax(0,1fr)] lg:gap-12">
      <p className={`${LABEL} ${labelClass}`}>{label}</p>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-14">
        <h2 className={`max-w-[22ch] ${H2} ${titleClass}`}>{title}</h2>
        {body && <p className={`max-w-[46ch] self-end ${BODY}`}>{body}</p>}
      </div>
    </div>
  );
}
