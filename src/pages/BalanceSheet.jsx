import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { writePrintDocument } from '../lib/safePrint';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { EmptyState, SkeletonBlock, StatusPill } from '../components/dashboard/primitives';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Download,
  FileCheck2, FileSpreadsheet, FileText, Landmark, Loader2, Printer, RefreshCw,
  Search, ShieldCheck, X,
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
const MODE_OPTIONS = [['all', 'All modes'], ['cash', 'Cash'], ['bank', 'Bank / Online'], ['cheque', 'Cheque']];
const DIRECTION_OPTIONS = [['all', 'Money in + out'], ['credit', 'Money in'], ['debit', 'Money out']];
const VIEWS = [
  ['statement', 'Balance Sheet', <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />],
  ['notes', 'Notes & validation', <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />],
  ['ledger', 'Supporting ledger', <FileText className="h-3.5 w-3.5" aria-hidden="true" />],
];
const SCOPES = [
  ['all', 'Main', '/balance-sheet'],
  ['cash', 'Cash book', '/balance-sheet/cash'],
  ['bank', 'Bank book', '/balance-sheet/bank'],
];

const pad = (value) => String(value).padStart(2, '0');
const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = toISO(new Date());

const previousYearIso = (iso) => {
  const [year, month, day] = String(iso || TODAY).split('-').map(Number);
  const candidate = new Date(Date.UTC(year - 1, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) candidate.setUTCDate(0);
  return candidate.toISOString().slice(0, 10);
};

const displayDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shortDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

const indianNumber = (value) => Math.abs(Number(value) || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 0,
});

const statementAmount = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) < 0.005) return '—';
  return amount < 0 ? `(${indianNumber(amount)})` : indianNumber(amount);
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

const scopeLabel = (scope) => SCOPES.find(([key]) => key === scope)?.[1] || 'Main';

const normalizePosition = (position = {}) => {
  const cash = Number(position.cash) || 0;
  const bank = Number(position.bank) || 0;
  const total = Number.isFinite(Number(position.total)) ? Number(position.total) : cash + bank;
  const overdraft = Math.max(-cash, 0) + Math.max(-bank, 0);
  const cashAndBank = Math.max(cash, 0) + Math.max(bank, 0);
  const equity = total;
  return {
    cash,
    bank,
    total,
    overdraft,
    cashAndBank,
    equity,
    totalEquityAndLiabilities: equity + overdraft,
    totalAssets: cashAndBank,
  };
};

const buildScheduleRows = (current, previous) => {
  const row = (type, label, note = '', currentValue = 0, previousValue = 0, extra = {}) => ({
    type, label, note, current: currentValue, previous: previousValue, ...extra,
  });
  return [
    row('section', 'I. EQUITY AND LIABILITIES'),
    row('group', "(1) Shareholders' funds"),
    row('line', '(a) Share capital', '1'),
    row('line', '(b) Reserves and surplus / (deficit)', '2', current.equity, previous.equity),
    row('line', '(c) Money received against share warrants'),
    row('group', '(2) Share application money pending allotment'),
    row('group', '(3) Non-current liabilities'),
    row('line', '(a) Long-term borrowings'),
    row('line', '(b) Deferred tax liabilities (net)'),
    row('line', '(c) Other long-term liabilities'),
    row('line', '(d) Long-term provisions'),
    row('group', '(4) Current liabilities'),
    row('line', '(a) Short-term borrowings / negative book balance', '3', current.overdraft, previous.overdraft),
    row('line', '(b) Trade payables'),
    row('line', '(c) Other current liabilities'),
    row('line', '(d) Short-term provisions'),
    row('total', 'TOTAL EQUITY AND LIABILITIES', '', current.totalEquityAndLiabilities, previous.totalEquityAndLiabilities),
    row('spacer', ''),
    row('section', 'II. ASSETS'),
    row('group', '(1) Non-current assets'),
    row('line', '(a) Property, Plant and Equipment and Intangible Assets'),
    row('subline', '(i) Property, Plant and Equipment'),
    row('subline', '(ii) Capital work-in-progress'),
    row('subline', '(iii) Investment property'),
    row('subline', '(iv) Goodwill'),
    row('subline', '(v) Other intangible assets'),
    row('subline', '(vi) Intangible assets under development'),
    row('subline', '(vii) Biological assets other than bearer plants'),
    row('line', '(b) Non-current investments'),
    row('line', '(c) Deferred tax assets (net)'),
    row('line', '(d) Long-term loans and advances'),
    row('line', '(e) Other non-current assets'),
    row('group', '(2) Current assets'),
    row('line', '(a) Current investments'),
    row('line', '(b) Inventories'),
    row('line', '(c) Trade receivables'),
    row('line', '(d) Cash and cash equivalents', '4', current.cashAndBank, previous.cashAndBank),
    row('line', '(e) Short-term loans and advances'),
    row('line', '(f) Other current assets'),
    row('total', 'TOTAL ASSETS', '', current.totalAssets, previous.totalAssets),
  ];
};

const rowClassName = (type) => {
  if (type === 'section') return 'bg-slate-950 text-white';
  if (type === 'total') return 'border-y-2 border-slate-900 bg-slate-100 font-bold text-slate-950';
  if (type === 'group') return 'bg-slate-50 font-semibold text-slate-900';
  if (type === 'spacer') return 'h-3 border-0 bg-white';
  return 'text-slate-700 hover:bg-blue-50/40';
};

const labelClassName = (type) => {
  if (type === 'line') return 'pl-8';
  if (type === 'subline') return 'pl-14 text-slate-500';
  return '';
};

