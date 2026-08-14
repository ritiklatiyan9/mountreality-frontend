import { Link } from 'react-router-dom';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Clock, MapPin, TrendingDown, TrendingUp,
} from 'lucide-react';
import { CurrencyValue, StatusPill } from './primitives';
import { money } from '@/lib/utils';

/* ── Financial position ──────────────────────────────────────────────
   The panel states the period's cash arithmetic rather than scoring it:

       opening + incoming − outgoing = closing balance

   Every figure comes straight from the existing kpiCards query. The movement
   bar is proportional to gross activity and is paired with exact values. */
function FlowRow({ label, value, tone, icon, sign }) {
  const RowIcon = icon;
  const colour = tone === 'in' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2 text-[12px] text-white/60">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone === 'in' ? 'bg-emerald-400/15' : 'bg-red-400/15'}`}>
          <RowIcon className={`h-3.5 w-3.5 ${colour}`} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${colour}`} title={money(value)}>
        {sign}{money(Math.abs(value))}
      </span>
    </div>
  );
}

export function FinancialPositionPanel({
  balance, opening, incoming, outgoing, loading,
  /* The same arithmetic reads as "site balance" on the dashboard and
     "closing balance" on a statement — only the noun changes. */
  label = 'Site balance',
}) {
  const open = Number(opening) || 0;
  const inc = Number(incoming) || 0;
  const out = Number(outgoing) || 0;
  const bal = Number(balance) || 0;

  const net = inc - out;
  const gross = inc + out;
  const hasFlow = gross > 0;
  const inShare = hasFlow ? Math.min(97, Math.max(3, (inc / gross) * 100)) : 50;

  const description = loading
    ? `Loading ${label.toLowerCase()}`
    : `${label} ${money(bal)}. Opening ${money(open)}, incoming ${money(inc)}, outgoing ${money(out)}, `
      + (hasFlow ? `net ${net >= 0 ? 'up' : 'down'} ${money(Math.abs(net))} for the period.` : 'no approved movement in this period.');

  return (
    <figure className="m-0 w-full" role="group" aria-label={description}>
      {/* ── Closing balance ── */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-medium text-white/55">{label}</span>
        {!loading && hasFlow && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ring-1 ring-inset ${
              net >= 0
                ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/25'
                : 'bg-red-400/12 text-red-300 ring-red-400/25'
            }`}
            title={`${net >= 0 ? 'Net inflow' : 'Net outflow'} of ${money(Math.abs(net))} this period`}
          >
            {net >= 0
              ? <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              : <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />}
            {net >= 0 ? '+' : '−'}{money(Math.abs(net))}
          </span>
        )}
      </div>

      {loading
        ? <span className="mt-2 block h-10 w-44 animate-pulse rounded-md bg-white/10" />
        : <CurrencyValue value={bal} size="lg" tone="invert" className="mt-1.5" />}

      <div className="mt-4">
        <div className="flex h-2 w-full gap-1 overflow-hidden rounded-full" aria-hidden="true">
          {loading ? (
            <span className="h-full w-full animate-pulse rounded-full bg-white/10" />
          ) : hasFlow ? (
            <>
              <span className="h-full rounded-full bg-emerald-500" style={{ width: `${inShare}%` }} />
              <span className="h-full flex-1 rounded-full bg-red-500" />
            </>
          ) : (
            <span className="h-full w-full rounded-full bg-white/8" />
          )}
        </div>
        <div className="mt-1 divide-y divide-white/8">
        <FlowRow label="Credit" value={inc} tone="in" icon={ArrowDownLeft} sign="+" />
        <FlowRow label="Debit" value={out} tone="out" icon={ArrowUpRight} sign="−" />
        </div>
      </div>

      {/* ── The arithmetic that produced the number above ── */}
      <figcaption className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-[12px] text-white/55">
        <span>Opening balance</span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <span className="font-semibold text-white/85" title={money(open)}>{money(open)}</span>
          <ArrowRight className="h-3 w-3 text-white/35" strokeWidth={2.2} aria-hidden="true" />
          <span className="font-semibold text-white" title={money(bal)}>{money(bal)}</span>
        </span>
      </figcaption>

      {!loading && !hasFlow && (
        <p className="mt-2 text-[11.5px] text-white/40">No approved movement in this period.</p>
      )}
    </figure>
  );
}

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── Financial hero ──────────────────────────────────────────────────
   One surface: who you are and what you can do on the left, where the
   money stands on the right. The dark half is the financial half — the
   greeting banner is no longer a separate decorative block. ── */
