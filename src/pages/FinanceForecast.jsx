import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { GET_FINANCE_FORECAST } from '../graphql/queries';
import ForecastCopilot from '../components/ForecastCopilot';
import { Input } from '../components/ui/input';
import {
  PageHeader, SectionHead, EmptyBlock, FIELD, GHOST_BTN,
} from '../components/ui/page';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Loader2, AlertTriangle, Info, RefreshCw, Building2, Gauge, Activity, AlertCircle,
} from 'lucide-react';

// ── Currency formatters (matches the retired CashFlowForecast widget's house style) ──
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
const fmtINR = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// House palette — same series colours the dashboard and reports use.
const AQUA = '#0a7a8a', CORAL = '#ff654a', AMBER = '#ffb02e', BLUE = '#2f6bff';
const GRID = 'rgba(16,17,20,0.08)';
const GRID_STRONG = 'rgba(16,17,20,0.14)';
const AXIS = { fontSize: 11, fill: '#98a0ad' };
const TOOLTIP = { fontSize: 12, borderRadius: 14, border: '1px solid rgba(16,17,20,0.08)', boxShadow: '0 8px 24px -12px rgba(16,17,20,0.2)' };

const RISK_TONE = {
  low: 'bg-mr-lime-soft text-mr-lime-ink',
  medium: 'bg-mr-amber-soft text-mr-amber-ink',
  high: 'bg-mr-coral-soft text-mr-coral-ink',
};

const CONFIDENCE_TONE = {
  high: 'bg-mr-lime-soft text-mr-lime-ink',
  medium: 'bg-mr-amber-soft text-mr-amber-ink',
  low: 'bg-mr-coral-soft text-mr-coral-ink',
};

const SCENARIOS = [
  { key: 'conservative', label: 'Conservative' },
  { key: 'base', label: 'Base' },
  { key: 'optimistic', label: 'Optimistic' },
];

