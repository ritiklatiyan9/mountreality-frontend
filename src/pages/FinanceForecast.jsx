import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { GET_FINANCE_FORECAST } from '../graphql/queries';
import ForecastCopilot from '../components/ForecastCopilot';
import { Input } from '../components/ui/input';
import { EmptyBlock, StatusDot, FIELD, GHOST_BTN } from '../components/ui/page';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Loader2, AlertTriangle, Info, RefreshCw, Building2, Activity, AlertCircle,
  TrendingUp, TrendingDown, Minus, Sparkles, Wallet, ArrowDownLeft, ArrowUpRight,
  ArrowLeftRight, ShieldCheck, CheckCircle2, Clock, FileText, CalendarClock,
  Gauge, Layers, Landmark, Receipt,
} from 'lucide-react';

/* ── Finance Forecast ────────────────────────────────────────────────
   A panelled read of the same payload the flat version rendered: nothing
   here is derived beyond a scenario pick and the opening-cash what-if,
   both of which are pure client-side arithmetic over `financeForecast`.

   Unlike the rest of the app's page furniture (which is deliberately
   cardless), this screen is a tray of panels — it is a briefing, read in
   glances, not a document read top to bottom. ── */

// ── Currency formatters ──
const fmt = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
const fmtTooltip = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
/** Headline scale — Cr/L/K, the way the figures are actually spoken here. */
const fmtMoney = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)} K`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
const fmtINR = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (ratio) => `${Math.round((Number(ratio) || 0) * 100)}%`;

/* House series colours. Net uses the amber INK step rather than the amber
   fill: the fill sits at L 0.81 with 1.78:1 against white, which fails the
   palette validator's lightness band as a line stroke. The ink step passes
   both. Coral's 2.84:1 is a documented WARN whose relief — a legend plus a
   full table view of the same numbers — is present on this page. */
const AQUA = '#0a7a8a', CORAL = '#ff654a', NET = '#8a5a00', BLUE = '#2f6bff';
const GRID = 'rgba(16,17,20,0.08)';
const GRID_STRONG = 'rgba(16,17,20,0.14)';
const AXIS = { fontSize: 11, fill: '#98a0ad' };
const TOOLTIP = { fontSize: 12, borderRadius: 14, border: '1px solid rgba(16,17,20,0.08)', boxShadow: '0 8px 24px -12px rgba(16,17,20,0.2)' };

const RISK_TONE = {
  low: 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink',
  medium: 'border-mr-amber-ink/15 bg-mr-amber-soft text-mr-amber-ink',
  high: 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink',
};

const CONFIDENCE_TONE = {
  high: 'text-mr-lime-ink',
  medium: 'text-mr-amber-ink',
  low: 'text-mr-coral-ink',
};

const BADGE_TONE = {
  neutral: 'bg-mr-surface-2 text-mr-muted',
  blue: 'bg-mr-blue-soft text-mr-blue',
  aqua: 'bg-mr-aqua-soft text-mr-aqua-ink',
  lime: 'bg-mr-lime-soft text-mr-lime-ink',
  amber: 'bg-mr-amber-soft text-mr-amber-ink',
  coral: 'bg-mr-coral-soft text-mr-coral-ink',
};

const SCENARIOS = [
  { key: 'conservative', label: 'Conservative' },
  { key: 'base', label: 'Base' },
  { key: 'optimistic', label: 'Optimistic' },
];

const DUE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'receivable', label: 'Receivable' },
  { id: 'payable', label: 'Payable' },
  { id: 'overdue', label: 'Overdue' },
];

/* Overdue reads as a problem, upcoming as neutral information, and undated as
   simply unknown — never as a deadline the data doesn't actually have. */
const DUE_STATUS_TONE = { overdue: 'negative', upcoming: 'info', unscheduled: 'neutral' };
const DUE_STATUS_LABEL = { overdue: 'Overdue', upcoming: 'Upcoming', unscheduled: 'No due date' };

const TREND_ICON = { rising: TrendingUp, falling: TrendingDown, flat: Minus };

const DUE_PREVIEW_COUNT = 8;

// Backend returns weekdays Sun-first (Postgres DOW); a working week reads Mon-first.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const fmtDate = (iso) => {
  if (!iso) return 'No due date';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Panel primitives ──
function Panel({ className, children }) {
  return (
    <section className={cn('rounded-panel border border-mr-line bg-mr-surface p-5 sm:p-6', className)}>
      {children}
    </section>
  );
}

function PanelHead({ icon, tone = 'blue', title, description, actions }) {
  const HeadIcon = icon;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {HeadIcon && (
          <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', BADGE_TONE[tone])}>
            <HeadIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-mr-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function StatPanel({ label, value, exact, sub, icon, tone = 'neutral', valueTone }) {
  const StatIcon = icon;
  return (
    <div className="rounded-panel-sm border border-mr-line bg-mr-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-mr-faint">{label}</p>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', BADGE_TONE[tone])}>
          <StatIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <p
        className={cn('mt-3 text-[22px] font-semibold tabular-nums tracking-[-0.02em]', valueTone || 'text-mr-text')}
        title={exact}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] text-mr-faint" title={sub}>{sub}</p>
    </div>
  );
}

/* One shared segmented control for the scenario picker and the dues filter. */
function SegmentedControl({ items, value, onChange, label }) {
  return (
    <div className="inline-flex rounded-control border border-mr-line bg-mr-surface p-0.5 text-[12px] font-medium" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onChange(item.id)}
          aria-pressed={value === item.id}
          className={cn(
            'rounded-[11px] px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
            value === item.id ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* A named total that is genuinely undated — shown for risk context, never
   folded into a forecast month it doesn't belong to. */
function ExposureRow({ icon, tone, label, value }) {
  const RowIcon = icon;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-mr-muted">
        <RowIcon className={cn('h-3.5 w-3.5 shrink-0', tone)} strokeWidth={1.9} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-mr-text" title={fmtINR(value)}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}

/* Split bar: inflow then outflow on one shared scale, so bar length compares
   like for like across every row in the list. */
function SplitBar({ inflow, outflow, scale }) {
  return (
    <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-mr-surface-2" aria-hidden="true">
      <div className="h-full rounded-full bg-mr-aqua-ink" style={{ width: `${Math.min(100, (inflow / scale) * 100)}%` }} />
      <div className="h-full rounded-full bg-mr-coral" style={{ width: `${Math.min(100, (outflow / scale) * 100)}%` }} />
    </div>
  );
}

export default function FinanceForecast() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [horizonMonths, setHorizonMonths] = useState(6);
  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [scenario, setScenario] = useState('base');
  const [openingOverride, setOpeningOverride] = useState('');
  const [dueFilter, setDueFilter] = useState('all');
  const [showAllDues, setShowAllDues] = useState(false);

  const { data, loading, error, refetch, networkStatus } = useQuery(GET_FINANCE_FORECAST, {
    variables: { siteId: siteId ? String(siteId) : '', horizonMonths, lookbackMonths, forceRefresh: false },
    skip: !siteId,
    pollInterval: 60000,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const forecast = data?.financeForecast;
  const refreshing = networkStatus === 4 || networkStatus === 6; // refetch / poll in flight
  const scenarioLabel = SCENARIOS.find((s) => s.key === scenario)?.label || 'Base';

  const handleManualRefresh = () => {
    if (!siteId) return;
    refetch({ siteId: String(siteId), horizonMonths, lookbackMonths, forceRefresh: true });
  };

  const overrideOffset = useMemo(() => {
    if (!forecast || openingOverride === '') return 0;
    return round2(Number(openingOverride) - forecast.currentCash);
  }, [forecast, openingOverride]);

  // Recomputed client-side per selected scenario + opening-cash what-if, so
  // switching either updates instantly with no refetch.
  const scenarioAgg = useMemo(() => {
    if (!forecast) return null;
    let inflow = 0, outflow = 0;
    let running = round2(forecast.currentCash + overrideOffset);
    let lowest = running;
    let lowestLabel = 'today';
    let firstDeficit = null;
    let deficitCount = 0;
    for (const m of forecast.months) {
      const s = m.scenarios[scenario];
      inflow += s.inflow;
      outflow += s.outflow;
      running = round2(s.projectedClosingCash + overrideOffset);
      if (running < lowest) { lowest = running; lowestLabel = m.label; }
      if (running < 0) {
        deficitCount += 1;
        if (firstDeficit === null) firstDeficit = m.label;
      }
    }
    return {
      inflow: round2(inflow), outflow: round2(outflow), net: round2(inflow - outflow),
      lowest, lowestLabel, firstDeficit, deficitCount,
    };
  }, [forecast, scenario, overrideOffset]);

  /* History is completed months only (the engine's window stops at the month
     before the clock month), so months[0] is the current month and carries no
     duplicate — it is the actual-MTD + projected-remainder blend, hence MTD. */
  const timeline = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.history.map((h) => ({
      key: h.key, label: h.label, inflow: h.inflow, outflow: h.outflow, net: h.net, isForecast: false,
    }));
    const fut = forecast.months.map((m, i) => {
      const s = m.scenarios[scenario];
      return {
        key: m.key,
        label: i === 0 ? `${m.label} MTD` : m.label,
        inflow: s.inflow, outflow: s.outflow, net: s.net,
        projectedClosingCash: round2(s.projectedClosingCash + overrideOffset),
        isForecast: true,
      };
    });
    return [...hist, ...fut];
  }, [forecast, scenario, overrideOffset]);

  const forecastBoundaryLabel = timeline.find((t) => t.isForecast)?.label;

  const weekdayData = useMemo(() => {
    const byDow = Object.fromEntries((forecast?.weekdayPattern || []).map((d) => [d.weekday, d]));
    return WEEK_ORDER.map((dow) => byDow[dow]).filter(Boolean);
  }, [forecast?.weekdayPattern]);

  const dueItems = forecast?.dueItems || {};
  const totalUnscheduled = (dueItems.overdueReceivables || 0) + (dueItems.vendorOverdue || 0)
    + (dueItems.vendorUnscheduled || 0) + (dueItems.farmerOutstanding || 0);

  // 'overdue' cuts across both types, so it filters on status while the other
  // two filter on type — hence the explicit branch rather than one predicate.
  const filteredDues = useMemo(() => {
    const items = forecast?.dueSchedule || [];
    if (dueFilter === 'all') return items;
    if (dueFilter === 'overdue') return items.filter((d) => d.status === 'overdue');
    return items.filter((d) => d.type === dueFilter);
  }, [forecast?.dueSchedule, dueFilter]);

  const visibleDues = showAllDues ? filteredDues : filteredDues.slice(0, DUE_PREVIEW_COUNT);

  const sourceScale = useMemo(() => {
    const totals = (forecast?.sourcePattern || []).map((s) => s.inflow + s.outflow);
    return Math.max(...totals, 1);
  }, [forecast?.sourcePattern]);

  if (!siteId) {
    return <EmptyBlock icon={Building2} title="Select a site to view its finance forecast" tall />;
  }

  const RiskIcon = forecast?.riskLevel === 'low' ? CheckCircle2 : AlertTriangle;

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      {/* ── Hero ── */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel-sm bg-mr-blue text-white">
              <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-mr-text">Predictive cash-flow forecast</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mr-lime-soft px-2.5 py-1 text-[12px] font-medium text-mr-lime-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-mr-lime-ink" aria-hidden="true" />
                  Live · every minute
                </span>
              </div>
              <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-mr-muted">
                Projected from recent cash-flow patterns, trend strength and known dues.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-mr-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                  {currentSite?.name || 'Site'}
                </span>
                {forecast?.generatedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                    Updated {new Date(forecast.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {forecast && (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                    {(forecast.transactionCount ?? 0).toLocaleString('en-IN')} transaction logs analysed
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(lookbackMonths)} onValueChange={(v) => setLookbackMonths(Number(v))}>
              <SelectTrigger className={cn(FIELD, 'w-[142px]')} aria-label="History window"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3mo history</SelectItem>
                <SelectItem value="6">6mo history</SelectItem>
                <SelectItem value="12">12mo history</SelectItem>
                <SelectItem value="24">24mo history</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(horizonMonths)} onValueChange={(v) => setHorizonMonths(Number(v))}>
              <SelectTrigger className={cn(FIELD, 'w-[130px]')} aria-label="Forecast horizon"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="18">18 months</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" className={GHOST_BTN} onClick={handleManualRefresh} disabled={refreshing}>
              {refreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
              Refresh
            </button>
          </div>
        </div>
      </Panel>

      {loading && !forecast ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-mr-faint" aria-hidden="true" />
        </div>
      ) : error ? (
        <EmptyBlock
          icon={AlertCircle}
          title="Could not load the forecast"
          description="The forecast service did not respond. Try again in a moment."
          action={<button type="button" className={GHOST_BTN} onClick={handleManualRefresh}>Try again</button>}
          tall
        />
      ) : !forecast ? (
        <EmptyBlock icon={Activity} title="No forecast data available" tall />
      ) : (
        <>
          {/* ── Headline position ── */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatPanel
              label="Cash available now"
              value={fmtMoney(forecast.currentCash + overrideOffset)}
              exact={fmtINR(forecast.currentCash + overrideOffset)}
              sub={overrideOffset ? 'What-if opening balance' : 'Site balance in hand today'}
              icon={Wallet}
              tone="blue"
            />
            <StatPanel
              label={`Expected inflow · ${horizonMonths}mo`}
              value={fmtMoney(scenarioAgg.inflow)}
              exact={fmtINR(scenarioAgg.inflow)}
              sub={`${scenarioLabel} collection scenario`}
              icon={ArrowDownLeft}
              tone="aqua"
              valueTone="text-mr-aqua-ink"
            />
            <StatPanel
              label={`Expected outflow · ${horizonMonths}mo`}
              value={fmtMoney(scenarioAgg.outflow)}
              exact={fmtINR(scenarioAgg.outflow)}
              sub="Operating payments + known dues"
              icon={ArrowUpRight}
              tone="coral"
              valueTone="text-mr-coral-ink"
            />
            <StatPanel
              label="Net movement"
              value={fmtMoney(scenarioAgg.net)}
              exact={fmtINR(scenarioAgg.net)}
              sub={scenarioAgg.net >= 0 ? 'Forecast surplus' : 'Forecast shortfall'}
              icon={ArrowLeftRight}
              tone={scenarioAgg.net >= 0 ? 'lime' : 'coral'}
              valueTone={scenarioAgg.net >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink'}
            />
            <StatPanel
              label="Lowest projected cash"
              value={fmtMoney(scenarioAgg.lowest)}
              exact={fmtINR(scenarioAgg.lowest)}
              sub={`${scenarioAgg.lowestLabel} · ${scenarioLabel}`}
              icon={ShieldCheck}
              tone={scenarioAgg.lowest < 0 ? 'coral' : 'lime'}
              valueTone={scenarioAgg.lowest < 0 ? 'text-mr-coral-ink' : undefined}
            />
          </div>

          {/* ── Risk verdict ── */}
          <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-4 rounded-panel border px-5 py-4', RISK_TONE[forecast.riskLevel] || RISK_TONE.low)}>
            <div className="flex min-w-0 items-start gap-2.5">
              <RiskIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">
                  <span className="uppercase">{forecast.riskLevel}</span> cash risk · {forecast.confidenceScore}% model confidence
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed opacity-90">{forecast.riskSummary}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-70">Conservative floor</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums" title={fmtINR(forecast.conservativeCashFloor + overrideOffset)}>
                {fmtMoney(forecast.conservativeCashFloor + overrideOffset)}
              </p>
            </div>
          </div>

          {/* ── Timeline ── */}
          <Panel className="mt-3">
            <PanelHead
              icon={TrendingUp}
              title="Actual history and projected cash position"
              description="The current month is split into actual month-to-date and forecast remaining movement."
              actions={
                <SegmentedControl
                  label="Forecast scenario"
                  items={SCENARIOS.map((s) => ({ id: s.key, label: s.label }))}
                  value={scenario}
                  onChange={setScenario}
                />
              }
            />

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <label htmlFor="ff-opening" className="text-[13px] text-mr-muted">Forecast opening cash</label>
              <Input
                id="ff-opening"
                type="number"
                className={cn(FIELD, 'w-40')}
                value={openingOverride}
                onChange={(e) => setOpeningOverride(e.target.value)}
                placeholder={String(Math.round(forecast.currentCash))}
              />
              <span className="inline-flex items-center gap-1.5 text-[12px] text-mr-faint">
                <Info className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                Change this to run a cash-position what-if.
              </span>
              {openingOverride !== '' && (
                <button type="button" className="text-[12px] font-medium text-mr-blue hover:underline" onClick={() => setOpeningOverride('')}>
                  Reset
                </button>
              )}
            </div>

            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ff-cash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={fmt} width={56} />
                  <RechartsTooltip contentStyle={TOOLTIP} formatter={(value, name) => [fmtTooltip(value), name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke={GRID_STRONG} strokeWidth={1.5} />
                  {/* Where measured history stops and projection starts. */}
                  {forecastBoundaryLabel && (
                    <ReferenceLine x={forecastBoundaryLabel} stroke={GRID_STRONG} strokeDasharray="4 4" />
                  )}
                  <Area type="monotone" dataKey="projectedClosingCash" name="Cash position" stroke={BLUE} strokeWidth={2} fill="url(#ff-cash)" connectNulls dot={{ r: 2.5, fill: BLUE, stroke: '#fff', strokeWidth: 1.5 }} />
                  <Bar dataKey="inflow" name="Inflow" fill={AQUA} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="outflow" name="Outflow" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line type="monotone" dataKey="net" name="Net" stroke={NET} strokeWidth={2} dot={{ r: 2.5, fill: NET, stroke: '#fff', strokeWidth: 1.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[12px] text-mr-faint">
              Left of the dashed line is actual history; right is the {scenarioLabel.toLowerCase()} scenario.
              Cash position is a balance and the bars are monthly movement — they share one axis, so month-sized flows
              read small against a balance many times their size.
            </p>
          </Panel>

          {/* ── Month by month ── */}
          <Panel className="mt-3">
            <PanelHead
              icon={CalendarClock}
              tone="neutral"
              title="Month-by-month forecast"
              description="Run-rate is raised when a larger known installment or vendor due exists."
              actions={
                <span className="rounded-full bg-mr-blue-soft px-2.5 py-1 text-[12px] font-medium text-mr-blue">
                  {scenarioLabel} scenario
                </span>
              }
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-mr-line">
                    <th className="py-2.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-mr-faint">Month</th>
                    {['Pattern inflow', 'Known recovery', 'Forecast inflow', 'Forecast outflow', 'Net', 'Closing cash'].map((h) => (
                      <th key={h} className="py-2.5 pl-3 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-mr-faint">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {forecast.months.map((m, i) => {
                    const s = m.scenarios[scenario];
                    const cash = round2(s.projectedClosingCash + overrideOffset);
                    return (
                      <tr
                        key={m.key}
                        className="border-b border-mr-line last:border-0 transition-colors hover:bg-mr-surface-2/60"
                        // Pattern outflow and known payables shape these numbers
                        // without earning a column of their own on a table this wide.
                        title={`Pattern outflow ${fmtINR(m.patternOutflow)} · Known payables ${fmtINR(m.scheduledOutflow)}`}
                      >
                        <td className="py-3 pr-3">
                          <p className="font-medium text-mr-text">{m.label}</p>
                          <p className="mt-0.5 text-[12px] text-mr-faint">{i === 0 ? 'Remaining month' : `Month ${i + 1}`}</p>
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums text-mr-muted" title={fmtINR(m.patternInflow)}>{fmtMoney(m.patternInflow)}</td>
                        <td className="py-3 pl-3 text-right tabular-nums text-mr-muted" title={fmtINR(m.scheduledInflow)}>
                          {m.scheduledInflow > 0 ? fmtMoney(m.scheduledInflow) : <span className="text-mr-faint">—</span>}
                        </td>
                        <td className="py-3 pl-3 text-right tabular-nums text-mr-aqua-ink" title={fmtINR(s.inflow)}>{fmtMoney(s.inflow)}</td>
                        <td className="py-3 pl-3 text-right tabular-nums text-mr-coral-ink" title={fmtINR(s.outflow)}>{fmtMoney(s.outflow)}</td>
                        <td className={cn('py-3 pl-3 text-right font-semibold tabular-nums', s.net >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink')} title={fmtINR(s.net)}>
                          {fmtMoney(s.net)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <p className={cn('font-semibold tabular-nums', cash < 0 ? 'text-mr-coral-ink' : 'text-mr-text')} title={fmtINR(cash)}>
                            {fmtMoney(cash)}
                          </p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-mr-faint">
                            {fmt(s.lowerBound + overrideOffset)}–{fmt(s.upperBound + overrideOffset)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* ── Dues + diagnostics ── */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Panel>
              <PanelHead
                icon={Receipt}
                tone="amber"
                title="Known receivables and payables"
                description="Actionable dues are shown separately from pattern-based projections."
              />
              <div className="mt-4">
                <SegmentedControl
                  label="Filter dues"
                  items={DUE_FILTERS}
                  value={dueFilter}
                  onChange={(id) => { setDueFilter(id); setShowAllDues(false); }}
                />
              </div>

              {visibleDues.length === 0 ? (
                <EmptyBlock
                  icon={Activity}
                  title={dueFilter === 'all' ? 'No known dues right now' : 'No known dues match this filter'}
                />
              ) : (
                <ul className="mt-2">
                  {visibleDues.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-4 border-b border-mr-line py-3 last:border-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-medium text-mr-text">{d.entity}</p>
                          <StatusDot tone={DUE_STATUS_TONE[d.status]}>{DUE_STATUS_LABEL[d.status]}</StatusDot>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-mr-muted">
                          {d.description} · {fmtDate(d.dueDate)}
                        </p>
                      </div>
                      <p
                        className={cn('shrink-0 text-[15px] font-semibold tabular-nums', d.type === 'receivable' ? 'text-mr-aqua-ink' : 'text-mr-coral-ink')}
                        title={fmtINR(d.amount)}
                      >
                        {fmtMoney(d.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {filteredDues.length > DUE_PREVIEW_COUNT && (
                <button type="button" className={cn(GHOST_BTN, 'mt-4')} onClick={() => setShowAllDues((v) => !v)}>
                  {showAllDues ? 'Show fewer' : `Show all ${filteredDues.length}`}
                </button>
              )}
            </Panel>

            <div className="grid gap-3 content-start">
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', BADGE_TONE.blue)}>
                      <Gauge className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Model diagnostics</h2>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-mr-muted">
                        Recency-weighted trend + restrained seasonality + known dues · {forecast.modelVersion}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">{forecast.confidenceScore}%</p>
                    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.05em]', CONFIDENCE_TONE[forecast.confidenceLevel] || CONFIDENCE_TONE.low)}>
                      {forecast.confidenceLevel} confidence
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-mr-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mr-amber to-mr-lime-ink"
                    style={{ width: `${Math.max(2, Math.min(100, forecast.confidenceScore))}%` }}
                    role="img"
                    aria-label={`Model confidence ${forecast.confidenceScore} percent`}
                  />
                </div>

                {/* Direction is stated in words as well as colour — a rising outflow
                    and a rising inflow mean opposite things. */}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {[
                    { label: 'Inflow pattern', dir: forecast.inflowTrend, pctValue: forecast.inflowTrendPct, vol: forecast.inflowVolatility, goodWhenRising: true },
                    { label: 'Outflow pattern', dir: forecast.outflowTrend, pctValue: forecast.outflowTrendPct, vol: forecast.outflowVolatility, goodWhenRising: false },
                  ].map((t) => {
                    const TrendIcon = TREND_ICON[t.dir] || Minus;
                    const helpful = t.dir === 'flat' ? null : (t.dir === 'rising') === t.goodWhenRising;
                    return (
                      <div
                        key={t.label}
                        className={cn(
                          'rounded-panel-sm border p-3',
                          helpful === null ? 'border-mr-line bg-mr-surface-2/50'
                            : helpful ? 'border-mr-lime-ink/15 bg-mr-lime-soft'
                              : 'border-mr-coral-ink/15 bg-mr-coral-soft',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] font-medium text-mr-text">{t.label}</p>
                          <TrendIcon
                            className={cn('h-3.5 w-3.5 shrink-0', helpful === null ? 'text-mr-muted' : helpful ? 'text-mr-lime-ink' : 'text-mr-coral-ink')}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </div>
                        <p className={cn('mt-1.5 text-[19px] font-semibold tabular-nums tracking-[-0.02em]', helpful === null ? 'text-mr-text' : helpful ? 'text-mr-lime-ink' : 'text-mr-coral-ink')}>
                          {t.pctValue >= 0 ? '+' : ''}{t.pctValue}%
                        </p>
                        <p className="mt-0.5 text-[11px] leading-tight text-mr-muted">
                          per-month trend · {pct(t.vol)} volatility
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-mr-line pt-4 text-center">
                  {[
                    { value: forecast.historicalMonths ?? 0, label: 'months learned' },
                    { value: forecast.activeMonths ?? 0, label: 'active months' },
                    { value: '60s', label: 'refresh cycle' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-[17px] font-semibold tabular-nums text-mr-text">{s.value}</p>
                      <p className="mt-0.5 text-[11px] leading-tight text-mr-faint">{s.label}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 flex items-start gap-1.5 border-t border-mr-line pt-3 text-[11.5px] leading-relaxed text-mr-faint">
                  <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                  Run-rate {fmtMoney(forecast.runRate?.inflowPerMonth)} in · {fmtMoney(forecast.runRate?.outflowPerMonth)} out
                  per month, recency-weighted over {forecast.runRate?.lookbackMonths ?? lookbackMonths} months.
                </p>
              </Panel>

              <Panel>
                <PanelHead
                  icon={AlertTriangle}
                  tone="amber"
                  title="Unscheduled exposure"
                  description="Visible in risk context; never assigned a fake forecast date."
                />
                <div className="mt-3 divide-y divide-mr-line">
                  <ExposureRow icon={AlertTriangle} tone="text-mr-amber-ink" label="Overdue recovery" value={dueItems.overdueReceivables} />
                  <ExposureRow icon={AlertTriangle} tone="text-mr-coral-ink" label="Vendor overdue" value={dueItems.vendorOverdue} />
                  <ExposureRow icon={Clock} tone="text-mr-faint" label="Vendor unscheduled" value={dueItems.vendorUnscheduled} />
                  <ExposureRow icon={Landmark} tone="text-mr-faint" label="Land-owner outstanding" value={dueItems.farmerOutstanding} />
                </div>
                {totalUnscheduled === 0 && (
                  <p className="mt-3 text-[12px] text-mr-muted">No overdue or unscheduled exposure right now.</p>
                )}
              </Panel>
            </div>
          </div>

          {/* ── Learned patterns ── */}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHead
                icon={Activity}
                tone="neutral"
                title="Transaction rhythm by weekday"
                description="Identifies which days historically carry collections and payments."
              />
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayData} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={fmt} width={56} />
                    <RechartsTooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(16,17,20,0.04)' }} formatter={(value, name) => [fmtTooltip(value), name]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inflow" name="Inflow" fill={AQUA} radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="outflow" name="Outflow" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <PanelHead
                icon={Layers}
                tone="neutral"
                title="Historical source mix"
                description="Top transaction sources used to learn the recent run-rate."
              />
              {forecast.sourcePattern?.length ? (
                <div className="mt-4 space-y-3.5">
                  {forecast.sourcePattern.map((s) => (
                    <div key={s.source}>
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-mr-text">{s.label}</p>
                          <p className="mt-0.5 text-[11.5px] text-mr-faint">{s.txnCount} entries</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13px] font-semibold tabular-nums text-mr-text" title={fmtINR(s.inflow + s.outflow)}>
                            {fmtMoney(s.inflow + s.outflow)}
                          </p>
                          <p className="mt-0.5 text-[11.5px] tabular-nums text-mr-faint">
                            In {fmt(s.inflow)} · Out {fmt(s.outflow)}
                          </p>
                        </div>
                      </div>
                      <SplitBar inflow={s.inflow} outflow={s.outflow} scale={sourceScale} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock icon={Activity} title="No completed-month activity in the lookback window" />
              )}
            </Panel>
          </div>

          {/* ── Standing disclaimer ── */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-mr-line bg-mr-surface-2/50 px-5 py-3.5">
            <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-mr-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              {forecast.disclaimer}
            </p>
            <p className="flex items-center gap-1.5 text-[12px] text-mr-faint">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
              Firm reconciliation is excluded
            </p>
          </div>
        </>
      )}

      <ForecastCopilot
        siteId={siteId}
        forecast={forecast}
        scenario={scenario}
        horizonMonths={horizonMonths}
        lookbackMonths={lookbackMonths}
        onApplyScenario={({ scenario: s, openingOverride: o, horizonMonths: h }) => {
          if (s) setScenario(s);
          if (o != null) setOpeningOverride(String(o));
          if (h) setHorizonMonths(h);
        }}
      />
    </div>
  );
}
