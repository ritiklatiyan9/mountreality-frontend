import { createElement, useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ReferenceLine,
} from 'recharts';
import api from '../../api/api';
import { Input } from '../ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  TrendingUp, TrendingDown, Wallet, Loader2, ArrowDownRight, ArrowUpRight,
  AlertTriangle, CalendarClock, Landmark, Info,
} from 'lucide-react';

// ── Currency formatters (house style — no shared util exists in src/lib) ──
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

const EMERALD = '#10b981', ROSE = '#f43f5e', AMBER = '#f59e0b', INDIGO = '#6366f1';

// ── Main forecast workspace ──
function CashFlowForecast({ siteId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState(6);
  const [lookback, setLookback] = useState(6);
  const [view, setView] = useState('monthly'); // monthly | cumulative
  const [opening, setOpening] = useState('');
  const [selected, setSelected] = useState(null); // month key

  const fetchForecast = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const { data: d } = await api.get('/forecast', { params: { site_id: siteId, months: horizon, lookback } });
      setData(d);
      // Keep the selection only if it still exists in the new horizon (e.g. after 12mo → 3mo).
      setSelected((prev) => (d.months?.some((m) => m.key === prev) ? prev : d.months?.[0]?.key) || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [siteId, horizon, lookback]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  const open0 = Number(opening) || 0;

  // Cumulative "net cash availability" = opening + running sum of monthly net.
  const rows = useMemo(() => {
    if (!data?.months) return [];
    let run = open0;
    return data.months.map((m) => {
      run += m.net;
      return { ...m, avail: Math.round(run * 100) / 100 };
    });
  }, [data, open0]);

  const chartData = useMemo(
    () => rows.map((m) => ({ label: m.label, key: m.key, inflow: m.inflow, outflow: m.outflow, net: m.net, avail: m.avail })),
    [rows]
  );

  const lowest = useMemo(() => (rows.length ? rows.reduce((lo, m) => (m.avail < lo.avail ? m : lo), rows[0]) : null), [rows]);
  const selectedMonth = useMemo(() => rows.find((m) => m.key === selected) || null, [rows, selected]);
  const ctx = data?.context || {};
  const hasUnscheduled = (ctx.overdueReceivables || 0) + (ctx.vendorOverdue || 0) + (ctx.vendorUnscheduled || 0) + (ctx.farmerOutstanding || 0) > 0;

  if (!siteId) return null;

  return (
    <section className="relative overflow-hidden rounded-[30px] border-2 border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-900/[0.05]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-r from-cyan-50/80 via-white to-indigo-50/70" />
      <header className="relative flex flex-col gap-4 border-b-2 border-slate-200 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 ring-4 ring-white"><TrendingUp className="h-5 w-5" /></span><div><h3 className="text-base font-semibold text-slate-950">Cash runway studio</h3><p className="mt-0.5 text-[11px] text-slate-500">Forward cash position from recent run-rate and scheduled obligations</p></div></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(lookback)} onValueChange={(value) => setLookback(Number(value))}><SelectTrigger className="h-9 w-[122px] rounded-full border-2 border-slate-200 bg-white text-xs text-slate-700 shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3mo history</SelectItem><SelectItem value="6">6mo history</SelectItem><SelectItem value="12">12mo history</SelectItem></SelectContent></Select>
          <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value))}><SelectTrigger className="h-9 w-[112px] rounded-full border-2 border-slate-200 bg-white text-xs text-slate-700 shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">3 months</SelectItem><SelectItem value="6">6 months</SelectItem><SelectItem value="12">12 months</SelectItem></SelectContent></Select>
        </div>
      </header>

      {loading ? <div className="relative flex h-96 items-center justify-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : !data ? <div className="relative flex h-56 items-center justify-center text-sm text-slate-500">Could not load the forecast.</div> : (
        <div className="relative">
          <div className="grid border-b-2 border-slate-200 bg-white/80 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ArrowDownRight, label: `${horizon}-month inflow`, value: data.totals.inflow, color: 'text-emerald-700', iconBg: 'bg-emerald-50' },
              { icon: ArrowUpRight, label: `${horizon}-month outflow`, value: data.totals.outflow, color: 'text-rose-600', iconBg: 'bg-rose-50' },
              { icon: Wallet, label: 'Projected net', value: data.totals.net, color: data.totals.net >= 0 ? 'text-cyan-700' : 'text-rose-600', iconBg: data.totals.net >= 0 ? 'bg-cyan-50' : 'bg-rose-50' },
              { icon: lowest?.avail < 0 ? TrendingDown : CalendarClock, label: `Lowest cash${lowest ? ` · ${lowest.label}` : ''}`, value: lowest?.avail, color: lowest?.avail < 0 ? 'text-rose-600' : 'text-violet-700', iconBg: lowest?.avail < 0 ? 'bg-rose-50' : 'bg-violet-50' },
            ].map((metric, index) => <div key={metric.label} className={`flex items-center gap-3 px-5 py-4 ${index < 3 ? 'lg:border-r-2 lg:border-slate-200' : ''}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full ${metric.iconBg}`}>{createElement(metric.icon, { className: `h-4 w-4 ${metric.color}` })}</span><span><span className="block text-[10px] font-medium text-slate-500">{metric.label}</span><span className={`mt-0.5 block text-lg font-bold ${metric.color}`}>{metric.value === undefined ? '—' : fmtINR(metric.value)}</span></span></div>)}
          </div>

          <div className="grid gap-4 bg-slate-50/60 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[24px] border-2 border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-[10px] font-semibold">{['monthly', 'cumulative'].map((mode) => <button type="button" key={mode} onClick={() => setView(mode)} className={`rounded-full px-3 py-1.5 transition ${view === mode ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500'}`}>{mode === 'cumulative' ? 'Cash runway' : 'Monthly flow'}</button>)}</div>
                <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">Opening cash<Input type="number" className="h-8 w-28 rounded-full text-xs" value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="₹ 0" /></label>
              </div>
              <div className="mt-3 h-80 w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} barGap={3} barCategoryGap="24%" onClick={(event) => { if (event?.activePayload?.[0]?.payload?.key) setSelected(event.activePayload[0].payload.key); }}><defs><linearGradient id="cf-avail" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={INDIGO} stopOpacity={0.3} /><stop offset="95%" stopColor={INDIGO} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeWidth={1.25} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} /><RechartsTooltip contentStyle={{ borderRadius: 14, border: '2px solid #cbd5e1', boxShadow: '0 12px 30px rgba(15,23,42,.12)', fontSize: 11 }} formatter={(value, name) => [fmtTooltip(value), name]} /><Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} /><ReferenceLine y={0} stroke="#64748b" strokeWidth={2} />{view === 'monthly' ? <><Bar dataKey="inflow" name="Inflow" fill={EMERALD} radius={[8, 8, 0, 0]} maxBarSize={34} /><Bar dataKey="outflow" name="Outflow" fill={ROSE} radius={[8, 8, 0, 0]} maxBarSize={34} /><Line type="monotone" dataKey="net" name="Net" stroke={AMBER} strokeWidth={3} dot={{ r: 4, fill: AMBER, stroke: '#fff', strokeWidth: 2 }} /></> : <Area type="monotone" dataKey="avail" name="Available cash" stroke={INDIGO} strokeWidth={3.5} fill="url(#cf-avail)" dot={{ r: 4, fill: INDIGO, stroke: '#fff', strokeWidth: 2 }} />}</ComposedChart></ResponsiveContainer></div>
              <div className="relative mt-2 flex gap-1 overflow-x-auto border-t-2 border-slate-200 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden before:absolute before:left-4 before:right-4 before:top-[25px] before:h-0.5 before:bg-slate-300">{rows.map((month) => <button type="button" key={month.key} onClick={() => setSelected(month.key)} className="relative z-10 min-w-20 text-center"><span className={`mx-auto block h-3.5 w-3.5 rounded-full ring-4 ring-white ${selected === month.key ? 'bg-cyan-600' : month.avail < 0 ? 'bg-rose-500' : 'bg-slate-400'}`} /><span className={`mt-2 block text-[10px] font-semibold ${selected === month.key ? 'text-slate-900' : 'text-slate-500'}`}>{month.label}</span></button>)}</div>
            </div>

            <aside className="flex flex-col rounded-[24px] border-2 border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${selectedMonth?.avail < 0 ? 'bg-rose-500' : 'bg-cyan-500'}`} /><p className="text-xs font-semibold text-slate-800">{selectedMonth?.label || 'Select a month'}</p></div>
              {selectedMonth && <><p className="mt-5 text-[10px] font-medium text-slate-500">Expected available cash</p><p className={`mt-1 text-3xl font-bold tracking-[-0.04em] ${selectedMonth.avail < 0 ? 'text-rose-600' : 'text-cyan-700'}`}>{fmtINR(selectedMonth.avail)}</p><div className="mt-5 divide-y-2 divide-slate-200 border-y-2 border-slate-200">{[{ label: 'Recovery inflow', value: selectedMonth.inflow, cls: 'text-emerald-700' }, { label: 'Payment outflow', value: selectedMonth.outflow, cls: 'text-rose-600' }, { label: 'Monthly net', value: selectedMonth.net, cls: selectedMonth.net >= 0 ? 'text-cyan-700' : 'text-rose-600' }].map((row) => <div key={row.label} className="flex items-center justify-between py-3 text-[11px]"><span className="font-medium text-slate-600">{row.label}</span><span className={`font-bold ${row.cls}`}>{fmtINR(row.value)}</span></div>)}</div></>}
              {data.runRate && <div className="mt-auto border-t-2 border-slate-200 pt-5"><p className="flex items-center gap-1 text-[10px] font-semibold text-slate-700"><Info className="h-3 w-3" /> Forecast method</p><p className="mt-2 text-[10px] leading-5 text-slate-500">Uses the last {data.runRate.lookbackMonths} months: {fmtINR(data.runRate.inflowPerMonth)}/mo incoming and {fmtINR(data.runRate.outflowPerMonth)}/mo outgoing, then applies larger scheduled dues.</p></div>}
            </aside>
          </div>

          {hasUnscheduled && <div className="flex flex-wrap items-center gap-2 border-t-2 border-slate-200 bg-white px-5 py-4 text-[10px]"><span className="inline-flex items-center gap-1 font-medium text-slate-500"><Info className="h-3.5 w-3.5" /> Outside the dated forecast:</span>{ctx.overdueReceivables > 0 && <Chip icon={AlertTriangle} label="Overdue recovery" value={fmtINR(ctx.overdueReceivables)} cls="border-amber-200 bg-amber-50 text-amber-700" />}{ctx.vendorOverdue > 0 && <Chip icon={AlertTriangle} label="Vendor overdue" value={fmtINR(ctx.vendorOverdue)} cls="border-rose-200 bg-rose-50 text-rose-700" />}{ctx.vendorUnscheduled > 0 && <Chip icon={CalendarClock} label="Vendor unscheduled" value={fmtINR(ctx.vendorUnscheduled)} cls="border-slate-200 bg-slate-50 text-slate-600" />}{ctx.farmerOutstanding > 0 && <Chip icon={Landmark} label="Land-owner outstanding" value={fmtINR(ctx.farmerOutstanding)} cls="border-slate-200 bg-slate-50 text-slate-600" />}</div>}
        </div>
      )}
    </section>
  );
}

function Chip({ icon, label, value, cls }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${cls}`}>
      {createElement(icon, { className: 'w-3 h-3' })} {label}: <b className="tabular-nums">{value}</b>
    </span>
  );
}

export default memo(CashFlowForecast);
