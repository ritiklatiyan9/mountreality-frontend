import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, BarChart, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  BarChart3, Search, Loader2, Download, RefreshCw, Sparkles, AlertTriangle,
  TrendingUp, ArrowUpDown, FileSpreadsheet, Lightbulb, ListChecks, CalendarRange,
  IndianRupee, LandPlot, Receipt, Store, FileSignature, PackageSearch, Boxes,
  HardHat, Wheat, BookOpen, ArrowLeftRight, Building2, HandCoins, ScrollText,
  Wallet, Users, Inbox,
} from 'lucide-react';

// Icon names come from the backend report definitions.
const ICONS = {
  IndianRupee, LandPlot, Receipt, Store, FileSignature, PackageSearch, Boxes,
  HardHat, Wheat, BookOpen, ArrowLeftRight, Building2, HandCoins, ScrollText,
  Wallet, Users,
};

// ── Formatters (house style — mirrors dashboard/CashFlowForecast.jsx) ──
const compact = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};
const money = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const num = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const cell = (value, type) => {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return money(value);
  if (type === 'number') return num(value);
  if (type === 'date') return fmtDate(value);
  return String(value);
};

const iso = (d) => d.toISOString().slice(0, 10);
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
// Indian financial year starts 1 April.
const startOfFY = (d = new Date()) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);

const RANGES = {
  this_month: { label: 'This month', from: () => iso(startOfMonth()), to: () => iso(new Date()) },
  last_30: { label: 'Last 30 days', from: () => iso(new Date(Date.now() - 30 * 864e5)), to: () => iso(new Date()) },
  last_90: { label: 'Last 90 days', from: () => iso(new Date(Date.now() - 90 * 864e5)), to: () => iso(new Date()) },
  fy: { label: 'This financial year', from: () => iso(startOfFY()), to: () => iso(new Date()) },
  last_year: { label: 'Last 12 months', from: () => iso(new Date(Date.now() - 365 * 864e5)), to: () => iso(new Date()) },
  all: { label: 'All time', from: () => '2015-01-01', to: () => iso(new Date()) },
};

const BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7', '#14b8a6', '#f97316', '#64748b', '#ec4899', '#84cc16', '#8b5cf6'];
const SEVERITY = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const EmptyBlock = ({ label, tall }) => (
  <div className={cn('flex flex-col items-center justify-center text-center text-slate-400', tall ? 'py-16' : 'py-10')}>
    <Inbox className="mb-2 h-8 w-8 text-slate-200" />
    <p className="text-xs">{label}</p>
  </div>
);

