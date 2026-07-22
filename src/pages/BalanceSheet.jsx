import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Download,
  Filter,
  IndianRupee,
  Landmark,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

const SOURCE_OPTIONS = [
  ['all', 'All modules'],
  ['plot_payments', 'Plot payments'],
  ['plot_installment_payments', 'Plot installments'],
  ['farmer_payments', 'Farmer payments'],
  ['expenses', 'Expenses'],
  ['plot_commissions', 'Plot commissions'],
  ['plot_commission_payments', 'Commission payments'],
  ['vendor_payments', 'Vendor payments'],
  ['firm_transactions', 'Firm transactions'],
  ['personal_ledger', 'Personal ledgers'],
  ['day_book', 'Manual Day Book'],
];

const SOURCE_LABELS = Object.fromEntries(SOURCE_OPTIONS);
const SOURCE_TONES = {
  plot_payments: 'bg-sky-50 text-sky-700 border-sky-200',
  plot_installment_payments: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  farmer_payments: 'bg-lime-50 text-lime-700 border-lime-200',
  expenses: 'bg-rose-50 text-rose-700 border-rose-200',
  plot_commissions: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  plot_commission_payments: 'bg-purple-50 text-purple-700 border-purple-200',
  vendor_payments: 'bg-amber-50 text-amber-700 border-amber-200',
  firm_transactions: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  personal_ledger: 'bg-teal-50 text-teal-700 border-teal-200',
  day_book: 'bg-slate-50 text-slate-700 border-slate-200',
};