const applyCellStyle = (sheet, range, style) => {
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (!sheet[address]) sheet[address] = { t: 's', v: '' };
      sheet[address].s = { ...(sheet[address].s || {}), ...style };
    }
  }
};

const excelAmountFormat = '#,##0;[Red](#,##0);-';

function TabButton({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
    >
      {icon} {children}
    </button>
  );
}

function ScheduleTable({ rows, currentDate, previousDate }) {
  return (
    <div
      tabIndex={0}
      aria-label="Balance Sheet statement. Scroll to view all rows and comparative columns."
      className="min-h-[24rem] max-h-[calc(100dvh-17rem)] overflow-auto overscroll-contain scroll-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 [scrollbar-width:thin]"
    >
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Schedule III-format Balance Sheet</caption>
        <thead className="sticky top-0 z-20 bg-white">
          <tr className="border-y border-slate-300 bg-slate-100">
            <th className="w-[55%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">Particulars</th>
            <th className="w-20 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">Note No.</th>
            <th className="w-44 px-4 py-3 text-right text-[11px] font-bold text-slate-700">As at {displayDate(currentDate)}<span className="block text-[9px] font-medium text-slate-400">Amount in ₹</span></th>
            <th className="w-44 px-4 py-3 text-right text-[11px] font-bold text-slate-700">As at {displayDate(previousDate)}<span className="block text-[9px] font-medium text-slate-400">Amount in ₹</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.label}-${index}`} className={`border-b border-slate-200 ${rowClassName(item.type)}`}>
              <td className={`px-4 py-2.5 text-[12px] ${labelClassName(item.type)}`}>{item.label || '\u00a0'}</td>
              <td className="px-3 py-2.5 text-center text-[11px] text-slate-500">{item.note}</td>
              <td className="px-4 py-2.5 text-right text-[12px] tabular-nums">{['section', 'group', 'spacer'].includes(item.type) ? '' : statementAmount(item.current)}</td>
              <td className="px-4 py-2.5 text-right text-[12px] tabular-nums">{['section', 'group', 'spacer'].includes(item.type) ? '' : statementAmount(item.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTable({ rows, page, pageCount, totalRows, onPageChange }) {
  if (!rows.length) return <EmptyState icon={FileText} title="No supporting entries" description="No approved ledger rows matched these filters." />;
  return (
    <>
      <div
        tabIndex={0}
        aria-label="Supporting ledger. Scroll to view all transaction columns and entries."
        className="min-h-[24rem] max-h-[calc(100dvh-20rem)] overflow-auto overscroll-contain scroll-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 [scrollbar-width:thin]"
      >
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-slate-100">
            <tr>{['Date', 'Entity / details', 'Module', 'Mode', 'Money out', 'Money in', 'Running balance'].map((label, index) => <th key={label} className={`border-b border-slate-300 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-600 ${index > 3 ? 'text-right' : ''}`}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const debit = Number(item.debit) || 0;
              const credit = Number(item.credit) || 0;
              return (
                <tr key={item.id} className="border-b border-slate-200 hover:bg-blue-50/40">
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] tabular-nums text-slate-500">{shortDate(item.entry_date)}</td>
                  <td className="max-w-sm px-4 py-3"><p className="truncate text-[12px] font-semibold text-slate-800">{item.entity_name || item.particular}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{item.linked_detail || item.remarks || item.particular}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-600">{SOURCE_LABELS[item.source_key] || item.source_key}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase text-slate-500">{item.payment_mode || item.bucket || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-rose-700">{debit > 0 ? `₹${indianNumber(debit)}` : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-emerald-700">{credit > 0 ? `₹${indianNumber(credit)}` : '—'}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right text-[12px] font-semibold tabular-nums ${Number(item.running_balance) < 0 ? 'text-rose-700' : 'text-slate-800'}`}>{statementAmount(item.running_balance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalRows > 50 && <nav className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500"><span>Page {page} of {pageCount} · {totalRows.toLocaleString('en-IN')} rows</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 font-semibold disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Previous</button><button type="button" disabled={page === pageCount} onClick={() => onPageChange(page + 1)} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 font-semibold disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button></div></nav>}
    </>
  );
}

