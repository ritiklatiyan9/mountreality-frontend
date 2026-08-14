import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SitePolicyContext } from '../context/SitePolicyContext';
import api from '../api/api';
import { encodeCsvCell } from '../lib/spreadsheetSecurity';
import { getPropertyTerminology } from '../lib/propertyTerminology';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Search, Filter, X, Loader2, Calendar, AlertTriangle,
  CheckCircle2, CalendarClock, TrendingDown,
  ChevronDown, ChevronRight, BarChart3, Banknote,
  Download,
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const MODES = [
  { value: 'overall_pending', label: 'Overall Pending', icon: Banknote, desc: 'Every balance that remains collectible' },
  { value: 'installment_pending', label: 'By Installment', icon: CalendarClock, desc: 'Pending by specific installment number' },
  { value: 'overdue_till_date', label: 'Overdue Till Date', icon: AlertTriangle, desc: 'All overdue installments as of today' },
  { value: 'month_pending', label: 'Month-wise Pending', icon: Calendar, desc: 'Installments due in a specific month' },
  { value: 'no_payment_since', label: 'No Payment in Month', icon: TrendingDown, desc: 'No receipt recorded in a specific month' },
  { value: 'custom_range', label: 'Custom Date Range', icon: Filter, desc: 'Installments due within custom range' },
];

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const STATUS_COLORS = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function PaymentAnalytics({ embedded = false }) {
  const { currentSite } = useAuth();
  const sitePolicy = useContext(SitePolicyContext);
  const siteId = currentSite?.id;
  const propertyTerms = useMemo(
    () => getPropertyTerminology(sitePolicy),
    [sitePolicy],
  );

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // ─── State ───
  const [mode, setMode] = useState('overall_pending');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Filter params
  const [installmentNo, setInstallmentNo] = useState('1');
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ─── Fetch ───
  const fetchAnalytics = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId, mode });
      if (mode === 'installment_pending') params.set('installment_no', installmentNo);
      if (mode === 'month_pending' || mode === 'no_payment_since') {
        params.set('month', month);
        params.set('year', year);
      }
      if (mode === 'custom_range') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      const res = await api.get(`/plots/payment-analytics?${params}`);
      setResults(res.data.results || []);
      setSummary(res.data.summary || {});
      setExpandedRows(new Set());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setResults([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [siteId, mode, installmentNo, month, year, dateFrom, dateTo]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ─── Filtered results ───
  const filtered = useMemo(() => {
    if (!search) return results;
    const q = search.toLowerCase();
    return results.filter(r =>
      (r.buyer_name || '').toLowerCase().includes(q) ||
      (r.plot_no || '').toLowerCase().includes(q) ||
      (r.block || '').toLowerCase().includes(q)
    );
  }, [results, search]);

  // ─── Toggle expand ───
  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Year options ───
  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) yearOptions.push(y);

  // ─── Mode info ───
  const currentMode = MODES.find(m => m.value === mode);

  // ─── Download CSV ───
  const downloadCSV = () => {
    if (filtered.length === 0) return;
    const headers = [propertyTerms.numberLabel, propertyTerms.blockLabel, 'Buyer Name', 'Sale Price', 'Received', 'Remaining', 'Interest Due', 'Status', 'Last Payment'];
    const rows = filtered.map(r => [
      r.plot_no, r.block || '', r.buyer_name || '', r.sale_price, r.total_received, r.total_remaining,
      r.interest_due || 0, r.plot_status || '', r.last_payment_date || '',
    ]);
    const csv = [headers.map(encodeCsvCell).join(','), ...rows.map(r => r.map(encodeCsvCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-analytics-${mode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={embedded ? 'min-w-0' : 'max-w-350 space-y-5 p-1'}>
      {/* Header */}
      {!embedded && <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-600" />
            Payment Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Analyze pending payments, overdue installments, and collection gaps</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV} disabled={filtered.length === 0} className="text-xs h-8">
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>}

      {/* Mode Selector */}
      <div className="flex min-w-0 gap-5 overflow-x-auto border-b border-mr-line px-4 md:px-6">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`min-w-max border-b-2 px-0.5 py-4 text-left transition-colors ${mode === m.value
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-mr-muted hover:text-mr-text'
                }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">{m.label}</span>
              </div>
            </button>
          );
        })}
        {embedded && <div className="ml-auto flex items-center py-3">
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={filtered.length === 0} className="h-8 min-w-max rounded-full border-mr-line text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>}
      </div>

      {/* Filters Bar */}
      <section className="border-b border-mr-line px-4 py-4 md:px-6">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-mr-text">{currentMode?.label}</h2>
            <p className="mt-0.5 text-[11px] text-mr-faint">{currentMode?.desc}</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {/* Search */}
            <div className="space-y-1 flex-1 min-w-48">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder={`${propertyTerms.singular} no., buyer name, ${propertyTerms.blockLabel.toLowerCase()}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Installment selector for installment_pending mode */}
            {mode === 'installment_pending' && (
              <div className="space-y-1 w-36">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Installment #</Label>
                <Select value={installmentNo} onValueChange={setInstallmentNo}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}{n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} Installment</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Month/Year for month_pending and no_payment_since */}
            {(mode === 'month_pending' || mode === 'no_payment_since') && (
              <>
                <div className="space-y-1 w-36">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-28">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Date range for custom_range */}
            {mode === 'custom_range' && (
              <>
                <div className="space-y-1 w-40">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From Date</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1 w-40">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To Date</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
              </>
            )}

            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="h-8 text-xs text-slate-500">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
      </section>

      {/* Compact summary strip */}
      <section className="grid border-b border-mr-line bg-mr-line sm:grid-cols-2 xl:grid-cols-4" aria-label="Analysis summary">
        {[
          { label: 'Customers', value: summary.total_persons || 0, tone: 'text-mr-text' },
          { label: 'Pending amount', value: `₹${fmt(summary.total_pending_amount)}`, tone: 'text-rose-600' },
          { label: 'Interest due', value: `₹${fmt(summary.total_interest_due)}`, tone: 'text-amber-700' },
          { label: 'Overdue customers', value: summary.overdue_persons || 0, tone: 'text-rose-600' },
        ].map((metric) => (
          <div key={metric.label} className="bg-mr-surface px-4 py-4 md:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-mr-faint">{metric.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums tracking-tight ${metric.tone}`}>{metric.value}</p>
          </div>
        ))}
      </section>

      {/* Results Table */}
      <section className="border-b border-mr-line">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No pending payments found</p>
              <p className="text-xs text-slate-400 mt-0.5">{currentMode?.desc}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="w-8" />
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{propertyTerms.singular}</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buyer</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Sale Price</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Received</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Remaining</TableHead>
                    {mode === 'installment_pending' && (
                      <>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Installment</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Inst. Due</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                      </>
                    )}
                    {(mode === 'overdue_till_date') && (
                      <>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Overdue Amt</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Max Days</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right"># Overdue</TableHead>
                      </>
                    )}
                    {(mode === 'month_pending' || mode === 'custom_range') && (
                      <>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Period Due</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Period Remaining</TableHead>
                      </>
                    )}
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Interest</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, idx) => {
                    const hasExpandable = (r.overdue_installments?.length > 0) || (r.matching_installments?.length > 0) || (r.installments_detail?.length > 0);
                    const isExpanded = expandedRows.has(r.plot_id);
                    const expandableData = r.overdue_installments || r.matching_installments || r.installments_detail || [];

                    return (
                      <>
                        <TableRow
                          key={r.plot_id}
                          className={`cursor-pointer transition-colors ${(r.overdue_count > 0 || r.days_overdue > 0) ? 'bg-red-50/30' : ''} ${isExpanded ? 'bg-slate-50' : ''}`}
                          onClick={() => hasExpandable && toggleExpand(r.plot_id)}
                        >
                          <TableCell className="w-8 text-center">
                            {hasExpandable && (
                              isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400 tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-800">
                            {r.plot_no}{r.block ? ` (${r.block})` : ''}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 font-medium">{r.buyer_name || '—'}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">₹{fmt(r.sale_price)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-emerald-700">₹{fmt(r.total_received)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-bold text-red-600">₹{fmt(r.total_remaining)}</TableCell>

                          {mode === 'installment_pending' && (
                            <>
                              <TableCell className="text-xs text-slate-600">{r.installment_name}</TableCell>
                              <TableCell className="text-xs text-right tabular-nums text-red-600 font-semibold">₹{fmt(r.installment_remaining)}</TableCell>
                              <TableCell className="text-xs tabular-nums">{fmtDate(r.installment_due_date)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[r.installment_status] || STATUS_COLORS.pending}`}>
                                  {r.installment_status === 'overdue' ? `Overdue ${r.days_overdue}d` : r.installment_status?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                            </>
                          )}

                          {mode === 'overdue_till_date' && (
                            <>
                              <TableCell className="text-xs text-right tabular-nums font-bold text-red-600">₹{fmt(r.total_overdue_amount)}</TableCell>
                              <TableCell className="text-xs text-right tabular-nums">
                                <Badge variant="outline" className="text-[10px] font-semibold bg-red-50 text-red-700 border-red-200">{r.max_overdue_days}d</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums text-red-600 font-semibold">{r.overdue_count}</TableCell>
                            </>
                          )}

                          {(mode === 'month_pending' || mode === 'custom_range') && (
                            <>
                              <TableCell className="text-xs text-right tabular-nums">₹{fmt(r.month_total_due || r.range_total_due)}</TableCell>
                              <TableCell className="text-xs text-right tabular-nums font-bold text-red-600">₹{fmt(r.month_total_remaining || r.range_total_remaining)}</TableCell>
                            </>
                          )}

                          <TableCell className="text-xs text-right tabular-nums text-amber-700">₹{fmt(r.interest_due)}</TableCell>
                          <TableCell className="text-xs tabular-nums text-slate-500">{fmtDate(r.last_payment_date)}</TableCell>
                        </TableRow>

                        {/* Expanded installment details */}
                        {isExpanded && expandableData.length > 0 && (
                          <TableRow key={`${r.plot_id}-detail`} className="bg-slate-50/60 hover:bg-slate-50/60">
                            <TableCell colSpan={20} className="p-0">
                              <div className="px-8 py-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Installment Details</p>
                                <div className="overflow-x-auto border border-slate-200 rounded bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-slate-50/50">
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Name</TableHead>
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400 text-right">Amount</TableHead>
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400 text-right">Paid</TableHead>
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400 text-right">Remaining</TableHead>
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Due Date</TableHead>
                                        <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Status</TableHead>
                                        {expandableData[0]?.days_overdue !== undefined && (
                                          <TableHead className="text-[10px] font-semibold uppercase text-slate-400 text-right">Days Overdue</TableHead>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {expandableData.map((inst, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="text-xs text-slate-700">{inst.name}</TableCell>
                                          <TableCell className="text-xs text-right tabular-nums">₹{fmt(inst.amount)}</TableCell>
                                          <TableCell className="text-xs text-right tabular-nums text-emerald-700">₹{fmt(inst.paid)}</TableCell>
                                          <TableCell className="text-xs text-right tabular-nums font-semibold text-red-600">₹{fmt(inst.remaining)}</TableCell>
                                          <TableCell className="text-xs tabular-nums">{fmtDate(inst.due_date)}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[inst.status] || STATUS_COLORS.pending}`}>
                                              {(inst.status || 'pending').replace('_', ' ')}
                                            </Badge>
                                          </TableCell>
                                          {inst.days_overdue !== undefined && (
                                            <TableCell className="text-xs text-right tabular-nums text-red-600">{inst.days_overdue}d</TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}

                  {/* Totals Row */}
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                    <TableCell colSpan={4} className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-4">
                      Total ({filtered.length} {filtered.length === 1 ? 'person' : 'persons'})
                    </TableCell>
                    <TableCell className="text-right px-4">
                      <span className="text-xs font-bold text-slate-800 tabular-nums">₹{fmt(filtered.reduce((s, r) => s + (r.sale_price || 0), 0))}</span>
                    </TableCell>
                    <TableCell className="text-right px-4">
                      <span className="text-xs font-bold text-emerald-700 tabular-nums">₹{fmt(filtered.reduce((s, r) => s + (r.total_received || 0), 0))}</span>
                    </TableCell>
                    <TableCell className="text-right px-4">
                      <span className="text-sm font-bold text-red-600 tabular-nums">₹{fmt(filtered.reduce((s, r) => s + (r.total_remaining || 0), 0))}</span>
                    </TableCell>
                    <TableCell colSpan={20} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
      </section>
    </div>
  );
}