const PRESETS = [
  ['date', 'Date'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['overall', 'Overall'],
  ['custom', 'Custom'],
];

const pad = (value) => String(value).padStart(2, '0');
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = toISO(new Date());

const rangeForPreset = (preset, singleDate = TODAY) => {
  if (preset === 'overall') return { from: '', to: '' };
  if (preset === 'date') return { from: singleDate, to: singleDate };
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  if (preset === 'week') {
    const day = from.getDay() || 7;
    from.setDate(from.getDate() - day + 1);
  } else if (preset === 'month') {
    from.setDate(1);
  } else if (preset === 'year') {
    from.setMonth(0, 1);
  }
  return { from: toISO(from), to: toISO(to) };
};

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const compactMoney = (value) => new Intl.NumberFormat('en-IN', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(Number(value) || 0);

const signedMoney = (value) => {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? '+' : '−'}${money(Math.abs(amount))}`;
};

const displayDate = (value) => {
  if (!value) return 'Overall';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const scopeFromPath = (pathname) => {
  if (pathname.startsWith('/balance-sheet/cash')) return 'cash';
  if (pathname.startsWith('/balance-sheet/bank')) return 'bank';
  return 'all';
};

const titleForScope = (scope) => scope === 'cash'
  ? 'Cash Balance Sheet'
  : scope === 'bank' ? 'Bank Balance Sheet' : 'Main Balance Sheet';

const subtitleForScope = (scope) => scope === 'cash'
  ? 'Approved cash movement across every connected module'
  : scope === 'bank'
    ? 'All non-cash movement: bank, cheque, UPI, NEFT, RTGS and transfers'
    : 'Consolidated cash and bank position across the Accounts software';

const KpiCard = ({ label, value, hint, icon, tone = 'slate' }) => {
  const KpiIcon = icon;
  const tones = {
    slate: 'from-slate-700 to-slate-900 shadow-slate-200',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-200',
    rose: 'from-rose-500 to-red-600 shadow-rose-200',
    blue: 'from-blue-500 to-indigo-600 shadow-blue-200',
  };
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
            <p className="mt-2 truncate text-xl font-bold tracking-tight text-slate-900 tabular-nums">{money(value)}</p>
            <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]} text-white shadow-lg`}>
            <KpiIcon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const BalanceSheet = () => {
  const location = useLocation();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const scope = useMemo(() => scopeFromPath(location.pathname), [location.pathname]);

  const [preset, setPreset] = useState('overall');
  const [singleDate, setSingleDate] = useState(TODAY);
  const initialRange = rangeForPreset('overall');
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [source, setSource] = useState('all');
  const [paymentMode, setPaymentMode] = useState('all');
  const [direction, setDirection] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const effectiveRange = useMemo(() => {
    if (preset === 'custom') return { from: dateFrom, to: dateTo };
    return rangeForPreset(preset, singleDate);
  }, [preset, singleDate, dateFrom, dateTo]);

  const loadReport = useCallback(async ({ fresh = false } = {}) => {
    if (!siteId) return;
    if (effectiveRange.from && effectiveRange.to && effectiveRange.from > effectiveRange.to) {
      toast.error('From date cannot be after To date');
      return;
    }
    fresh ? setRefreshing(true) : setLoading(true);
    try {
      const params = new URLSearchParams({
        site_id: String(siteId),
        scope,
        source,
        payment_mode: paymentMode,
        direction,
        q: debouncedSearch,
        limit: '100000',
      });
      if (effectiveRange.from) params.set('date_from', effectiveRange.from);
      if (effectiveRange.to) params.set('date_to', effectiveRange.to);
      if (fresh) params.set('nocache', 'true');
      const { data } = await api.get(`/balance-sheet?${params.toString()}`);
      setReport(data);
    } catch (error) {
      console.error('Balance sheet fetch failed:', error);
      toast.error(error.response?.data?.message || 'Could not load Balance Sheet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, scope, source, paymentMode, direction, debouncedSearch, effectiveRange]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const summary = report?.summary || {};
  const transactions = useMemo(
    () => (report?.transactions || []).map((item) => ({
      ...item,
      running_balance: Number(item.running_balance) || 0,
    })),
    [report?.transactions],
  );

  const exportedRowsSummary = useMemo(() => {
    const totals = transactions.reduce(
      (result, item) => ({
        debit: result.debit + (Number(item.debit) || 0),
        credit: result.credit + (Number(item.credit) || 0),
      }),
      { debit: 0, credit: 0 },
    );
    return { count: transactions.length, ...totals, net: totals.credit - totals.debit };
  }, [transactions]);

  const filteredRowsSummary = useMemo(() => {
    const breakdown = Array.isArray(report?.by_source) ? report.by_source : [];
    const totals = breakdown.reduce((result, item) => ({
      debit: result.debit + (Number(item.total_debit) || 0),
      credit: result.credit + (Number(item.total_credit) || 0),
    }), { debit: 0, credit: 0 });
    const parsedCount = Number(report?.quality?.filtered_entries);
    const count = Number.isFinite(parsedCount) ? parsedCount : transactions.length;
    const useExportedFallback = breakdown.length === 0 && transactions.length > 0;
    const debit = useExportedFallback ? exportedRowsSummary.debit : totals.debit;
    const credit = useExportedFallback ? exportedRowsSummary.credit : totals.credit;
    return { count, debit, credit, net: credit - debit };
  }, [report?.by_source, report?.quality?.filtered_entries, transactions.length, exportedRowsSummary]);

  const loadedFilters = report?.filters || {};
  const presentationFilterLabel = useMemo(() => {
    const labels = [];
    const loadedSource = loadedFilters.source ?? source;
    const loadedMode = loadedFilters.payment_mode ?? paymentMode;
    const loadedDirection = loadedFilters.direction ?? direction;
    const loadedSearch = loadedFilters.q ?? debouncedSearch;
    if (loadedSource !== 'all') labels.push(`Module: ${SOURCE_LABELS[loadedSource] || loadedSource}`);
    if (loadedMode !== 'all') labels.push(`Mode: ${loadedMode === 'bank' ? 'Bank / Online' : loadedMode}`);
    if (loadedDirection !== 'all') labels.push(`Direction: ${loadedDirection === 'credit' ? 'Money in' : 'Money out'}`);
    if (loadedSearch) labels.push(`Search: “${loadedSearch}”`);
    return labels.length ? labels.join(' · ') : 'None — all rows in the selected book period';
  }, [loadedFilters.source, loadedFilters.payment_mode, loadedFilters.direction, loadedFilters.q, source, paymentMode, direction, debouncedSearch]);

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageTransactions = useMemo(
    () => transactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [transactions, safePage],
  );

  useEffect(() => { setPage(1); }, [report, preset, source, paymentMode, direction, debouncedSearch, scope]);

  const periodLabel = effectiveRange.from && effectiveRange.to
    ? effectiveRange.from === effectiveRange.to
      ? displayDate(effectiveRange.from)
      : `${displayDate(effectiveRange.from)} – ${displayDate(effectiveRange.to)}`
    : 'Overall activity';

  const hasActiveFilters = source !== 'all' || paymentMode !== 'all' || direction !== 'all'
    || debouncedSearch !== '' || preset !== 'overall';

  const resetFilters = () => {
    const range = rangeForPreset('overall');
    setPreset('overall');
    setDateFrom(range.from);
    setDateTo(range.to);
    setSingleDate(TODAY);
    setSource('all');
    setPaymentMode('all');
    setDirection('all');
    setSearch('');
  };

  const exportExcel = () => {
    if (!report) return;
    const headers = ['#', 'Date', 'Entity / Details', 'Module', 'Payment mode', 'Money out (₹)', 'Money in (₹)', 'Book running balance (₹)', 'Remarks'];
    const data = transactions.map((item, index) => [
      index + 1,
      displayDate(item.entry_date),
      item.entity_name || item.particular || '',
      SOURCE_LABELS[item.source_key] || item.source_key || '',
      item.payment_mode || item.bucket || '',
      Number(item.debit) || 0,
      Number(item.credit) || 0,
      Number(item.running_balance) || 0,
      item.remarks || item.linked_detail || '',
    ]);
    const isTruncated = Boolean(report.quality?.is_truncated);
    const exportedRowsLabel = isTruncated
      ? `Exported rows total · first ${exportedRowsSummary.count.toLocaleString('en-IN')} of ${filteredRowsSummary.count.toLocaleString('en-IN')} matched rows`
      : `Filtered/exported rows total · ${exportedRowsSummary.count.toLocaleString('en-IN')} rows`;
    const sheetRows = [
      [report.site?.name || currentSite?.name || 'DG Account'],
      [titleForScope(scope)],
      [`Book period: ${periodLabel}`],
      [`Presentation row filters: ${presentationFilterLabel}`],
      [`Generated: ${new Date().toLocaleString('en-IN')} · ${exportedRowsSummary.count.toLocaleString('en-IN')} exported rows`],
      ['Accounting note: Book figures use every approved movement in the selected book and period. Module, mode, direction and search filters affect only the row selection; they do not recalculate book opening or closing.'],
      [],
      ['BOOK ACCOUNTING SUMMARY · WHOLE SELECTED BOOK'],
      [`${titleForScope(scope)} · ${periodLabel}`, `${Number(summary.total_entries) || 0} approved book entries`, '', '', 'Book opening', 'Book money out', 'Book money in', 'Book net movement', 'Book closing'],
      ['', '', '', '', Number(summary.opening_balance) || 0, Number(summary.total_debit) || 0, Number(summary.total_credit) || 0, Number(summary.net_movement) || 0, Number(summary.closing_balance) || 0],
      [],
      ['FILTERED SELECTION SUMMARY · PRESENTATION ROWS ONLY'],
      [`Presentation row filters: ${presentationFilterLabel}`, '', '', '', 'Matched rows', 'Filtered money out', 'Filtered money in', 'Filtered net movement', 'Closing balance'],
      ['Row subtotal only · does not form a separate closing balance', '', '', '', filteredRowsSummary.count, filteredRowsSummary.debit, filteredRowsSummary.credit, filteredRowsSummary.net, 'Not applicable'],
      [],
      headers,
      ...data,
      [],
      [exportedRowsLabel, '', '', '', `Net ${signedMoney(exportedRowsSummary.net)}`, exportedRowsSummary.debit, exportedRowsSummary.credit, '', 'Row movement only · no closing balance'],
      ...(isTruncated ? [[`Export note: ${filteredRowsSummary.count.toLocaleString('en-IN')} rows matched the filters, but this file contains ${exportedRowsSummary.count.toLocaleString('en-IN')} returned rows. Narrow the period or filters for a complete row-level export.`]] : []),
    ];
    const headerRowIndex = 15;
    const firstDataRowIndex = headerRowIndex + 1;
    const lastDataRowIndex = headerRowIndex + data.length;
    const exportedTotalsRowIndex = headerRowIndex + data.length + 2;
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:I1'), XLSX.utils.decode_range('A2:I2'),
      XLSX.utils.decode_range('A3:I3'), XLSX.utils.decode_range('A4:I4'),
      XLSX.utils.decode_range('A5:I5'), XLSX.utils.decode_range('A6:I6'),
      XLSX.utils.decode_range('A8:I8'), XLSX.utils.decode_range('A12:I12'),
      XLSX.utils.decode_range('A13:D13'), XLSX.utils.decode_range('A14:D14'),
      XLSX.utils.decode_range(`A${exportedTotalsRowIndex + 1}:D${exportedTotalsRowIndex + 1}`),
      ...(isTruncated ? [XLSX.utils.decode_range(`A${exportedTotalsRowIndex + 2}:I${exportedTotalsRowIndex + 2}`)] : []),
    ];
    ws['!cols'] = [{ wch: 7 }, { wch: 15 }, { wch: 38 }, { wch: 22 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 23 }, { wch: 42 }];
    ws['!rows'] = sheetRows.map((_, index) => ({ hpt: index === 0 ? 26 : index === 1 ? 21 : index === headerRowIndex ? 22 : 18 }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIndex, c: 0 }, e: { r: lastDataRowIndex, c: headers.length - 1 } }) };
    const setCurrency = (rowIndex, colIndex) => {
      const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      if (cell && typeof cell.v === 'number') cell.z = '[$₹-en-IN] #,##0';
    };
    for (let colIndex = 4; colIndex <= 8; colIndex += 1) setCurrency(9, colIndex);
    for (let colIndex = 5; colIndex <= 7; colIndex += 1) setCurrency(13, colIndex);
    for (let rowIndex = firstDataRowIndex; rowIndex <= lastDataRowIndex; rowIndex += 1) {
      for (let colIndex = 5; colIndex <= 7; colIndex += 1) setCurrency(rowIndex, colIndex);
    }
    setCurrency(exportedTotalsRowIndex, 5);
    setCurrency(exportedTotalsRowIndex, 6);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    const safeSite = (report.site?.name || currentSite?.name || 'Site').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `BalanceSheet_${safeSite}_${preset}.xlsx`);
  };

  const printStatement = () => {
    if (!report) return;
    const rows = transactions.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(displayDate(item.entry_date))}</td>
        <td><strong>${escapeHtml(item.entity_name || item.particular)}</strong><small>${escapeHtml(item.linked_detail || item.particular || '')}</small></td>
        <td>${escapeHtml(SOURCE_LABELS[item.source_key] || item.source_key)}</td>
        <td>${escapeHtml(item.payment_mode || item.bucket)}</td>
        <td class="num debit">${Number(item.debit) > 0 ? escapeHtml(money(item.debit)) : '—'}</td>
        <td class="num credit">${Number(item.credit) > 0 ? escapeHtml(money(item.credit)) : '—'}</td>
        <td class="num">${escapeHtml(money(item.running_balance))}</td>
      </tr>`).join('');
    const generatedAt = new Date().toLocaleString('en-IN');
    const isTruncated = Boolean(report.quality?.is_truncated);
    const exportedRowsLabel = isTruncated
      ? `Printed rows (first ${exportedRowsSummary.count.toLocaleString('en-IN')} of ${filteredRowsSummary.count.toLocaleString('en-IN')} matches)`
      : `Filtered rows (${exportedRowsSummary.count.toLocaleString('en-IN')} matched and printed)`;
    const popup = window.open('', '_blank', 'width=1180,height=820');
    if (!popup) return toast.error('Allow pop-ups to open the HTML statement viewer');
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(titleForScope(scope))}</title><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eef2ff;color:#0f172a;font:12px Inter,Arial,sans-serif}.viewer{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:#0f172a;color:#fff}.viewer button{border:0;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer}.viewer .print{background:#2563eb;color:#fff}.viewer .close{margin-left:8px;background:#fff;color:#334155}.page{width:min(1280px,calc(100% - 32px));margin:18px auto;background:#fff;padding:24px;border:1px solid #dbeafe;border-radius:16px;box-shadow:0 20px 50px #1e3a8a18}.head{display:flex;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:2px solid #1d4ed8}.brand{font-size:22px;font-weight:800;color:#1e3a8a}.sub{margin-top:5px;color:#64748b}.meta{text-align:right}.meta strong{display:block;font-size:16px}.section-title{margin-top:16px;font-size:10px;font-weight:800;letter-spacing:1.1px;color:#1e3a8a;text-transform:uppercase}.section-note{margin-top:4px;color:#64748b;font-size:10px}.filter-note{padding:7px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 16px}.cards.filtered .card{background:#f8fafc}.card{padding:12px;border-radius:10px;background:#eff6ff;border:1px solid #dbeafe}.card span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#64748b}.card strong{display:block;margin-top:5px;font-size:15px}.card.in strong{color:#047857}.card.out strong{color:#be123c}.card.net strong{color:#1d4ed8}table{width:100%;border-collapse:collapse}th{padding:9px 7px;background:#eff6ff;color:#1e3a8a;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px}td{padding:8px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}td small{display:block;margin-top:2px;color:#64748b}tfoot td{background:#f8fafc;border-top:2px solid #cbd5e1;border-bottom:0;font-weight:700}.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.debit{color:#be123c}.credit{color:#047857}.foot{display:flex;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid #cbd5e1;color:#64748b;font-size:10px}.warning{margin:10px 0;padding:8px 10px;border:1px solid #fbbf24;background:#fffbeb;color:#92400e;border-radius:8px}@media print{body{background:#fff}.viewer{display:none}.page{width:100%;margin:0;padding:0;border:0;border-radius:0;box-shadow:none}.cards{break-inside:avoid}thead{display:table-header-group}tr{break-inside:avoid}.foot{position:relative}}
    </style></head><body><div class="viewer"><div><strong>HTML Statement Viewer</strong><span style="margin-left:10px;color:#94a3b8">Review before printing</span></div><div><button class="print" onclick="window.print()">Print / Save PDF</button><button class="close" onclick="window.close()">Close</button></div></div><main class="page"><section class="head"><div><div class="brand">${escapeHtml(report.site?.name || currentSite?.name || 'DG Account')}</div><div class="sub">${escapeHtml(report.site?.address || currentSite?.address || '')}</div><div class="sub">Consolidated Accounts Statement · Imprest excluded</div></div><div class="meta"><strong>${escapeHtml(titleForScope(scope))}</strong><span>${escapeHtml(periodLabel)}</span></div></section><div class="section-title">Book accounting summary · whole selected book</div><div class="section-note">Opening, movement and closing use every approved entry in this book and period. Presentation filters do not alter these figures.</div><section class="cards"><div class="card"><span>Book opening</span><strong>${escapeHtml(money(summary.opening_balance))}</strong></div><div class="card in"><span>Book money in</span><strong>${escapeHtml(money(summary.total_credit))}</strong></div><div class="card out"><span>Book money out</span><strong>${escapeHtml(money(summary.total_debit))}</strong></div><div class="card"><span>Book closing</span><strong>${escapeHtml(money(summary.closing_balance))}</strong></div></section><div class="section-title">Filtered selection summary · rows only</div><div class="section-note filter-note">${escapeHtml(presentationFilterLabel)}. These row figures are a presentation subtotal and do not form a separate closing balance.</div><section class="cards filtered"><div class="card"><span>Matched rows</span><strong>${escapeHtml(filteredRowsSummary.count.toLocaleString('en-IN'))}</strong></div><div class="card in"><span>Filtered money in</span><strong>${escapeHtml(money(filteredRowsSummary.credit))}</strong></div><div class="card out"><span>Filtered money out</span><strong>${escapeHtml(money(filteredRowsSummary.debit))}</strong></div><div class="card net"><span>Filtered net movement</span><strong>${escapeHtml(signedMoney(filteredRowsSummary.net))}</strong></div></section>${isTruncated ? `<div class="warning">${escapeHtml(filteredRowsSummary.count.toLocaleString('en-IN'))} rows matched the filters; this document contains the first ${escapeHtml(exportedRowsSummary.count.toLocaleString('en-IN'))} returned rows. Narrow the period or filters for a complete row-level statement.</div>` : ''}<table><thead><tr><th>#</th><th>Date</th><th>Entity / details</th><th>Module</th><th>Mode</th><th style="text-align:right">Money out</th><th style="text-align:right">Money in</th><th style="text-align:right">Book balance</th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:40px">No transactions in this period</td></tr>'}</tbody><tfoot><tr><td colspan="5">${escapeHtml(exportedRowsLabel)} · net ${escapeHtml(signedMoney(exportedRowsSummary.net))} · no closing balance</td><td class="num debit">${escapeHtml(money(exportedRowsSummary.debit))}</td><td class="num credit">${escapeHtml(money(exportedRowsSummary.credit))}</td><td class="num">—</td></tr></tfoot></table><section class="foot"><span>Book: ${escapeHtml(String(summary.total_entries || 0))} approved · Filtered: ${escapeHtml(filteredRowsSummary.count.toLocaleString('en-IN'))} matched · Printed: ${escapeHtml(exportedRowsSummary.count.toLocaleString('en-IN'))} · Generated ${escapeHtml(generatedAt)}</span><span>System generated statement</span></section></main></body></html>`);
    popup.document.close();
  };

  if (!siteId) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center"><Building2 className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Select a site to view its Balance Sheet</p></div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-3 sm:p-5">
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-5 text-white shadow-xl shadow-blue-950/10 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              {scope === 'cash' ? <Wallet className="h-5 w-5" /> : scope === 'bank' ? <Landmark className="h-5 w-5" /> : <CircleDollarSign className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{titleForScope(scope)}</h1>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10"><ShieldCheck className="mr-1 h-3 w-3" /> Approved only</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-xs text-blue-100/80 sm:text-sm">{subtitleForScope(scope)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-blue-100/75">
                <span className="rounded-full bg-white/8 px-2.5 py-1">{currentSite.name}</span>
                <ChevronRight className="h-3 w-3" />
                <span>{periodLabel}</span>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-200">Imprest excluded</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={refreshing} onClick={() => loadReport({ fresh: true })} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />} Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!report || loading} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
            </Button>
            <Button size="sm" onClick={printStatement} disabled={!report || loading} className="bg-blue-500 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400">
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-xl bg-slate-100 p-1">
              {PRESETS.map(([value, label]) => (
                <button key={value} onClick={() => setPreset(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${preset === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
              ))}
            </div>
            {preset === 'date' && <Input type="date" value={singleDate} onChange={(event) => setSingleDate(event.target.value)} className="h-9 w-40 text-xs" />}
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <div><Label className="sr-only">From date</Label><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-40 text-xs" /></div>
                <span className="text-xs text-slate-400">to</span>
                <div><Label className="sr-only">To date</Label><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-40 text-xs" /></div>
              </div>
            )}
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search entity, plot, party, ledger or remarks…" className="h-9 bg-slate-50 pl-9 pr-9 text-xs" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4 lg:max-w-4xl">
            <Select value={source} onValueChange={setSource}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{SOURCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}</SelectContent></Select>
            <Select value={paymentMode} onValueChange={setPaymentMode}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All payment modes</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank / Online</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select>
            <Select value={direction} onValueChange={setDirection}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Money in + out</SelectItem><SelectItem value="credit">Money in only</SelectItem><SelectItem value="debit">Money out only</SelectItem></SelectContent></Select>
            <Button variant="ghost" onClick={resetFilters} className="h-9 justify-start text-xs text-slate-500"><Filter className="mr-1.5 h-3.5 w-3.5" /> Reset filters</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Opening balance" value={summary.opening_balance} hint={effectiveRange.from ? `Before ${displayDate(effectiveRange.from)}` : 'Beginning of recorded activity'} icon={CalendarDays} />
          <KpiCard label="Money in" value={summary.total_credit} hint={`${summary.total_entries || 0} approved movements`} icon={ArrowDownLeft} tone="emerald" />
          <KpiCard label="Money out" value={summary.total_debit} hint="Imprest is not included" icon={ArrowUpRight} tone="rose" />
          <KpiCard label="Closing balance" value={summary.closing_balance} hint={(Number(summary.net_movement) || 0) >= 0 ? 'Net surplus for selection' : 'Net outflow for selection'} icon={IndianRupee} tone="blue" />
        </div>
      )}

      {(report?.quality?.invalid_date_entries > 0 || report?.quality?.excluded_unapproved > 0 || report?.quality?.is_truncated) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {report.quality.invalid_date_entries > 0 && <span><b>{report.quality.invalid_date_entries}</b> legacy rows with impossible dates safely excluded</span>}
          {report.quality.excluded_unapproved > 0 && <span><b>{report.quality.excluded_unapproved}</b> pending/rejected rows excluded</span>}
          {report.quality.is_truncated && <span>Table limited to 12,000 rows—narrow the period for a complete statement</span>}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.65fr)]">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div><CardTitle className="text-sm font-semibold text-slate-800">Money movement</CardTitle><p className="mt-1 text-[11px] text-slate-400">Inflow and outflow through the selected period</p></div>
            <Badge variant="outline" className="text-[10px] text-slate-500"><Sparkles className="mr-1 h-3 w-3" /> {report?.period?.grain === 'day' ? 'Daily' : 'Monthly'}</Badge>
          </CardHeader>
          <CardContent className="h-64 pt-3">
            {(report?.timeline || []).length ? (
              <ResponsiveContainer width="100%" height="100%"><AreaChart data={report.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="creditFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient><linearGradient id="debitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.18} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => displayDate(String(value).slice(0, 10))} axisLine={false} tickLine={false} minTickGap={28} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={compactMoney} axisLine={false} tickLine={false} width={48} /><ChartTooltip formatter={(value, name) => [money(value), name === 'total_credit' ? 'Money in' : 'Money out']} labelFormatter={(value) => displayDate(String(value).slice(0, 10))} /><Area type="monotone" dataKey="total_credit" stroke="#059669" strokeWidth={2} fill="url(#creditFill)" /><Area type="monotone" dataKey="total_debit" stroke="#e11d48" strokeWidth={2} fill="url(#debitFill)" /></AreaChart></ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-xs text-slate-400">No movement in this period</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-800">Connected modules</CardTitle><p className="mt-1 text-[11px] text-slate-400">Every source contributing to this statement</p></CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-y-auto pt-2">
            {(report?.by_source || []).map((item) => (
              <div key={item.source_key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{SOURCE_LABELS[item.source_key] || item.source_key}</p><p className="text-[10px] text-slate-400">{item.entries} entries</p></div>
                <div className="text-right"><p className={`text-xs font-bold tabular-nums ${Number(item.net) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Number(item.net) >= 0 ? '+' : '−'}{money(Math.abs(Number(item.net) || 0))}</p><p className="text-[9px] text-slate-400">Net</p></div>
              </div>
            ))}
            {!report?.by_source?.length && <p className="py-10 text-center text-xs text-slate-400">No module activity</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Statement entries</p>
              {hasActiveFilters && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                  <Filter className="h-2.5 w-2.5" /> Filtered
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">{transactions.length} of {report?.quality?.filtered_entries ?? summary.total_entries ?? 0} matched entries · newest first · 50 per page</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Book total out</p>
              <p className="text-sm font-bold tabular-nums text-rose-600">{money(summary.total_debit)}</p>
            </div>
            <span className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Book total in</p>
              <p className="text-sm font-bold tabular-nums text-emerald-600">{money(summary.total_credit)}</p>
            </div>
            <span className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Net</p>
              <p className={`text-sm font-bold tabular-nums ${(Number(summary.net_movement) || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(Number(summary.net_movement) || 0) >= 0 ? '+' : '−'}{money(Math.abs(Number(summary.net_movement) || 0))}
              </p>
            </div>
          </div>
        </div>
        {loading ? <div className="flex h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : transactions.length === 0 ? <div className="flex h-72 flex-col items-center justify-center text-center"><FileText className="h-9 w-9 text-slate-200" /><p className="mt-3 text-sm font-semibold text-slate-600">No financial movement found</p><p className="mt-1 text-xs text-slate-400">Try another period or clear the filters</p></div> : (
          <div className="relative max-h-[calc(100dvh-240px)] overflow-auto overscroll-contain bg-white">
            <table className="w-full min-w-[1050px] border-collapse text-sm">
              <TableHeader className="sticky top-0 z-40 bg-white shadow-[0_1px_0_0_#e2e8f0] [&_th]:bg-white"><TableRow className="bg-white hover:bg-white"><TableHead className="h-9 w-24 text-[10px] font-bold uppercase text-slate-500">Date</TableHead><TableHead className="h-9 min-w-72 text-[10px] font-bold uppercase text-slate-500">Entity & linked details</TableHead><TableHead className="h-9 w-40 text-[10px] font-bold uppercase text-slate-500">Module</TableHead><TableHead className="h-9 w-24 text-[10px] font-bold uppercase text-slate-500">Mode</TableHead><TableHead className="h-9 w-32 text-right text-[10px] font-bold uppercase text-rose-500">Money out</TableHead><TableHead className="h-9 w-32 text-right text-[10px] font-bold uppercase text-emerald-600">Money in</TableHead><TableHead className="h-9 w-36 text-right text-[10px] font-bold uppercase text-slate-500">Balance</TableHead></TableRow></TableHeader>
              <TableBody>{pageTransactions.map((item) => <TableRow key={item.id} className="group border-slate-100 hover:bg-blue-50/30"><TableCell className="py-2.5 text-[11px] font-medium text-slate-500">{displayDate(item.entry_date)}</TableCell><TableCell className="py-2.5"><div className="flex items-start gap-2.5"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{item.bucket === 'cash' ? <Wallet className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{item.entity_name || item.particular}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.linked_detail || item.particular}</p>{item.remarks && item.remarks !== item.linked_detail && <p className="mt-0.5 truncate text-[10px] italic text-slate-400">{item.remarks}</p>}</div></div></TableCell><TableCell className="py-2.5"><Badge variant="outline" className={`whitespace-nowrap text-[9px] font-semibold ${SOURCE_TONES[item.source_key] || SOURCE_TONES.day_book}`}>{SOURCE_LABELS[item.source_key] || item.source_key}</Badge></TableCell><TableCell className="py-2.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${item.bucket === 'cash' ? 'bg-emerald-50 text-emerald-700' : item.payment_mode === 'cheque' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{item.payment_mode || item.bucket}</span></TableCell><TableCell className="py-2.5 text-right text-xs font-bold tabular-nums text-rose-600">{Number(item.debit) > 0 ? money(item.debit) : <span className="text-slate-200">—</span>}</TableCell><TableCell className="py-2.5 text-right text-xs font-bold tabular-nums text-emerald-600">{Number(item.credit) > 0 ? money(item.credit) : <span className="text-slate-200">—</span>}</TableCell><TableCell className={`py-2.5 text-right text-xs font-bold tabular-nums ${Number(item.running_balance) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{money(item.running_balance)}</TableCell></TableRow>)}</TableBody>
              <TableFooter className="sticky bottom-0 z-30 border-t-2 border-slate-300 bg-slate-100">
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableCell colSpan={4} className="py-3 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    Book total · {summary.total_entries || 0} approved entries{hasActiveFilters ? ' · filters affect rows only' : ''}
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs font-bold tabular-nums text-rose-600">{money(summary.total_debit)}</TableCell>
                  <TableCell className="py-3 text-right text-xs font-bold tabular-nums text-emerald-600">{money(summary.total_credit)}</TableCell>
                  <TableCell className={`py-3 text-right text-xs font-bold tabular-nums ${(Number(summary.closing_balance) || 0) >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{money(summary.closing_balance)}</TableCell>
                </TableRow>
              </TableFooter>
            </table>
          </div>
        )}
        {!loading && transactions.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500">Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, transactions.length)} of {transactions.length} entries</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="h-8 text-xs">Previous</Button>
              <span className="min-w-20 text-center text-[11px] font-semibold text-slate-600">Page {safePage} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} className="h-8 text-xs">Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BalanceSheet;
