import { createElement, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { GET_FINANCE_FORECAST } from '../graphql/queries';
import ForecastCopilot from '../components/ForecastCopilot';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  TrendingUp, TrendingDown, Wallet, Loader2, ArrowDownRight, ArrowUpRight,
  AlertTriangle, CalendarClock, Landmark, Info, RefreshCw, Building2,
  Gauge, Activity, AlertCircle,
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

const EMERALD = '#10b981', ROSE = '#f43f5e', AMBER = '#f59e0b', INDIGO = '#6366f1';

const RISK_STYLE = {
  low: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  medium: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  high: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const CONFIDENCE_STYLE = {
  high: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-rose-700 bg-rose-50 border-rose-200',
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Select a site to view its Finance Forecast</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-3 sm:p-5">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-xl shadow-blue-950/10 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold sm:text-xl">Finance Forecast</h1>
              <p className="mt-1 text-sm text-blue-100/90">Predictive Cash-Flow Forecast</p>
              <p className="mt-0.5 text-xs text-blue-200/70">
                आगामी महीनों का अनुमान — projected from recent cash-flow patterns + known dues
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-blue-200/80">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
                  <Building2 className="h-3 w-3" /> {currentSite?.name || 'Site'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live · every minute
                </span>
                {forecast?.generatedAt && (
                  <span>Last generated {new Date(forecast.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(lookbackMonths)} onValueChange={(v) => setLookbackMonths(Number(v))}>
              <SelectTrigger className="h-9 w-[128px] rounded-full border-white/20 bg-white/10 text-xs text-white shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3mo history</SelectItem>
                <SelectItem value="6">6mo history</SelectItem>
                <SelectItem value="12">12mo history</SelectItem>
                <SelectItem value="24">24mo history</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(horizonMonths)} onValueChange={(v) => setHorizonMonths(Number(v))}>
              <SelectTrigger className="h-9 w-[120px] rounded-full border-white/20 bg-white/10 text-xs text-white shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3mo forecast</SelectItem>
                <SelectItem value="6">6mo forecast</SelectItem>
                <SelectItem value="12">12mo forecast</SelectItem>
                <SelectItem value="18">18mo forecast</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="h-9 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {loading && !forecast ? (
        <div className="flex h-96 items-center justify-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-rose-200 bg-rose-50 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-700">Could not load the forecast.</p>
          <Button type="button" size="sm" variant="outline" onClick={handleManualRefresh}>Try again</Button>
        </div>
      ) : !forecast ? (
        <div className="flex h-56 items-center justify-center text-sm text-slate-500">No forecast data available.</div>
      ) : (
        <>
          {/* KPI cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Wallet, label: 'Cash available now', value: round2(forecast.currentCash + overrideOffset), color: 'text-indigo-700', iconBg: 'bg-indigo-50' },
              { icon: ArrowDownRight, label: 'Expected inflow', value: scenarioAgg.inflow, color: 'text-emerald-700', iconBg: 'bg-emerald-50' },
              { icon: ArrowUpRight, label: 'Expected outflow', value: scenarioAgg.outflow, color: 'text-rose-600', iconBg: 'bg-rose-50' },
              { icon: Activity, label: 'Net movement', value: scenarioAgg.net, color: scenarioAgg.net >= 0 ? 'text-cyan-700' : 'text-rose-600', iconBg: scenarioAgg.net >= 0 ? 'bg-cyan-50' : 'bg-rose-50' },
              { icon: scenarioAgg.lowest < 0 ? TrendingDown : CalendarClock, label: 'Lowest projected cash', value: scenarioAgg.lowest, color: scenarioAgg.lowest < 0 ? 'text-rose-600' : 'text-violet-700', iconBg: scenarioAgg.lowest < 0 ? 'bg-rose-50' : 'bg-violet-50' },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 shadow-sm">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${metric.iconBg}`}>
                  {createElement(metric.icon, { className: `h-4 w-4 ${metric.color}` })}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-medium text-slate-500">{metric.label}</span>
                  <span className={`mt-0.5 block text-lg font-bold ${metric.color}`}>{fmtINR(metric.value)}</span>
                </span>
              </div>
            ))}
          </section>

          {/* Risk banner */}
          <section className={`flex flex-wrap items-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm ${RISK_STYLE[forecast.riskLevel]?.bg || 'bg-slate-50'} ${RISK_STYLE[forecast.riskLevel]?.border || 'border-slate-200'}`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${RISK_STYLE[forecast.riskLevel]?.text || 'text-slate-600'}`} />
            <span className={`font-semibold capitalize ${RISK_STYLE[forecast.riskLevel]?.text || 'text-slate-700'}`}>{forecast.riskLevel} risk —</span>
            <span className="text-slate-600">{forecast.riskSummary}</span>
          </section>

          {/* Chart + detail panel */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-[10px] font-semibold">
                  {SCENARIOS.map((s) => (
                    <button
                      type="button" key={s.key} onClick={() => setScenario(s.key)}
                      className={`rounded-full px-3 py-1.5 transition ${scenario === s.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                  Opening cash what-if
                  <Input
                    type="number" className="h-8 w-32 rounded-full text-xs"
                    value={openingOverride}
                    onChange={(e) => setOpeningOverride(e.target.value)}
                    placeholder={fmtINR(forecast.currentCash)}
                  />
                </label>
              </div>

              <div className="mt-3 h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeline} barGap={3} barCategoryGap="20%" onClick={(e) => { if (e?.activePayload?.[0]?.payload?.key && e.activePayload[0].payload.isForecast) setSelectedKey(e.activePayload[0].payload.key); }}>
                    <defs>
                      <linearGradient id="ff-cash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={INDIGO} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={INDIGO} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeWidth={1} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                    <RechartsTooltip contentStyle={{ borderRadius: 14, border: '2px solid #cbd5e1', fontSize: 11 }} formatter={(value, name) => [fmtTooltip(value), name]} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    <ReferenceLine y={0} stroke="#64748b" strokeWidth={2} />
                    <Bar dataKey="inflow" name="Inflow" fill={EMERALD} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="outflow" name="Outflow" fill={ROSE} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Line type="monotone" dataKey="net" name="Net" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3, fill: AMBER, stroke: '#fff', strokeWidth: 1.5 }} />
                    <Area type="monotone" dataKey="projectedClosingCash" name="Projected cash" stroke={INDIGO} strokeWidth={3} fill="url(#ff-cash)" connectNulls dot={{ r: 3, fill: INDIGO, stroke: '#fff', strokeWidth: 1.5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Left of the gap is actual history; right is the {scenario} scenario forecast. Click a forecast month for details.
              </p>
            </div>

            <aside className="flex flex-col rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${selectedMonth ? (selectedMonth.scenarios[scenario].projectedClosingCash < 0 ? 'bg-rose-500' : 'bg-indigo-500') : 'bg-slate-300'}`} />
                <p className="text-xs font-semibold text-slate-800">{selectedMonth?.label || 'Select a forecast month'}</p>
              </div>
              {selectedMonth && (
                <>
                  <p className="mt-5 text-[10px] font-medium text-slate-500">Projected closing cash ({scenario})</p>
                  <p className={`mt-1 text-3xl font-bold tracking-tight ${selectedMonth.scenarios[scenario].projectedClosingCash < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>
                    {fmtINR(selectedMonth.scenarios[scenario].projectedClosingCash + overrideOffset)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Range {fmtINR(selectedMonth.scenarios[scenario].lowerBound + overrideOffset)} – {fmtINR(selectedMonth.scenarios[scenario].upperBound + overrideOffset)}
                  </p>
                  <div className="mt-5 divide-y-2 divide-slate-100 border-y-2 border-slate-100">
                    {[
                      { label: 'Pattern inflow', value: selectedMonth.patternInflow, cls: 'text-emerald-700' },
                      { label: 'Scheduled inflow', value: selectedMonth.scheduledInflow, cls: 'text-emerald-600' },
                      { label: 'Pattern outflow', value: selectedMonth.patternOutflow, cls: 'text-rose-600' },
                      { label: 'Scheduled outflow', value: selectedMonth.scheduledOutflow, cls: 'text-rose-500' },
                      { label: 'Net movement', value: selectedMonth.scenarios[scenario].net, cls: selectedMonth.scenarios[scenario].net >= 0 ? 'text-cyan-700' : 'text-rose-600' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-2.5 text-[11px]">
                        <span className="font-medium text-slate-600">{row.label}</span>
                        <span className={`font-bold ${row.cls}`}>{fmtINR(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-auto space-y-2 border-t-2 border-slate-100 pt-4">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 font-semibold text-slate-700"><Gauge className="h-3 w-3" /> Confidence</span>
                  <span className={`rounded-full border px-2 py-0.5 font-semibold capitalize ${CONFIDENCE_STYLE[forecast.confidenceLevel] || ''}`}>{forecast.confidenceLevel} · {forecast.confidenceScore}</span>
                </div>
                <p className="text-[10px] leading-5 text-slate-500">
                  Inflow trend {forecast.inflowTrendPct >= 0 ? '+' : ''}{forecast.inflowTrendPct}%/mo · Outflow trend {forecast.outflowTrendPct >= 0 ? '+' : ''}{forecast.outflowTrendPct}%/mo. Volatility: inflow {forecast.inflowVolatility}, outflow {forecast.outflowVolatility}.
                </p>
                <p className="flex items-start gap-1 text-[10px] leading-4 text-slate-400"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {forecast.disclaimer}</p>
              </div>
            </aside>
          </section>

          {/* Month-by-month table */}
          <section className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="mb-3 text-sm font-semibold text-slate-800">Month-by-month forecast · {scenario}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 pr-3 text-right">Pattern in</th>
                    <th className="py-2 pr-3 text-right">Pattern out</th>
                    <th className="py-2 pr-3 text-right">Scheduled in</th>
                    <th className="py-2 pr-3 text-right">Scheduled out</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 pr-3 text-right">Projected cash</th>
                    <th className="py-2 text-right">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.months.map((m) => {
                    const s = m.scenarios[scenario];
                    const cash = round2(s.projectedClosingCash + overrideOffset);
                    return (
                      <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer" onClick={() => setSelectedKey(m.key)}>
                        <td className="py-2 pr-3 font-medium text-slate-700">{m.label}</td>
                        <td className="py-2 pr-3 text-right text-emerald-700 tabular-nums">{fmtINR(m.patternInflow)}</td>
                        <td className="py-2 pr-3 text-right text-rose-600 tabular-nums">{fmtINR(m.patternOutflow)}</td>
                        <td className="py-2 pr-3 text-right text-emerald-600 tabular-nums">{fmtINR(m.scheduledInflow)}</td>
                        <td className="py-2 pr-3 text-right text-rose-500 tabular-nums">{fmtINR(m.scheduledOutflow)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${s.net >= 0 ? 'text-cyan-700' : 'text-rose-600'}`}>{fmtINR(s.net)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${cash < 0 ? 'text-rose-600' : 'text-indigo-700'}`}>{fmtINR(cash)}</td>
                        <td className="py-2 text-right text-slate-400 tabular-nums">{fmt(s.lowerBound + overrideOffset)}–{fmt(s.upperBound + overrideOffset)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Receivables / payables */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="mb-3 text-sm font-semibold text-slate-800">Known receivables &amp; payables</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Overdue receivables', value: dueItems.overdueReceivables, cls: 'text-amber-700 bg-amber-50 border-amber-200', icon: AlertTriangle },
                  { label: 'Vendor overdue', value: dueItems.vendorOverdue, cls: 'text-rose-700 bg-rose-50 border-rose-200', icon: AlertTriangle },
                  { label: 'Vendor unscheduled', value: dueItems.vendorUnscheduled, cls: 'text-slate-700 bg-slate-50 border-slate-200', icon: CalendarClock },
                  { label: 'Land-owner outstanding', value: dueItems.farmerOutstanding, cls: 'text-slate-700 bg-slate-50 border-slate-200', icon: Landmark },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl border-2 p-3 ${item.cls}`}>
                    <p className="flex items-center gap-1 text-[10px] font-medium">{createElement(item.icon, { className: 'h-3 w-3' })} {item.label}</p>
                    <p className="mt-1 text-base font-bold tabular-nums">{fmtINR(item.value)}</p>
                  </div>
                ))}
              </div>
              {!hasUnscheduled && <p className="mt-3 text-[11px] text-slate-400">No overdue or unscheduled exposure right now.</p>}
              <p className="mt-3 text-[10px] text-slate-400">These are undated or overdue liabilities — reported separately as "Unscheduled exposure" rather than fake-dated into a specific month.</p>
            </div>

            <div className="rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="mb-3 text-sm font-semibold text-slate-800">Diagnostics</p>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weekday activity ({lookbackMonths}mo)</p>
                  <div className="grid grid-cols-7 gap-1">
                    {forecast.weekdayPattern.map((d) => (
                      <div key={d.weekday} className="rounded-lg border border-slate-100 bg-slate-50/70 p-1.5 text-center">
                        <p className="text-[9px] font-semibold text-slate-500">{d.label}</p>
                        <p className="text-[10px] font-bold text-slate-700 tabular-nums">{d.txnCount}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Historical source mix (last completed month)</p>
                  <div className="space-y-1">
                    {[...forecast.sourceMixRevenue.map((s) => ({ ...s, dir: 'in' })), ...forecast.sourceMixExpense.map((s) => ({ ...s, dir: 'out' }))]
                      .filter((s) => s.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map((s) => (
                        <div key={`${s.dir}-${s.source}`} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600">{s.source.replaceAll('_', ' ')}</span>
                          <span className={`font-semibold tabular-nums ${s.dir === 'in' ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtINR(s.amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
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
