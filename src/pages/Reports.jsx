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
import { sanitizeSpreadsheetRows } from '../lib/spreadsheetSecurity';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  PageHeader, PageTabs, SectionHead, EmptyBlock,
  FIELD, GHOST_BTN, PRIMARY_BTN,
} from '../components/ui/page';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  BarChart3, Search, Loader2, Download, RefreshCw, Sparkles, AlertTriangle,
  ArrowUpDown, FileSpreadsheet, Lightbulb, ListChecks, CalendarRange, Inbox,
} from 'lucide-react';

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

/* House palette — categorical series read left to right in this order. */
const BAR_COLORS = ['#2f6bff', '#50ddeb', '#8bb400', '#ffb02e', '#ff654a', '#101114', '#7c5cff', '#0a7a8a', '#98a0ad', '#e0468f', '#b9ff45', '#35b6e8'];
const AXIS = { fontSize: 11, fill: '#98a0ad' };
const GRID = 'rgba(16,17,20,0.08)';
const TOOLTIP = { fontSize: 12, borderRadius: 14, border: '1px solid rgba(16,17,20,0.08)', boxShadow: '0 8px 24px -12px rgba(16,17,20,0.2)' };

const SEVERITY = {
  high: 'border-mr-coral-ink/20 bg-mr-coral-soft text-mr-coral-ink',
  medium: 'border-mr-amber-ink/20 bg-mr-amber-soft text-mr-amber-ink',
  low: 'border-mr-line bg-mr-surface-2 text-mr-muted',
};

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
    const data = sanitizeSpreadsheetRows(rows.map((r) =>
      Object.fromEntries(report.columns.map((c) => [c.label, c.type === 'date' ? fmtDate(r[c.key]) : r[c.key]]))
    ));
    const sheet = XLSX.utils.json_to_sheet(data);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, report.module.slice(0, 30));
    XLSX.writeFile(book, `${report.module}_${range.from}_to_${range.to}.${format}`, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
    toast.success(`Exported ${rows.length} rows`);
  };

  if (!currentSite) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3">
        <BarChart3 className="h-9 w-9 text-mr-faint" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-[14px] text-mr-muted">Select a site to generate reports</p>
      </div>
    );
  }

  const activeModule = modules.find((m) => m.key === active);
  const hasAmount = report?.kpis?.some((k) => k.type === 'money');

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <PageHeader
        title="Reports"
        description={`Detailed, exportable reports across every module · ${currentSite.name}`}
        actions={
          <>
            <Select value={rangeKey} onValueChange={applyRange}>
              <SelectTrigger className={cn(FIELD, 'w-[176px]')}>
                <CalendarRange className="mr-1.5 h-3.5 w-3.5 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RANGES).map(([key, r]) => <SelectItem key={key} value={key}>{r.label}</SelectItem>)}
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {rangeKey === 'custom' && (
              <>
                <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={cn(FIELD, 'w-[150px]')} />
                <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={cn(FIELD, 'w-[150px]')} />
              </>
            )}
            <button type="button" className={GHOST_BTN} onClick={fetchReport} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} strokeWidth={1.9} aria-hidden="true" /> Refresh
            </button>
            <button type="button" className={GHOST_BTN} onClick={() => exportRows('csv')} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> CSV
            </button>
            <button type="button" className={GHOST_BTN} onClick={() => exportRows('xlsx')} disabled={!rows.length}>
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Excel
            </button>
          </>
        }
      />

      {/* The permission-filtered module list, one tab each. */}
      {modules.length === 0
        ? <p className="mt-7 border-b border-mr-line pb-3 text-[13px] text-mr-faint">No modules available</p>
        : <PageTabs className="mt-7" label="Report modules" items={modules.map((m) => ({ id: m.key, label: m.label }))} value={active} onChange={setActive} />}

      {error && (
        <p className="mt-6 flex items-center gap-2 rounded-control bg-mr-coral-soft px-4 py-3 text-[13px] text-mr-coral-ink">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> {error}
        </p>
      )}

      {loading && !report && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-control" />)}
          </div>
          <Skeleton className="h-[300px] rounded-control" />
          <Skeleton className="h-[280px] rounded-control" />
        </div>
      )}

      {report && (
        <>
          {/* ── Report identity + totals ── */}
          <section className="pt-8">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-mr-text">{report.label}</h2>
            <p className="mt-1 text-[14px] text-mr-muted">
              {report.description} · {fmtDate(report.range.from)} – {fmtDate(report.range.to)}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-mr-line pt-6 sm:grid-cols-3 lg:grid-cols-5">
              {report.kpis.map((k) => (
                <div key={k.key} className="min-w-0">
                  <dt className="truncate text-[13px] text-mr-muted">{k.label}</dt>
                  <dd className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-mr-text">
                    {k.type === 'money' ? money(k.value) : num(k.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Trend ── */}
          <section className="mt-10">
            <SectionHead
              title={`Trend by ${report.range.bucket}`}
              meta={`${report.trend.length} periods`}
            />
            {report.trend.length === 0 ? (
              <EmptyBlock title="No entries in this period" />
            ) : (
              <div className="pt-5">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={report.trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v) => fmtDate(v).replace(/ \d{4}$/, '')} />
                    <YAxis yAxisId="left" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={compact} />
                    <YAxis yAxisId="right" orientation="right" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={TOOLTIP}
                      formatter={(value, name) => [name === 'Records' ? num(value) : money(value), name]}
                      labelFormatter={fmtDate}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {hasAmount && <Bar yAxisId="left" dataKey="total" name="Value" fill="#2f6bff" radius={[4, 4, 0, 0]} maxBarSize={38} />}
                    <Line yAxisId="right" type="monotone" dataKey="count" name="Records" stroke="#0a7a8a" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── Breakdown ── */}
          <section className="mt-10">
            <SectionHead title={`By ${report.dimension_label.toLowerCase()}`} />
            {report.breakdown.length === 0 ? (
              <EmptyBlock title="Nothing to group" />
            ) : (
              <div className="pt-5">
                <ResponsiveContainer width="100%" height={Math.max(200, report.breakdown.length * 30)}>
                  <BarChart data={report.breakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={hasAmount ? compact : num} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ ...AXIS, fill: '#626b7a' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={TOOLTIP}
                      formatter={(value, _n, entry) => [hasAmount ? money(value) : num(value), `${entry.payload.count} records`]}
                    />
                    <Bar dataKey={hasAmount ? 'total' : 'count'} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {report.breakdown.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── AI analysis ── */}
          <section className="mt-10">
            <SectionHead
              title="AI analysis"
              actions={
                <button type="button" className={PRIMARY_BTN} onClick={generateInsight} disabled={aiLoading || !report.rows.length}>
                  {aiLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />}
                  {insight ? 'Regenerate' : 'Analyse with AI'}
                </button>
              }
            />

            {!insight && !aiLoading && (
              <p className="max-w-2xl py-6 text-[13px] leading-relaxed text-mr-muted">
                Groq reads this report&apos;s totals, trend and breakdown and writes an executive summary with risks and next actions.
              </p>
            )}
            {aiLoading && (
              <div className="space-y-2 py-6">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            )}
            {insight && !aiLoading && (
              <div className="space-y-5 pt-5">
                <div className="max-w-3xl">
                  <p className="text-[15px] font-semibold text-mr-text">{insight.headline}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-mr-muted">{insight.summary}</p>
                </div>

                {insight.highlights?.length > 0 && (
                  <dl className="grid gap-x-8 gap-y-4 border-t border-mr-line pt-5 sm:grid-cols-2">
                    {insight.highlights.map((h, i) => (
                      <div key={i} className="min-w-0">
                        <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-mr-text">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-mr-amber-ink" strokeWidth={1.9} aria-hidden="true" /> {h.title}
                        </dt>
                        <dd className="mt-1 text-[13px] leading-relaxed text-mr-muted">{h.detail}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {insight.risks?.length > 0 && (
                  <div className="space-y-2 border-t border-mr-line pt-5">
                    {insight.risks.map((r, i) => (
                      <div key={i} className={cn('rounded-control border p-3', SEVERITY[r.severity] || SEVERITY.low)}>
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" /> {r.title}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed opacity-90">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {insight.actions?.length > 0 && (
                  <div className="border-t border-mr-line pt-5">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-mr-text">
                      <ListChecks className="h-3.5 w-3.5 text-mr-lime-ink" strokeWidth={1.9} aria-hidden="true" /> Next actions
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {insight.actions.map((a, i) => (
                        <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-mr-muted">
                          <span className="text-mr-faint" aria-hidden="true">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[12px] text-mr-faint">AI-generated from this report&apos;s data — verify before circulating.</p>
              </div>
            )}
          </section>

          {/* ── Detail rows ── */}
          <section className="mt-10">
            <SectionHead
              title="Detail"
              meta={`${rows.length} of ${report.rows.length} rows`}
              actions={
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                  <Input value={rowSearch} onChange={(e) => setRowSearch(e.target.value)} placeholder="Filter rows…" aria-label="Filter rows" className={cn(FIELD, 'pl-9')} />
                </div>
              }
            />

            {rows.length === 0 ? (
              <EmptyBlock title={report.rows.length ? 'No rows match your filter' : 'No records in this period'} tall />
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 z-20 bg-mr-surface" style={{ boxShadow: `0 1px 0 0 ${GRID}` }}>
                    <tr>
                      {report.columns.map((c) => (
                        <th
                          key={c.key}
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            'cursor-pointer select-none whitespace-nowrap px-3 py-3 text-[12px] font-medium text-mr-muted transition-colors hover:text-mr-text',
                            c.type === 'money' || c.type === 'number' ? 'text-right' : 'text-left',
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            <ArrowUpDown className={cn('h-3 w-3', sort.key === c.key ? 'text-mr-blue' : 'text-mr-faint')} aria-hidden="true" />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-mr-line transition-colors hover:bg-mr-surface-2/60">
                        {report.columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              'px-3 py-2.5 text-mr-muted',
                              (c.type === 'money' || c.type === 'number') && 'text-right tabular-nums',
                              c.type === 'money' && 'font-medium text-mr-text',
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
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mr-amber-soft px-3 py-1.5 text-[12px] font-medium text-mr-amber-ink">
                Showing the most recent 1000 rows — narrow the date range for a complete export.
              </p>
            )}
          </section>
        </>
      )}

      {!loading && !report && !error && activeModule && (
        <EmptyBlock title={`No data for ${activeModule.label} in this period`} tall />
      )}
    </div>
  );
};

export default Reports;