export default function FinancialHero({
  userName, siteName, activeSites, pendingWork, pendingHref, periodLabel,
  kpi, loading, showBalance, onSelectBalance, actions, search,
}) {
  const position = (
    <FinancialPositionPanel
      balance={kpi?.siteBalance}
      opening={kpi?.openingBalance}
      incoming={kpi?.totalIncoming}
      outgoing={kpi?.totalOutgoing}
      loading={loading}
    />
  );

  return (
    /* Not overflow-hidden: the search results drop out of the bottom of
       this panel and a clip here beats any z-index they could carry. Both
       halves already round their own corners, so nothing needs clipping. */
    <section
      aria-labelledby="mr-hero-title"
      className="grid rounded-panel border border-mr-line bg-mr-surface lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.68fr)]"
    >
      {/* ── Context and actions ── */}
      <div className="relative flex flex-col justify-between gap-4 p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-t-panel opacity-70 lg:rounded-tr-none lg:rounded-l-panel"
          aria-hidden="true"
          style={{ background: 'radial-gradient(95% 80% at 0% 0%, rgba(80,221,235,0.26) 0%, rgba(185,255,69,0.16) 38%, rgba(255,255,255,0) 72%)' }}
        />
        <div className="relative min-w-0">
          <h1 id="mr-hero-title" className="text-[clamp(1.55rem,3vw,2.1rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-mr-text">
            {greeting()}, {userName || 'there'}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mr-muted">
            <span className="inline-flex items-center gap-1.5 font-medium text-mr-text">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mr-aqua opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mr-aqua" />
              </span>
              {siteName || 'No site selected'}
            </span>
            <span aria-hidden="true">·</span>
            <span>live overview · {periodLabel}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone="info" icon={MapPin}>{activeSites} active site{activeSites === 1 ? '' : 's'}</StatusPill>
            {pendingWork > 0 ? (
              <Link
                to={pendingHref}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-2"
              >
                <StatusPill tone="attention" icon={Clock} className="transition-colors hover:brightness-95">
                  {pendingWork} pending action{pendingWork === 1 ? '' : 's'}
                </StatusPill>
              </Link>
            ) : (
              <StatusPill tone="positive" icon={Clock}>No pending actions</StatusPill>
            )}
          </div>

          {actions && <div className="mt-4">{actions}</div>}
        </div>

        {search && <div className="relative">{search}</div>}
      </div>

      {/* ── Financial position ── */}
      {showBalance && (
        <div className="relative flex flex-col justify-center rounded-b-panel bg-mr-ink p-5 sm:p-6 lg:rounded-bl-none lg:rounded-r-panel">
          <div
            className="pointer-events-none absolute inset-0 rounded-b-panel lg:rounded-bl-none lg:rounded-r-panel"
            aria-hidden="true"
            style={{ background: 'radial-gradient(85% 65% at 78% 2%, rgba(80,221,235,0.30) 0%, rgba(47,107,255,0.16) 40%, rgba(16,17,20,0) 70%)' }}
          />
          {onSelectBalance ? (
            <button
              type="button"
              onClick={onSelectBalance}
              className="relative w-full rounded-panel-sm p-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-aqua"
              aria-label="Open site balance calculation"
            >
              {position}
            </button>
          ) : (
            <div className="relative p-2">{position}</div>
          )}
        </div>
      )}
    </section>
  );
}