export const Reports = () => {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [modules, setModules] = useState([]);
  const [active, setActive] = useState(searchParams.get('module') || '');
  const [rangeKey, setRangeKey] = useState('fy');
  const [range, setRange] = useState({ from: RANGES.fy.from(), to: RANGES.fy.to() });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowSearch, setRowSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'desc' });

  const [insight, setInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Module list arrives already filtered to this user's permissions.
  useEffect(() => {
    api.get('/reports/modules')
      .then((res) => {
        const list = res.data.modules || [];
        setModules(list);
        setActive((cur) => cur || list[0]?.key || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load report modules'));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!siteId || !active) return;
    setLoading(true);
    setError('');
    setInsight(null);
    try {
      const res = await api.get(`/reports/${active}`, {
        params: { site_id: siteId, from: range.from, to: range.to, limit: 1000 },
      });
      setReport(res.data.report);
      setSort({ key: null, dir: 'desc' });
      setRowSearch('');
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || 'Could not generate this report');
    } finally {
      setLoading(false);
    }
  }, [siteId, active, range.from, range.to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    if (active) setSearchParams({ module: active }, { replace: true });
  }, [active, setSearchParams]);

  const applyRange = (key) => {
    setRangeKey(key);
    if (key !== 'custom') setRange({ from: RANGES[key].from(), to: RANGES[key].to() });
  };

  const generateInsight = async () => {
    if (!report || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post(`/reports/${active}/ai`, { site_id: siteId, from: range.from, to: range.to });
      setInsight(res.data.insight);
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Detail table: search + sort, client-side over the fetched rows.
  const rows = useMemo(() => {
    if (!report) return [];
    const q = rowSearch.trim().toLowerCase();
    let out = q
      ? report.rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
      : report.rows;
    if (sort.key) {
      const type = report.columns.find((c) => c.key === sort.key)?.type;
      const dir = sort.dir === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key];
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        if (type === 'money' || type === 'number') return (Number(x) - Number(y)) * dir;
        if (type === 'date') return (new Date(x) - new Date(y)) * dir;
        return String(x).localeCompare(String(y)) * dir;
      });
    }
    return out;
  }, [report, rowSearch, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const exportRows = (format) => {
    if (!report || !rows.length) return;
    const data = rows.map((r) =>
      Object.fromEntries(report.columns.map((c) => [c.label, c.type === 'date' ? fmtDate(r[c.key]) : r[c.key]]))
    );
    const sheet = XLSX.utils.json_to_sheet(data);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, report.module.slice(0, 30));
    XLSX.writeFile(book, `${report.module}_${range.from}_to_${range.to}.${format}`, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
    toast.success(`Exported ${rows.length} rows`);
  };

  if (!currentSite) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
        <BarChart3 className="h-10 w-10" />
        <p className="text-sm">Select a site to generate reports</p>
      </div>
    );
  }

  const activeModule = modules.find((m) => m.key === active);
  const hasAmount = report?.kpis?.some((k) => k.type === 'money');

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg shadow-indigo-200">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Reports</h1>
            <p className="text-xs text-slate-500">
              Detailed, exportable reports across every module · {currentSite.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangeKey} onValueChange={applyRange}>
            <SelectTrigger className="h-9 w-[170px] text-xs">
              <CalendarRange className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([key, r]) => <SelectItem key={key} value={key}>{r.label}</SelectItem>)}
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {rangeKey === 'custom' && (
            <>
              <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 w-[145px] text-xs" />
              <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 w-[145px] text-xs" />
            </>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => exportRows('csv')} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={() => exportRows('xlsx')} disabled={!rows.length}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* ── Module rail ── */}
        <Card className="h-fit rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04] lg:sticky lg:top-4">
          <CardContent className="p-2">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Modules</p>
            <div className="max-h-[70vh] space-y-0.5 overflow-y-auto">
              {modules.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">No modules available</p>}
              {modules.map((m) => {
                const Icon = ICONS[m.icon] || BarChart3;
                return (
                  <button
                    key={m.key}
                    onClick={() => setActive(m.key)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
                      active === m.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active === m.key ? 'text-indigo-600' : 'text-slate-400')} />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Report body ── */}
        <div className="min-w-0 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && !report && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-2xl" />)}
              </div>
              <Skeleton className="h-[300px] rounded-2xl" />
              <Skeleton className="h-[280px] rounded-2xl" />
            </div>
          )}

          {report && (
            <>
              <div>
                <h2 className="text-base font-bold text-slate-900">{report.label}</h2>
                <p className="text-xs text-slate-500">
                  {report.description} · {fmtDate(report.range.from)} – {fmtDate(report.range.to)}
                </p>
              </div>

              {/* KPIs */}
              <div className={cn('grid gap-3', report.kpis.length >= 5 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-3')}>
                {report.kpis.map((k) => (
                  <Card key={k.key} className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
                    <CardContent className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{k.label}</p>
                      <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">
                        {k.type === 'money' ? money(k.value) : num(k.value)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Trend */}
              <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <TrendingUp className="h-4 w-4 text-slate-400" /> Trend by {report.range.bucket}
                    </h3>
                    <Badge variant="outline" className="text-[10px] text-slate-500">{report.trend.length} periods</Badge>
                  </div>
                  {report.trend.length === 0 ? (
                    <EmptyBlock label="No entries in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={report.trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => fmtDate(v).replace(/ \d{4}$/, '')} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={compact} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                        <RechartsTooltip
                          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
                          formatter={(value, name) => [name === 'Records' ? num(value) : money(value), name]}
                          labelFormatter={fmtDate}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {hasAmount && <Bar yAxisId="left" dataKey="total" name="Value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={38} />}
                        <Line yAxisId="right" type="monotone" dataKey="count" name="Records" stroke="#10b981" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Breakdown + AI */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
                  <CardContent className="p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">By {report.dimension_label.toLowerCase()}</h3>
                    {report.breakdown.length === 0 ? (
                      <EmptyBlock label="Nothing to group" />
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(200, report.breakdown.length * 30)}>
                        <BarChart data={report.breakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={hasAmount ? compact : num} />
                          <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10, fill: '#64748b' }} />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
                            formatter={(value, _n, entry) => [hasAmount ? money(value) : num(value), `${entry.payload.count} records`]}
                          />
                          <Bar dataKey={hasAmount ? 'total' : 'count'} radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {report.breakdown.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-indigo-200/70 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm shadow-indigo-900/[0.05]">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <Sparkles className="h-4 w-4 text-indigo-500" /> AI analysis
                      </h3>
                      <Button size="sm" className="h-8 gap-1.5 bg-indigo-600 text-xs hover:bg-indigo-700" onClick={generateInsight} disabled={aiLoading || !report.rows.length}>
                        {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {insight ? 'Regenerate' : 'Analyse with AI'}
                      </Button>
                    </div>

                    {!insight && !aiLoading && (
                      <p className="py-8 text-center text-xs text-slate-500">
                        Groq reads this report's totals, trend and breakdown and writes an executive summary with risks and next actions.
                      </p>
                    )}
                    {aiLoading && (
                      <div className="space-y-2 py-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-11/12" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    )}
                    {insight && !aiLoading && (
                      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{insight.headline}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{insight.summary}</p>
                        </div>
                        {insight.highlights?.length > 0 && (
                          <div className="space-y-1.5">
                            {insight.highlights.map((h, i) => (
                              <div key={i} className="rounded-xl border border-slate-200 bg-white p-2.5">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> {h.title}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{h.detail}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {insight.risks?.length > 0 && (
                          <div className="space-y-1.5">
                            {insight.risks.map((r, i) => (
                              <div key={i} className={cn('rounded-xl border p-2.5', SEVERITY[r.severity] || SEVERITY.low)}>
                                <p className="flex items-center gap-1.5 text-xs font-semibold">
                                  <AlertTriangle className="h-3.5 w-3.5" /> {r.title}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{r.detail}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {insight.actions?.length > 0 && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                              <ListChecks className="h-3.5 w-3.5" /> Next actions
                            </p>
                            <ul className="mt-1 space-y-1">
                              {insight.actions.map((a, i) => (
                                <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-emerald-900">
                                  <span className="text-emerald-500">•</span> {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="pt-1 text-[10px] text-slate-400">AI-generated from this report's data — verify before circulating.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detail rows */}
              <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Detail <span className="ml-1 text-xs font-normal text-slate-400">{rows.length} of {report.rows.length} rows</span>
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} placeholder="Filter rows…" className="h-8 pl-8 text-xs" />
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <EmptyBlock label={report.rows.length ? 'No rows match your filter' : 'No records in this period'} tall />
                  ) : (
                    <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 z-20 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                          <tr>
                            {report.columns.map((c) => (
                              <th
                                key={c.key}
                                onClick={() => toggleSort(c.key)}
                                className={cn(
                                  'cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800',
                                  c.type === 'money' || c.type === 'number' ? 'text-right' : 'text-left'
                                )}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {c.label}
                                  <ArrowUpDown className={cn('h-3 w-3', sort.key === c.key ? 'text-indigo-500' : 'text-slate-300')} />
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                              {report.columns.map((c) => (
                                <td
                                  key={c.key}
                                  className={cn(
                                    'px-3 py-2 text-slate-700',
                                    (c.type === 'money' || c.type === 'number') && 'text-right tabular-nums',
                                    c.type === 'money' && 'font-medium text-slate-900'
                                  )}
                                >
                                  {cell(r[c.key], c.type)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {report.row_limit_hit && (
                    <p className="border-t border-slate-100 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700">
                      Showing the most recent 1000 rows — narrow the date range for a complete export.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!loading && !report && !error && activeModule && (
            <EmptyBlock label={`No data for ${activeModule.label} in this period`} tall />
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