const BalanceSheet = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSite, organization: authOrganization } = useAuth();
  const siteId = currentSite?.id;
  const scope = useMemo(() => scopeFromPath(location.pathname), [location.pathname]);
  const [view, setView] = useState('statement');
  const [asAtDate, setAsAtDate] = useState(TODAY);
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
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const comparativeDate = useMemo(() => previousYearIso(asAtDate), [asAtDate]);

  const loadReport = useCallback(async ({ fresh = false } = {}) => {
    if (!siteId || !asAtDate) return;
    fresh ? setRefreshing(true) : setLoading(true);
    try {
      const params = new URLSearchParams({
        site_id: String(siteId),
        scope,
        source,
        payment_mode: paymentMode,
        direction,
        q: debouncedSearch,
        date_to: asAtDate,
        comparative_to: comparativeDate,
        limit: '100000',
      });
      if (fresh) params.set('nocache', 'true');
      const { data } = await api.get(`/balance-sheet?${params.toString()}`);
      setReport(data);
    } catch (error) {
      console.error('Balance Sheet fetch failed:', error);
      toast.error(error.response?.data?.message || 'Could not load Balance Sheet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, scope, source, paymentMode, direction, debouncedSearch, asAtDate, comparativeDate]);

  useEffect(() => { loadReport(); }, [loadReport]);
  useEffect(() => { setPage(1); }, [report, scope, source, paymentMode, direction, debouncedSearch, asAtDate]);

  const organization = report?.organization || authOrganization || {};
  const entityName = organization.name || report?.site?.name || currentSite?.name || 'Entity';
  const siteName = report?.site?.name || currentSite?.name || '';
  const currentPosition = normalizePosition(report?.position?.current);
  const previousPosition = normalizePosition(report?.position?.previous);
  const scheduleRows = buildScheduleRows(currentPosition, previousPosition);
  const currentDifference = currentPosition.totalEquityAndLiabilities - currentPosition.totalAssets;
  const previousDifference = previousPosition.totalEquityAndLiabilities - previousPosition.totalAssets;
  const statementBalanced = Math.abs(currentDifference) < 0.01 && Math.abs(previousDifference) < 0.01;
  const transactions = useMemo(() => (report?.transactions || []).map((item) => ({
    ...item,
    running_balance: Number(item.running_balance) || 0,
  })), [report?.transactions]);
  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageTransactions = transactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasLedgerFilters = source !== 'all' || paymentMode !== 'all' || direction !== 'all' || debouncedSearch !== '';
  const showSkeleton = loading && !report;
  const busy = (loading || refreshing) && !!report;

  const resetLedgerFilters = () => {
    setSource('all');
    setPaymentMode('all');
    setDirection('all');
    setSearch('');
  };

  const notes = useMemo(() => [
    { no: '1', title: 'Share capital', text: 'Share capital and securities records are not maintained in the operational cash ledger. Enter and verify the statutory figure before finalisation.' },
    { no: '2', title: 'Reserves and surplus / (deficit)', text: `System balancing figure representing the net approved ${scopeLabel(scope).toLowerCase()} position. It is not a substitute for audited retained earnings, current-year profit, partner capital or share premium.` },
    { no: '3', title: 'Short-term borrowings / negative book balance', text: 'Negative cash or bank book balances are presented here as a review item. A CA must determine whether the amount is a bank overdraft, unsecured loan, inter-company balance, posting error or another liability.' },
    { no: '4', title: 'Cash and cash equivalents', text: `Positive approved cash and bank ledger balances as at ${displayDate(asAtDate)}. Bounced/returned cheques, unapproved entries, imprest mirrors and duplicate source mirrors are excluded by the accounting policy engine.` },
    { no: '5', title: 'Basis of preparation and limitation', text: 'Prepared in a Schedule III, Division I presentation for management review. The system does not yet recognise inventory valuation, revenue recognition, depreciation, taxes, provisions, trade receivables/payables or year-end adjustments; those require ledger classification and CA review.' },
  ], [scope, asAtDate]);

  const exportExcel = () => {
    if (!report) return;
    const statementStartRow = 6;
    const statementRows = [
      [entityName],
      [`BALANCE SHEET AS AT ${displayDate(asAtDate).toUpperCase()}`],
      ['Schedule III, Division I presentation · Management draft'],
      [`Project / site: ${siteName}${report.site?.code ? ` (${report.site.code})` : ''} · Book: ${scopeLabel(scope)} · Amount in Indian Rupees`],
      [],
      ['Particulars', 'Note No.', `As at ${displayDate(asAtDate)}`, `As at ${displayDate(comparativeDate)}`],
      ...scheduleRows.map((item) => [
        item.label,
        item.note,
        ['section', 'group', 'spacer'].includes(item.type) ? '' : Number(item.current) || 0,
        ['section', 'group', 'spacer'].includes(item.type) ? '' : Number(item.previous) || 0,
      ]),
      [],
      ['See accompanying Notes and Validation sheets. This management draft must be reviewed and adjusted by the appointed Chartered Accountant before statutory use.'],
    ];
    const statementSheet = XLSX.utils.aoa_to_sheet(statementRows);
    statementSheet['!merges'] = [
      XLSX.utils.decode_range('A1:D1'), XLSX.utils.decode_range('A2:D2'),
      XLSX.utils.decode_range('A3:D3'), XLSX.utils.decode_range('A4:D4'),
      XLSX.utils.decode_range(`A${statementRows.length}:D${statementRows.length}`),
    ];
    statementSheet['!cols'] = [{ wch: 58 }, { wch: 12 }, { wch: 22 }, { wch: 22 }];
    statementSheet['!rows'] = statementRows.map((_, index) => ({ hpt: index === 0 ? 25 : index === 1 ? 22 : index === 5 ? 34 : 19 }));
    statementSheet['!margins'] = { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    statementSheet['!pageSetup'] = { orientation: 'portrait', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
    statementSheet['!freeze'] = { xSplit: 0, ySplit: 6 };
    applyCellStyle(statementSheet, XLSX.utils.decode_range('A1:D1'), { font: { name: 'Aptos Display', sz: 16, bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } });
    applyCellStyle(statementSheet, XLSX.utils.decode_range('A2:D2'), { font: { name: 'Aptos', sz: 13, bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } });
    applyCellStyle(statementSheet, XLSX.utils.decode_range('A3:D4'), { font: { name: 'Aptos', sz: 9, color: { rgb: '64748B' } }, alignment: { horizontal: 'center' } });
    applyCellStyle(statementSheet, XLSX.utils.decode_range('A6:D6'), { fill: { fgColor: { rgb: 'E2E8F0' } }, font: { bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: '64748B' } }, bottom: { style: 'thin', color: { rgb: '64748B' } } } });
    scheduleRows.forEach((item, index) => {
      const excelRow = statementStartRow + index;
      const range = { s: { r: excelRow, c: 0 }, e: { r: excelRow, c: 3 } };
      const isSection = item.type === 'section';
      const isTotal = item.type === 'total';
      const isGroup = item.type === 'group';
      applyCellStyle(statementSheet, range, {
        fill: isSection ? { fgColor: { rgb: '0F172A' } } : (isTotal || isGroup) ? { fgColor: { rgb: isTotal ? 'E2E8F0' : 'F8FAFC' } } : undefined,
        font: { name: 'Aptos', sz: 10, bold: isSection || isTotal || isGroup, color: { rgb: isSection ? 'FFFFFF' : '0F172A' } },
        border: { bottom: { style: 'hair', color: { rgb: 'CBD5E1' } } },
        alignment: { vertical: 'center', indent: item.type === 'subline' ? 3 : item.type === 'line' ? 1 : 0 },
      });
      for (let col = 2; col <= 3; col += 1) {
        const cell = statementSheet[XLSX.utils.encode_cell({ r: excelRow, c: col })];
        if (cell && typeof cell.v === 'number') {
          cell.z = excelAmountFormat;
          cell.s = { ...(cell.s || {}), alignment: { horizontal: 'right' } };
        }
      }
    });

    const notesRows = [
      [entityName],
      ['NOTES FORMING PART OF THE BALANCE SHEET'],
      [`As at ${displayDate(asAtDate)} · Project / site: ${siteName}`],
      [],
      ['Note No.', 'Title', 'Disclosure / CA review point'],
      ...notes.map((note) => [note.no, note.title, note.text]),
      [],
      ['Current book detail', 'Cash balance', currentPosition.cash],
      ['', 'Bank / online balance', currentPosition.bank],
      ['', 'Net approved book position', currentPosition.total],
      ['Previous book detail', 'Cash balance', previousPosition.cash],
      ['', 'Bank / online balance', previousPosition.bank],
      ['', 'Net approved book position', previousPosition.total],
    ];
    const notesSheet = XLSX.utils.aoa_to_sheet(notesRows);
    notesSheet['!merges'] = [XLSX.utils.decode_range('A1:C1'), XLSX.utils.decode_range('A2:C2'), XLSX.utils.decode_range('A3:C3')];
    notesSheet['!cols'] = [{ wch: 13 }, { wch: 34 }, { wch: 95 }];
    notesSheet['!rows'] = notesRows.map((_, index) => ({ hpt: index >= 5 && index < 5 + notes.length ? 48 : 20 }));
    notesSheet['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
    applyCellStyle(notesSheet, XLSX.utils.decode_range('A5:C5'), { fill: { fgColor: { rgb: '0F172A' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { wrapText: true } });
    for (let row = 5; row < 5 + notes.length; row += 1) applyCellStyle(notesSheet, { s: { r: row, c: 0 }, e: { r: row, c: 2 } }, { alignment: { vertical: 'top', wrapText: true }, border: { bottom: { style: 'hair', color: { rgb: 'CBD5E1' } } } });
    for (let row = 5 + notes.length + 2; row < notesRows.length; row += 1) {
      const cell = notesSheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
      if (cell && typeof cell.v === 'number') cell.z = excelAmountFormat;
    }

    const ledgerHeaders = ['#', 'Date', 'Entity / Details', 'Module', 'Payment mode', 'Money out (₹)', 'Money in (₹)', 'Book running balance (₹)', 'Remarks'];
    const ledgerRows = transactions.map((item, index) => [
      index + 1, item.entry_date, item.entity_name || item.particular || '', SOURCE_LABELS[item.source_key] || item.source_key || '',
      item.payment_mode || item.bucket || '', Number(item.debit) || 0, Number(item.credit) || 0,
      Number(item.running_balance) || 0, item.remarks || item.linked_detail || '',
    ]);
    const supportingRows = [
      [entityName],
      ['SUPPORTING LEDGER · NOT THE FACE OF THE BALANCE SHEET'],
      [`Through ${displayDate(asAtDate)} · ${scopeLabel(scope)} · Generated ${new Date().toLocaleString('en-IN')}`],
      [],
      ['BOOK ACCOUNTING SUMMARY · WHOLE SELECTED BOOK'],
      ['Book accounting summary · whole selected book'],
      [`Opening / movement data is retained as a supporting schedule. Presentation filters do not alter the Schedule III-format face statement.`],
      ['FILTERED SELECTION SUMMARY · PRESENTATION ROWS ONLY'],
      ['Filtered selection summary · rows only'],
      [`Filters: ${source === 'all' ? 'All modules' : SOURCE_LABELS[source]} · ${paymentMode} · ${direction}${debouncedSearch ? ` · Search “${debouncedSearch}”` : ''}`],
      ['Filtered row subtotal does not form a separate closing balance'],
      ['Row movement only · no closing balance'],
      [],
      ledgerHeaders,
      ...ledgerRows,
    ];
    const ledgerSheet = XLSX.utils.aoa_to_sheet(supportingRows);
    ledgerSheet['!merges'] = [
      XLSX.utils.decode_range('A1:I1'), XLSX.utils.decode_range('A2:I2'), XLSX.utils.decode_range('A3:I3'),
      XLSX.utils.decode_range('A5:I5'), XLSX.utils.decode_range('A6:I6'), XLSX.utils.decode_range('A7:I7'),
      XLSX.utils.decode_range('A8:I8'), XLSX.utils.decode_range('A9:I9'), XLSX.utils.decode_range('A10:I10'),
      XLSX.utils.decode_range('A11:I11'), XLSX.utils.decode_range('A12:I12'),
    ];
    ledgerSheet['!cols'] = [{ wch: 7 }, { wch: 14 }, { wch: 38 }, { wch: 24 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 22 }, { wch: 42 }];
    ledgerSheet['!autofilter'] = { ref: `A14:I${Math.max(14, 14 + ledgerRows.length)}` };
    ledgerSheet['!freeze'] = { xSplit: 0, ySplit: 14 };
    ledgerSheet['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
    applyCellStyle(ledgerSheet, XLSX.utils.decode_range('A14:I14'), { fill: { fgColor: { rgb: '0F172A' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { wrapText: true } });
    for (let row = 14; row < 14 + ledgerRows.length; row += 1) for (let col = 5; col <= 7; col += 1) {
      const cell = ledgerSheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && typeof cell.v === 'number') cell.z = excelAmountFormat;
    }

    const validationRows = [
      [entityName],
      ['BALANCE SHEET VALIDATION & FINALISATION CONTROL'],
      [],
      ['Control', `As at ${displayDate(asAtDate)}`, `As at ${displayDate(comparativeDate)}`, 'Status / action'],
      ['Total equity and liabilities', currentPosition.totalEquityAndLiabilities, previousPosition.totalEquityAndLiabilities, 'Derived from approved operational books'],
      ['Total assets', currentPosition.totalAssets, previousPosition.totalAssets, 'Derived from positive cash / bank books'],
      ['Balance difference', currentDifference, previousDifference, statementBalanced ? 'BALANCED' : 'REVIEW REQUIRED'],
      ['Statutory classification status', '', '', 'CA REVIEW REQUIRED'],
      ['Missing year-end classifications', '', '', 'Capital, inventory, receivables, payables, taxes, depreciation and provisions'],
      ['Excluded unapproved rows', report.quality?.excluded_unapproved || 0, '', 'Not recognised'],
      ['Excluded bounced / returned cheques', report.quality?.excluded_bounced || 0, '', 'Not recognised'],
      ['Invalid legacy dates excluded', report.quality?.invalid_date_entries || 0, '', 'Data clean-up recommended'],
    ];
    const validationSheet = XLSX.utils.aoa_to_sheet(validationRows);
    validationSheet['!merges'] = [XLSX.utils.decode_range('A1:D1'), XLSX.utils.decode_range('A2:D2')];
    validationSheet['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 22 }, { wch: 68 }];
    validationSheet['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 1 };
    applyCellStyle(validationSheet, XLSX.utils.decode_range('A4:D4'), { fill: { fgColor: { rgb: '0F172A' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { wrapText: true } });
    for (let row = 4; row <= 6; row += 1) for (let col = 1; col <= 2; col += 1) {
      const cell = validationSheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && typeof cell.v === 'number') cell.z = excelAmountFormat;
    }

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: `Balance Sheet as at ${displayDate(asAtDate)}`,
      Subject: 'Schedule III Division I presentation — management draft',
      Author: entityName,
      Company: entityName,
      Comments: 'Requires Chartered Accountant review before statutory use.',
    };
    XLSX.utils.book_append_sheet(workbook, statementSheet, 'Balance Sheet');
    XLSX.utils.book_append_sheet(workbook, notesSheet, 'Notes');
    XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Supporting Ledger');
    XLSX.utils.book_append_sheet(workbook, validationSheet, 'Validation');
    const safeEntity = entityName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Entity';
    XLSX.writeFile(workbook, `Balance_Sheet_${safeEntity}_${asAtDate}.xlsx`, { compression: true });
  };

  const printStatement = () => {
    if (!report) return;
    const rowsHtml = scheduleRows.map((item) => {
      if (item.type === 'spacer') return '<tr class="spacer"><td colspan="4">&nbsp;</td></tr>';
      const emptyAmount = ['section', 'group'].includes(item.type);
      return `<tr class="${item.type}"><td>${escapeHtml(item.label)}</td><td class="note">${escapeHtml(item.note)}</td><td class="num">${emptyAmount ? '' : escapeHtml(statementAmount(item.current))}</td><td class="num">${emptyAmount ? '' : escapeHtml(statementAmount(item.previous))}</td></tr>`;
    }).join('');
    const notesHtml = notes.map((note) => `<section class="note-row"><b>${escapeHtml(note.no)}. ${escapeHtml(note.title)}</b><p>${escapeHtml(note.text)}</p></section>`).join('');
    const ledgerRowsHtml = transactions.length
      ? transactions.map((item, index) => {
        const debit = Number(item.debit) || 0;
        const credit = Number(item.credit) || 0;
        return `<tr><td>${index + 1}</td><td>${escapeHtml(displayDate(item.entry_date))}</td><td><b>${escapeHtml(item.entity_name || item.particular || '—')}</b><br><span>${escapeHtml(item.linked_detail || item.particular || '—')}</span></td><td>${escapeHtml(SOURCE_LABELS[item.source_key] || item.source_key || '—')}</td><td>${escapeHtml(item.payment_mode || item.bucket || '—')}</td><td class="num">${debit ? escapeHtml(indianNumber(debit)) : '—'}</td><td class="num">${credit ? escapeHtml(indianNumber(credit)) : '—'}</td><td class="num">${escapeHtml(statementAmount(item.running_balance))}</td><td>${escapeHtml(item.remarks || '—')}</td></tr>`;
      }).join('')
      : '<tr><td colspan="9" class="empty">No approved ledger entries matched this selection.</td></tr>';
    const ledgerFilterLabel = `${source === 'all' ? 'All modules' : SOURCE_LABELS[source] || source} · ${paymentMode === 'all' ? 'All payment modes' : paymentMode} · ${direction === 'all' ? 'Money in and out' : direction === 'credit' ? 'Money in' : 'Money out'}${debouncedSearch ? ` · Search: ${debouncedSearch}` : ''}`;
    const popup = window.open('', '_blank', 'width=1040,height=820');
    if (!popup) return toast.error('Allow pop-ups to open the Balance Sheet PDF preview');
    writePrintDocument(popup, `<!doctype html><html><head><title>Balance Sheet · ${escapeHtml(entityName)}</title><style>
      @page{size:A4 portrait;margin:13mm 12mm 15mm}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#111827;font:10.5px Arial,Helvetica,sans-serif}.viewer{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:11px 18px;background:#0f172a;color:#fff}.viewer span{margin-left:8px;color:#94a3b8}.viewer button{border:0;border-radius:6px;padding:8px 15px;font-weight:700;cursor:pointer}.viewer .print{background:#2563eb;color:#fff}.viewer .close{margin-left:7px;background:#fff;color:#334155}.page{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm 12mm;box-shadow:0 16px 40px #0f172a24}.entity{text-align:center}.entity h1{margin:0;font-size:17px;letter-spacing:.2px;text-transform:uppercase}.entity h2{margin:6px 0 0;font-size:13px}.entity p{margin:4px 0 0;color:#475569}.draft{margin:9px 0 12px;padding:6px 8px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;text-align:center;font-size:9px;font-weight:700;letter-spacing:.45px;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{border-top:1px solid #334155;border-bottom:1px solid #334155;background:#f1f5f9;padding:7px 6px;text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.35px}th.num{text-align:right;text-transform:none;letter-spacing:0}td{padding:4.7px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}.note{text-align:center;color:#475569}.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.section td{padding-top:6px;padding-bottom:6px;background:#0f172a;color:#fff;font-weight:700}.group td:first-child{font-weight:700;background:#f8fafc}.group td{background:#f8fafc}.line td:first-child{padding-left:18px}.subline td:first-child{padding-left:34px;color:#475569}.total td{border-top:1.5px solid #0f172a;border-bottom:1.5px solid #0f172a;background:#f1f5f9;font-weight:800}.spacer td{height:7px;padding:0;border:0}.basis{margin-top:10px;color:#475569;font-size:8.5px;line-height:1.45}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:30px}.sign{min-height:82px;border-top:1px solid #64748b;padding-top:7px}.sign b{display:block}.sign p{margin:3px 0;color:#475569}.page-break{break-before:page;padding-top:2mm}.notes-head{border-bottom:2px solid #0f172a;padding-bottom:8px}.notes-head h2{margin:0;font-size:14px}.notes-head p{margin:4px 0 0;color:#64748b}.note-row{padding:10px 0;border-bottom:1px solid #e2e8f0;break-inside:avoid}.note-row b{font-size:10.5px}.note-row p{margin:4px 0 0;color:#475569;line-height:1.5}.validation{margin-top:16px;border:1px solid #cbd5e1;background:#f8fafc;padding:10px}.validation b{display:block;margin-bottom:5px}.footer{display:flex;justify-content:space-between;margin-top:16px;padding-top:8px;border-top:1px solid #cbd5e1;color:#64748b;font-size:8px}@media print{body{background:#fff}.viewer{display:none}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.page-break{break-before:page}thead{display:table-header-group}tr{break-inside:avoid}}
    </style></head><body><div class="viewer"><div><strong>Balance Sheet preview</strong><span>A4 · Schedule III format</span></div><div><button class="print" onclick="window.print()">Print / Save PDF</button><button class="close" onclick="window.close()">Close</button></div></div><main class="page"><header class="entity"><h1>${escapeHtml(entityName)}</h1><h2>BALANCE SHEET AS AT ${escapeHtml(displayDate(asAtDate).toUpperCase())}</h2><p>${escapeHtml(organization.registered_address || report.site?.address || '')}</p><p>${organization.gst_number ? `GSTIN: ${escapeHtml(organization.gst_number)} · ` : ''}Project / site: ${escapeHtml(siteName)}${report.site?.code ? ` (${escapeHtml(report.site.code)})` : ''} · Book: ${escapeHtml(scopeLabel(scope))}</p><p>(Amount in Indian Rupees)</p></header><div class="draft">Schedule III, Division I presentation · Management draft · CA review required before statutory use</div><table><thead><tr><th>Particulars</th><th style="text-align:center">Note No.</th><th class="num">As at ${escapeHtml(displayDate(asAtDate))}</th><th class="num">As at ${escapeHtml(displayDate(comparativeDate))}</th></tr></thead><tbody>${rowsHtml}</tbody></table><p class="basis"><b>Basis:</b> The accompanying notes form an integral part of this statement. Figures are derived only from approved operational cash and bank books. Statutory classifications and year-end adjustments not maintained by the system remain subject to management and Chartered Accountant review.</p><section class="signatures"><div class="sign"><b>As per our report of even date</b><p>For ______________________________</p><p>Chartered Accountants</p><p>Firm Registration No.: ____________</p><p>Partner: __________ · Membership No.: __________</p><p>UDIN: ___________________________</p></div><div class="sign"><b>For and on behalf of the Board / Management</b><p>${escapeHtml(organization.director_name || 'Director / Authorised Signatory')}: __________________</p><p>Director / Partner: __________________</p><p>Place: __________________</p><p>Date: __________________</p></div></section><footer class="footer"><span>System-generated management draft · Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</span><span>Page 1</span></footer><section class="page-break"><header class="notes-head"><h2>NOTES FORMING PART OF THE BALANCE SHEET</h2><p>${escapeHtml(entityName)} · As at ${escapeHtml(displayDate(asAtDate))}</p></header>${notesHtml}<div class="validation"><b>Statement validation</b><div>Current period: Total Assets ${escapeHtml(statementAmount(currentPosition.totalAssets))} · Total Equity and Liabilities ${escapeHtml(statementAmount(currentPosition.totalEquityAndLiabilities))} · Difference ${escapeHtml(statementAmount(currentDifference))}</div><div>Previous period: Total Assets ${escapeHtml(statementAmount(previousPosition.totalAssets))} · Total Equity and Liabilities ${escapeHtml(statementAmount(previousPosition.totalEquityAndLiabilities))} · Difference ${escapeHtml(statementAmount(previousDifference))}</div><div style="margin-top:5px;font-weight:700;color:${statementBalanced ? '#047857' : '#be123c'}">${statementBalanced ? 'Arithmetic validation: BALANCED' : 'Arithmetic validation: REVIEW REQUIRED'}</div></div><footer class="footer"><span>These notes must be completed with applicable Schedule III and Accounting Standard disclosures.</span><span>Page 2</span></footer></section></main></body></html>`);
    popup.document.head.insertAdjacentHTML('beforeend', `<style>
      @page ledger { size: A4 landscape; margin: 10mm; }
      .ledger-page { page: ledger; width: 297mm; min-height: 210mm; padding: 10mm; }
      .ledger-page .ledger-heading { border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
      .ledger-page .ledger-heading h2 { margin: 0; font-size: 14px; }
      .ledger-page .ledger-heading p { margin: 4px 0 0; color: #64748b; }
      .ledger-page .ledger-notice { margin: 10px 0; padding: 7px 9px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-size: 8.5px; line-height: 1.45; }
      .ledger-page .ledger-table { table-layout: fixed; font-size: 7.5px; }
      .ledger-page .ledger-table th { padding: 6px 4px; font-size: 7px; }
      .ledger-page .ledger-table td { padding: 4px; font-size: 7.5px; line-height: 1.3; overflow-wrap: anywhere; }
      .ledger-page .ledger-table th:nth-child(1), .ledger-page .ledger-table td:nth-child(1) { width: 3%; text-align: center; }
      .ledger-page .ledger-table th:nth-child(2), .ledger-page .ledger-table td:nth-child(2) { width: 8%; white-space: nowrap; }
      .ledger-page .ledger-table th:nth-child(3), .ledger-page .ledger-table td:nth-child(3) { width: 20%; }
      .ledger-page .ledger-table th:nth-child(4), .ledger-page .ledger-table td:nth-child(4) { width: 11%; }
      .ledger-page .ledger-table th:nth-child(5), .ledger-page .ledger-table td:nth-child(5) { width: 9%; }
      .ledger-page .ledger-table th:nth-child(6), .ledger-page .ledger-table td:nth-child(6), .ledger-page .ledger-table th:nth-child(7), .ledger-page .ledger-table td:nth-child(7), .ledger-page .ledger-table th:nth-child(8), .ledger-page .ledger-table td:nth-child(8) { width: 10%; }
      .ledger-page .ledger-table th:nth-child(9), .ledger-page .ledger-table td:nth-child(9) { width: 19%; }
      .ledger-page .ledger-table span { color: #64748b; }
      .ledger-page .ledger-table .empty { padding: 20px; text-align: center; color: #64748b; }
      @media print { .ledger-page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; } .ledger-page .ledger-table thead { display: table-header-group; } .ledger-page .ledger-table tr { break-inside: avoid; } }
    </style>`);
    popup.document.body.insertAdjacentHTML('beforeend', `<section class="page ledger-page"><header class="ledger-heading"><h2>SUPPORTING LEDGER PRINT SCHEDULE</h2><p>${escapeHtml(entityName)} · Through ${escapeHtml(displayDate(asAtDate))} · ${escapeHtml(scopeLabel(scope))}</p></header><div class="ledger-notice"><b>Supporting schedule only.</b> This ledger is included with the Balance Sheet PDF and Excel pack for review and reconciliation. It does not replace the Schedule III face statement or the final audited books.<br><b>Selection:</b> ${escapeHtml(ledgerFilterLabel)} · ${transactions.length.toLocaleString('en-IN')} approved entry / entries returned.</div><table class="ledger-table"><thead><tr><th>#</th><th>Date</th><th>Entity / details</th><th>Module</th><th>Mode</th><th class="num">Money out (₹)</th><th class="num">Money in (₹)</th><th class="num">Running balance (₹)</th><th>Remarks</th></tr></thead><tbody>${ledgerRowsHtml}</tbody></table><footer class="footer"><span>System-generated supporting ledger · Generated ${escapeHtml(new Date().toLocaleString('en-IN'))}</span><span>Rows: ${transactions.length.toLocaleString('en-IN')}</span></footer></section>`);
    popup.document.close();
  };

  if (!siteId) return <div className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={Building2} title="Select a site to prepare its Balance Sheet" description="The statement is generated from one site's approved accounting books." /></div>;

  return (
    <div className="w-full min-h-0 space-y-4 pb-8">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-start lg:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white"><Landmark className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-950">Balance Sheet</h1>
                <StatusPill tone="info">Schedule III · Division I</StatusPill>
                <StatusPill>Management draft</StatusPill>
              </div>
              <p className="mt-1 text-[12px] text-slate-500">{entityName} · {siteName} · comparative financial-position statement for CA review</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => loadReport({ fresh: true })} disabled={refreshing} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40" title="Refresh"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={exportExcel} disabled={!report || showSkeleton} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Download className="h-3.5 w-3.5 text-emerald-700" /> Excel + ledger</button>
            <button type="button" onClick={printStatement} disabled={!report || showSkeleton} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-950 px-3 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> PDF + ledger</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5 sm:px-5">
          <div className="flex items-center rounded-md bg-slate-100 p-0.5">
            {SCOPES.map(([key, label, path]) => <button key={key} type="button" onClick={() => navigate(path)} className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${scope === key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
          </div>
          <label className="ml-auto flex items-center gap-2 text-[11px] font-semibold text-slate-500">Balance Sheet as at<Input type="date" value={asAtDate} max={TODAY} onChange={(event) => setAsAtDate(event.target.value)} className="h-8 w-36 border-slate-200 text-[11px]" /></label>
          <span className="hidden text-[10px] text-slate-400 sm:inline">Comparative: {displayDate(comparativeDate)}</span>
        </div>

        <div className="flex items-center overflow-x-auto px-2 sm:px-3">
          {VIEWS.map(([key, label, icon]) => <TabButton key={key} active={view === key} icon={icon} onClick={() => setView(key)}>{label}</TabButton>)}
          {busy && <span className="ml-auto inline-flex items-center gap-1.5 px-3 text-[11px] text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating…</span>}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p><b>CA review required:</b> this statement now follows the Schedule III face format and comparative-column convention, but it uses operational cash/bank books only. Capital, inventory valuation, receivables, payables, tax, depreciation, provisions and audit adjustments must be completed before filing or signing.</p>
      </div>

      {view === 'statement' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-5">
            <div><h2 className="text-[14px] font-bold text-slate-950">{entityName}</h2><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Balance Sheet as at {displayDate(asAtDate)} · Amount in ₹</p></div>
            <div className="flex items-center gap-2"><StatusPill icon={ShieldCheck}>Approved books</StatusPill><StatusPill tone={statementBalanced ? 'positive' : 'attention'} icon={statementBalanced ? CheckCircle2 : AlertTriangle}>{statementBalanced ? 'Arithmetically balanced' : 'Difference found'}</StatusPill></div>
          </div>
          {showSkeleton ? <div className="space-y-2 p-5">{Array.from({ length: 12 }, (_, index) => <SkeletonBlock key={index} className="h-9 w-full" />)}</div> : <ScheduleTable rows={scheduleRows} currentDate={asAtDate} previousDate={comparativeDate} />}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-4 text-slate-500 sm:px-5">The accompanying notes form an integral part of this management draft. Negative values are shown in parentheses. Zero or unavailable statutory classifications are shown as “—”.</div>
        </section>
      )}

      {view === 'notes' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-[14px] font-bold text-slate-950">Notes forming part of the Balance Sheet</h2><p className="mt-1 text-[11px] text-slate-500">System basis, classifications and required professional review points.</p></div>
            <div className="divide-y divide-slate-200">{notes.map((note) => <article key={note.no} className="grid gap-2 px-5 py-4 sm:grid-cols-[2rem_13rem_1fr]"><span className="text-[12px] font-bold text-blue-700">{note.no}</span><h3 className="text-[12px] font-bold text-slate-800">{note.title}</h3><p className="text-[11px] leading-5 text-slate-500">{note.text}</p></article>)}</div>
          </section>
          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-[13px] font-bold text-slate-950">Validation control</h2><dl className="mt-3 space-y-2 text-[11px]"><div className="flex justify-between gap-3"><dt className="text-slate-500">Total assets</dt><dd className="font-semibold tabular-nums">₹{indianNumber(currentPosition.totalAssets)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Equity and liabilities</dt><dd className="font-semibold tabular-nums">₹{indianNumber(currentPosition.totalEquityAndLiabilities)}</dd></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt className="font-semibold text-slate-700">Difference</dt><dd className={`font-bold tabular-nums ${Math.abs(currentDifference) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>₹{indianNumber(currentDifference)}</dd></div></dl></section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-[13px] font-bold text-slate-950">CA finalisation checklist</h2><ul className="mt-3 space-y-2 text-[11px] text-slate-600">{['Post opening balances and share / partner capital', 'Classify inventory, receivables and payables', 'Post depreciation, tax, accruals and provisions', 'Reconcile bank accounts and confirmations', 'Complete Schedule III disclosures and ageing schedules', 'Add audit report reference, FRN, Membership No. and UDIN'].map((item) => <li key={item} className="flex gap-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300" />{item}</li>)}</ul></section>
            {(report?.quality?.excluded_unapproved > 0 || report?.quality?.excluded_bounced > 0 || report?.quality?.invalid_date_entries > 0) && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="text-[12px] font-bold text-amber-900">Data exclusions</h2><p className="mt-2 text-[11px] leading-5 text-amber-800">{report.quality.excluded_unapproved || 0} unapproved · {report.quality.excluded_bounced || 0} bounced/returned · {report.quality.invalid_date_entries || 0} invalid-date rows excluded.</p></section>}
          </aside>
        </div>
      )}

      {view === 'ledger' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <div className="relative min-w-56 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search party, plot or remarks…" className="h-8 border-slate-200 pl-9 pr-8 text-[11px]" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}</div>
            <Select value={source} onValueChange={setSource}><SelectTrigger className="h-8 w-44 border-slate-200 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{SOURCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={paymentMode} onValueChange={setPaymentMode}><SelectTrigger className="h-8 w-36 border-slate-200 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{MODE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={direction} onValueChange={setDirection}><SelectTrigger className="h-8 w-36 border-slate-200 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{DIRECTION_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            {hasLedgerFilters && <button type="button" onClick={resetLedgerFilters} className="h-8 px-2 text-[11px] font-semibold text-blue-700">Clear filters</button>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px]"><span className="font-semibold text-slate-700">Supporting ledger through {displayDate(asAtDate)}</span><span className="text-slate-500">{transactions.length.toLocaleString('en-IN')} returned · included in PDF and Excel · running balance remains whole-book</span></div>
          {showSkeleton ? <div className="space-y-2 p-5">{Array.from({ length: 8 }, (_, index) => <SkeletonBlock key={index} className="h-10 w-full" />)}</div> : <LedgerTable rows={pageTransactions} page={safePage} pageCount={pageCount} totalRows={transactions.length} onPageChange={setPage} />}
        </section>
      )}
    </div>
  );
};

export default BalanceSheet;
