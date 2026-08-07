import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { FinancialPositionPanel } from '../dashboard/FinancialHero';
import { CurrencyValue } from '../dashboard/primitives';
import { BALANCE_SERIES, COLLECTION_MIX, DEMO_LEDGER, MONTHS, OPENING } from './demoLedger';
import { money, moneyCompact } from '@/lib/utils';

/* ── Demo ledger panel ───────────────────────────────────────────────
   The landing page's one piece of product proof. It mounts the app's own
   FinancialPositionPanel and CurrencyValue, and draws its charts with the
   same Recharts styling the dashboard uses (aqua in, coral out, lime
   profit, hairline grid, no legend) — so the marketing surface and the
   product cannot visually drift apart.

   Every figure comes from ./demoLedger, shared with the hero card and
   guarded by demoLedger.check.mjs, so the two surfaces cannot disagree
   and the arithmetic cannot silently drift. ── */

const { incoming: INCOMING, outgoing: OUTGOING, closing: CLOSING } = DEMO_LEDGER;

// 12px / mr-muted — axis ticks are readable text, so mr-faint (2.6:1) is wrong.
const AXIS = { fontSize: 12, fill: '#626b7a' };
const TOOLTIP = {
  borderRadius: 14,
  border: '1px solid rgba(16,17,20,0.08)',
  boxShadow: '0 8px 24px rgba(16,17,20,0.08)',
  fontSize: 12,
  padding: '8px 10px',
};
const AQUA = '#22b8cc';
const CORAL = '#ff654a';
const LIME = '#8ac52a';
const INK = '#101114';

const compactAxis = (value) => {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(abs / 1e5).toFixed(0)}L`;
  if (abs >= 1e3) return `${(abs / 1e3).toFixed(0)}K`;
  return abs;
};

export default function DemoLedgerPanel() {
  const mixTotal = COLLECTION_MIX.reduce((sum, row) => sum + row.value, 0);

  return (
    /* Container queries, not viewport breakpoints. This panel used to span
       the page, so `lg:` and its own width meant the same thing; inside the
       hero column they do not, and a `lg:` split fired on a 1400px viewport
       while the panel itself was only 660px — which is what crushed the
       three figures below into two-line fragments. Everything here now
       measures the panel, so it is correct at any width it is dropped into. */
    <div className="@container grid overflow-hidden rounded-panel border border-mr-line bg-mr-surface @xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)]">
      {/* ── Left: the analytics ── */}
      <div className="@container flex flex-col gap-6 p-5 @2xl:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Demo Colony · Phase II</p>
          <p className="text-[12px] text-mr-muted">{DEMO_LEDGER.period}</p>
        </div>

        {/* Three figures, hairline separated. Three-across needs ~130px a
            cell before "Closing balance" starts wrapping under its own dot,
            so below that the strip becomes label-left / figure-right rows
            rather than three crushed columns. */}
        <div className="grid gap-px overflow-hidden rounded-panel-sm border border-mr-line bg-mr-line @md:grid-cols-3">
          {[
            { label: 'Collected', value: INCOMING, tone: 'default', dot: 'bg-mr-aqua-ink' },
            { label: 'Paid out', value: OUTGOING, tone: 'negative', dot: 'bg-mr-coral' },
            { label: 'Closing balance', value: CLOSING, tone: 'positive', dot: 'bg-mr-lime-ink' },
          ].map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-3 bg-mr-surface px-4 py-3 @md:block @md:p-4"
            >
              <p className="flex items-center gap-1.5 text-[12px] text-mr-muted">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${metric.dot}`} aria-hidden="true" />
                {metric.label}
              </p>
              <CurrencyValue
                value={metric.value}
                size="sm"
                tone={metric.tone}
                className="@md:mt-1"
                compactAbove={1e5}
              />
            </div>
          ))}
        </div>

        {/* Money in vs money out */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium text-mr-text">Money in vs money out</p>
            <div className="flex items-center gap-4 text-[12px] text-mr-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: AQUA }} aria-hidden="true" /> In
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CORAL }} aria-hidden="true" /> Out
              </span>
            </div>
          </div>
          <div
            className="mt-3 h-40 w-full"
            role="img"
            aria-label={`Monthly money in versus money out, December to May. Total in ${money(INCOMING)}, total out ${money(OUTGOING)}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHS} barGap={3} barCategoryGap="26%">
                <CartesianGrid stroke="rgba(16,17,20,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={44} />
                <Tooltip
                  cursor={{ fill: 'rgba(16,17,20,0.04)' }}
                  contentStyle={TOOLTIP}
                  formatter={(value, name) => [money(value), name === 'in' ? 'Money in' : 'Money out']}
                  labelStyle={{ fontWeight: 600, color: INK }}
                />
                <Bar dataKey="in" name="in" fill={AQUA} radius={[8, 8, 2, 2]} maxBarSize={22} />
                <Bar dataKey="out" name="out" fill={CORAL} radius={[8, 8, 2, 2]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Balance trend — derived from the same series */}
        <div>
          <p className="text-[13px] font-medium text-mr-text">Closing balance, month by month</p>
          <div
            className="mt-3 h-28 w-full"
            role="img"
            aria-label={`Closing balance trend, rising from ${money(BALANCE_SERIES[0].balance)} in December to ${money(CLOSING)} in May.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BALANCE_SERIES}>
                <defs>
                  {/* aqua → lime, the same pair the app's gauge sweeps through */}
                  <linearGradient id="mr-landing-balance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AQUA} stopOpacity={0.38} />
                    <stop offset="55%" stopColor={LIME} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mr-landing-balance-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={AQUA} />
                    <stop offset="100%" stopColor={LIME} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(16,17,20,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={44} />
                <Tooltip
                  cursor={{ stroke: 'rgba(16,17,20,0.16)' }}
                  contentStyle={TOOLTIP}
                  formatter={(value) => [money(value), 'Closing balance']}
                  labelStyle={{ fontWeight: 600, color: INK }}
                />
                <Area
                  type="natural"
                  dataKey="balance"
                  stroke="url(#mr-landing-balance-line)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#mr-landing-balance)"
                  dot={false}
                  activeDot={{ r: 5, fill: LIME, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Where the collections came from */}
        <div>
          <p className="text-[13px] font-medium text-mr-text">Where the collections came from</p>
          <div
            className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={COLLECTION_MIX.map((r) => `${r.label} ${money(r.value)}`).join(', ')}
          >
            {COLLECTION_MIX.map((row) => (
              <span
                key={row.label}
                className={`h-full ${row.tone}`}
                style={{ width: `${(row.value / mixTotal) * 100}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {COLLECTION_MIX.map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex min-w-0 items-center gap-2 text-mr-muted">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.tone}`} aria-hidden="true" />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-mr-text" title={money(row.value)}>
                  {moneyCompact(row.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right: the app's own gauge on the app's own ink surface ── */}
      <div className="relative flex flex-col justify-center bg-mr-ink p-6 @2xl:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: 'radial-gradient(85% 65% at 78% 2%, rgba(80,221,235,0.30) 0%, rgba(47,107,255,0.16) 40%, rgba(16,17,20,0) 70%)' }}
        />
        <div className="relative">
          <FinancialPositionPanel
            balance={CLOSING}
            opening={OPENING}
            incoming={INCOMING}
            outgoing={OUTGOING}
          />
        </div>
      </div>
    </div>
  );
}