export default function FinanceForecast() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [horizonMonths, setHorizonMonths] = useState(6);
  const [lookbackMonths, setLookbackMonths] = useState(6);
  const [scenario, setScenario] = useState('base');
  const [openingOverride, setOpeningOverride] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  const { data, loading, error, refetch, networkStatus } = useQuery(GET_FINANCE_FORECAST, {
    variables: { siteId: siteId ? String(siteId) : '', horizonMonths, lookbackMonths, forceRefresh: false },
    skip: !siteId,
    pollInterval: 60000,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const forecast = data?.financeForecast;
  const refreshing = networkStatus === 4 || networkStatus === 6; // refetch / poll in flight

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
    let firstDeficit = null;
    let deficitCount = 0;
    for (const m of forecast.months) {
      const s = m.scenarios[scenario];
      inflow += s.inflow;
      outflow += s.outflow;
      running = round2(s.projectedClosingCash + overrideOffset);
      if (running < lowest) lowest = running;
      if (running < 0) {
        deficitCount += 1;
        if (firstDeficit === null) firstDeficit = m.key;
      }
    }
    return {
      inflow: round2(inflow), outflow: round2(outflow), net: round2(inflow - outflow),
      lowest, firstDeficit, deficitCount,
    };
  }, [forecast, scenario, overrideOffset]);

  const timeline = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.history.map((h) => ({
      key: h.key, label: h.label, inflow: h.inflow, outflow: h.outflow, net: h.net, isForecast: false,
    }));
    const fut = forecast.months.map((m) => {
      const s = m.scenarios[scenario];
      return {
        key: m.key, label: m.label,
        inflow: s.inflow, outflow: s.outflow, net: s.net,
        projectedClosingCash: round2(s.projectedClosingCash + overrideOffset),
        lowerBound: round2(s.lowerBound + overrideOffset),
        upperBound: round2(s.upperBound + overrideOffset),
        isForecast: true,
      };
    });
    return [...hist, ...fut];
  }, [forecast, scenario, overrideOffset]);

  const selectedMonth = useMemo(
    () => forecast?.months.find((m) => m.key === selectedKey) || forecast?.months?.[0] || null,
    [forecast, selectedKey]
  );

  const dueItems = forecast?.dueItems || {};
  const hasUnscheduled = (dueItems.overdueReceivables || 0) + (dueItems.vendorOverdue || 0) + (dueItems.vendorUnscheduled || 0) + (dueItems.farmerOutstanding || 0) > 0;

  if (!siteId) {
    return (
      <EmptyBlock icon={Building2} title="Select a site to view its finance forecast" tall />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <PageHeader
        title="Finance forecast"
        description={`Projected from recent cash-flow patterns and known dues · ${currentSite?.name || 'Site'}`}
        actions={
          <>
            <Select value={String(lookbackMonths)} onValueChange={(v) => setLookbackMonths(Number(v))}>
              <SelectTrigger className={cn(FIELD, 'w-[140px]')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3mo history</SelectItem>
                <SelectItem value="6">6mo history</SelectItem>
                <SelectItem value="12">12mo history</SelectItem>
                <SelectItem value="24">24mo history</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(horizonMonths)} onValueChange={(v) => setHorizonMonths(Number(v))}>
              <SelectTrigger className={cn(FIELD, 'w-[140px]')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3mo forecast</SelectItem>
                <SelectItem value="6">6mo forecast</SelectItem>
                <SelectItem value="12">12mo forecast</SelectItem>
                <SelectItem value="18">18mo forecast</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" className={GHOST_BTN} onClick={handleManualRefresh} disabled={refreshing}>
              {refreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
              Refresh
            </button>
          </>
        }
      />

      {forecast?.generatedAt && (
        <p className="mt-3 text-[13px] text-mr-faint">
          Live · refreshed every minute. Last generated{' '}
          {new Date(forecast.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}

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
          {/* ── Position ── */}
          <section className="mt-8">
            <SectionHead title="Projected position" meta={`${scenario} scenario`} />
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 py-6 lg:grid-cols-5">
              {[
                { label: 'Cash available now', value: round2(forecast.currentCash + overrideOffset) },
                { label: 'Expected inflow', value: scenarioAgg.inflow, tone: 'text-mr-aqua-ink' },
                { label: 'Expected outflow', value: scenarioAgg.outflow, tone: 'text-mr-coral-ink' },
                { label: 'Net movement', value: scenarioAgg.net, tone: scenarioAgg.net >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink' },
                { label: 'Lowest projected cash', value: scenarioAgg.lowest, tone: scenarioAgg.lowest < 0 ? 'text-mr-coral-ink' : undefined },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <dt className="text-[13px] text-mr-muted">{metric.label}</dt>
                  <dd className={cn('mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em]', metric.tone || 'text-mr-text')}>
                    {fmtINR(metric.value)}
                  </dd>
                </div>
              ))}
            </dl>

            <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control px-4 py-3 text-[13px]', RISK_TONE[forecast.riskLevel] || RISK_TONE.low)}>
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="font-semibold capitalize">{forecast.riskLevel} risk</span>
              <span className="opacity-90">— {forecast.riskSummary}</span>
            </p>
          </section>

          {/* ── Timeline ── */}
          <section className="mt-10">
            <SectionHead
              title="Cash timeline"
              actions={
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-control border border-mr-line p-0.5 text-[12px] font-medium" role="group" aria-label="Forecast scenario">
                    {SCENARIOS.map((s) => (
                      <button
                        type="button"
                        key={s.key}
                        onClick={() => setScenario(s.key)}
                        aria-pressed={scenario === s.key}
                        className={cn(
                          'rounded-[11px] px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue',
                          scenario === s.key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-mr-muted">
                    Opening cash what-if
                    <Input
                      type="number"
                      className={cn(FIELD, 'w-36')}
                      value={openingOverride}
                      onChange={(e) => setOpeningOverride(e.target.value)}
                      placeholder={fmtINR(forecast.currentCash)}
                    />
                  </label>
                </div>
              }
            />

            <div className="grid gap-8 pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={timeline} barGap={3} barCategoryGap="20%" onClick={(e) => { if (e?.activePayload?.[0]?.payload?.key && e.activePayload[0].payload.isForecast) setSelectedKey(e.activePayload[0].payload.key); }}>
                      <defs>
                        <linearGradient id="ff-cash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BLUE} stopOpacity={0.24} />
                          <stop offset="95%" stopColor={BLUE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
                      <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                      <RechartsTooltip contentStyle={TOOLTIP} formatter={(value, name) => [fmtTooltip(value), name]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={0} stroke={GRID_STRONG} strokeWidth={1.5} />
                      <Bar dataKey="inflow" name="Inflow" fill={AQUA} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="outflow" name="Outflow" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line type="monotone" dataKey="net" name="Net" stroke={AMBER} strokeWidth={2} dot={{ r: 2.5, fill: AMBER, stroke: '#fff', strokeWidth: 1.5 }} />
                      <Area type="monotone" dataKey="projectedClosingCash" name="Projected cash" stroke={BLUE} strokeWidth={2.5} fill="url(#ff-cash)" connectNulls dot={{ r: 2.5, fill: BLUE, stroke: '#fff', strokeWidth: 1.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[12px] text-mr-faint">
                  Left of the gap is actual history; right is the {scenario} scenario forecast. Select a forecast month for details.
                </p>
              </div>

              {/* Selected month */}
              <aside className="min-w-0 lg:border-l lg:border-mr-line lg:pl-8">
                <p className="text-[13px] font-medium text-mr-text">{selectedMonth?.label || 'Select a forecast month'}</p>
                {selectedMonth && (
                  <>
                    <p className="mt-4 text-[13px] text-mr-muted">Projected closing cash</p>
                    <p className={cn(
                      'mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em]',
                      selectedMonth.scenarios[scenario].projectedClosingCash < 0 ? 'text-mr-coral-ink' : 'text-mr-text',
                    )}>
                      {fmtINR(selectedMonth.scenarios[scenario].projectedClosingCash + overrideOffset)}
                    </p>
                    <p className="mt-1 text-[12px] text-mr-faint">
                      Range {fmtINR(selectedMonth.scenarios[scenario].lowerBound + overrideOffset)} – {fmtINR(selectedMonth.scenarios[scenario].upperBound + overrideOffset)}
                    </p>

                    <dl className="mt-5">
                      {[
                        { label: 'Pattern inflow', value: selectedMonth.patternInflow, cls: 'text-mr-aqua-ink' },
                        { label: 'Scheduled inflow', value: selectedMonth.scheduledInflow, cls: 'text-mr-aqua-ink' },
                        { label: 'Pattern outflow', value: selectedMonth.patternOutflow, cls: 'text-mr-coral-ink' },
                        { label: 'Scheduled outflow', value: selectedMonth.scheduledOutflow, cls: 'text-mr-coral-ink' },
                        { label: 'Net movement', value: selectedMonth.scenarios[scenario].net, cls: selectedMonth.scenarios[scenario].net >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink' },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-mr-line py-2.5 text-[13px]">
                          <dt className="text-mr-muted">{row.label}</dt>
                          <dd className={cn('font-semibold tabular-nums', row.cls)}>{fmtINR(row.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5 font-medium text-mr-text">
                      <Gauge className="h-3.5 w-3.5 text-mr-faint" strokeWidth={1.9} aria-hidden="true" /> Confidence
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-medium capitalize', CONFIDENCE_TONE[forecast.confidenceLevel] || CONFIDENCE_TONE.low)}>
                      {forecast.confidenceLevel} · {forecast.confidenceScore}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-mr-muted">
                    Inflow trend {forecast.inflowTrendPct >= 0 ? '+' : ''}{forecast.inflowTrendPct}%/mo · outflow trend {forecast.outflowTrendPct >= 0 ? '+' : ''}{forecast.outflowTrendPct}%/mo. Volatility: inflow {forecast.inflowVolatility}, outflow {forecast.outflowVolatility}.
                  </p>
                  <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-mr-faint">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" /> {forecast.disclaimer}
                  </p>
                </div>
              </aside>
            </div>
          </section>

          {/* ── Month by month ── */}
          <section className="mt-10">
            <SectionHead title="Month by month" meta={scenario} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-mr-line">
                    <th className="py-3 pr-3 text-left text-[12px] font-medium text-mr-muted">Month</th>
                    {['Pattern in', 'Pattern out', 'Scheduled in', 'Scheduled out', 'Net', 'Projected cash', 'Range'].map((h) => (
                      <th key={h} className="py-3 pr-3 text-right text-[12px] font-medium text-mr-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {forecast.months.map((m) => {
                    const s = m.scenarios[scenario];
                    const cash = round2(s.projectedClosingCash + overrideOffset);
                    return (
                      <tr
                        key={m.key}
                        className="cursor-pointer border-b border-mr-line transition-colors hover:bg-mr-surface-2/60"
                        onClick={() => setSelectedKey(m.key)}
                      >
                        <td className="py-2.5 pr-3 font-medium text-mr-text">{m.label}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-mr-aqua-ink">{fmtINR(m.patternInflow)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-mr-coral-ink">{fmtINR(m.patternOutflow)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-mr-aqua-ink">{fmtINR(m.scheduledInflow)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-mr-coral-ink">{fmtINR(m.scheduledOutflow)}</td>
                        <td className={cn('py-2.5 pr-3 text-right font-semibold tabular-nums', s.net >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink')}>{fmtINR(s.net)}</td>
                        <td className={cn('py-2.5 pr-3 text-right font-semibold tabular-nums', cash < 0 ? 'text-mr-coral-ink' : 'text-mr-text')}>{fmtINR(cash)}</td>
                        <td className="py-2.5 text-right tabular-nums text-mr-faint">{fmt(s.lowerBound + overrideOffset)}–{fmt(s.upperBound + overrideOffset)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Exposure ── */}
          <section className="mt-10">
            <SectionHead
              title="Known receivables & payables"
              description="Undated or overdue liabilities, reported separately rather than fake-dated into a specific month."
            />
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 py-6 lg:grid-cols-4">
              {[
                { label: 'Overdue receivables', value: dueItems.overdueReceivables, tone: 'text-mr-amber-ink' },
                { label: 'Vendor overdue', value: dueItems.vendorOverdue, tone: 'text-mr-coral-ink' },
                { label: 'Vendor unscheduled', value: dueItems.vendorUnscheduled },
                { label: 'Land-owner outstanding', value: dueItems.farmerOutstanding },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[13px] text-mr-muted">{item.label}</dt>
                  <dd className={cn('mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.02em]', item.tone || 'text-mr-text')}>
                    {fmtINR(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
            {!hasUnscheduled && <p className="text-[13px] text-mr-muted">No overdue or unscheduled exposure right now.</p>}
          </section>

          {/* ── Diagnostics ── */}
          <section className="mt-10">
            <SectionHead title="Diagnostics" />
            <div className="grid gap-8 pt-5 lg:grid-cols-2">
              <div>
                <p className="text-[13px] font-medium text-mr-text">Weekday activity · {lookbackMonths}mo</p>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {forecast.weekdayPattern.map((d) => (
                    <div key={d.weekday} className="rounded-control border border-mr-line py-2 text-center">
                      <p className="text-[11px] text-mr-faint">{d.label}</p>
                      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-mr-text">{d.txnCount}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-medium text-mr-text">Source mix · last completed month</p>
                <dl className="mt-3">
                  {[...forecast.sourceMixRevenue.map((s) => ({ ...s, dir: 'in' })), ...forecast.sourceMixExpense.map((s) => ({ ...s, dir: 'out' }))]
                    .filter((s) => s.amount > 0)
                    .sort((a, b) => b.amount - a.amount)
                    .map((s) => (
                      <div key={`${s.dir}-${s.source}`} className="flex items-center justify-between gap-3 border-b border-mr-line py-2 text-[13px]">
                        <dt className="capitalize text-mr-muted">{s.source.replaceAll('_', ' ')}</dt>
                        <dd className={cn('font-semibold tabular-nums', s.dir === 'in' ? 'text-mr-aqua-ink' : 'text-mr-coral-ink')}>{fmtINR(s.amount)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
          </section>
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
