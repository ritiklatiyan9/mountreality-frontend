import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertCircle, ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronRight,
  CircleDollarSign, FileSearch, FileSpreadsheet, Landmark, ListFilter, Loader2, LockKeyhole,
  Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, Unlink, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { money } from '../lib/utils';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_ADJUSTMENT = { date: today(), direction: 'debit', amount: '', payment_mode: 'BANK', description: '', reference: '' };
const EMPTY_IMPORT = { statement_month: currentMonth(), opening_balance: '', closing_balance: '', notes: '' };

const title = (value) => String(value || '').replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parseAmount = (value) => {
  if (typeof value === 'number') return Math.abs(value);
  const raw = String(value || '').trim();
  if (!raw) return 0;
  return Math.abs(Number(raw.replace(/[^0-9.]/g, '')) || 0);
};
const parseExcelDate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = /^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)/.exec(raw);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const indian = /^([0-3]?\d)[-/]([01]?\d)[-/](\d{4})/.exec(raw);
  if (indian) return `${indian[3]}-${String(indian[2]).padStart(2, '0')}-${String(indian[1]).padStart(2, '0')}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const parseStatementRow = (row) => {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value]));
  const pick = (...keys) => {
    for (const key of keys) {
      const value = normalized[normalizeHeader(key)];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };
  const transactionDate = parseExcelDate(pick('Transaction Date', 'Txn Date', 'Value Date', 'Date', 'Posting Date'));
  let debit = parseAmount(pick('Debit', 'Debit Amount', 'Withdrawal', 'Withdrawal Amount', 'Dr Amount', 'DR'));
  let credit = parseAmount(pick('Credit', 'Credit Amount', 'Deposit', 'Deposit Amount', 'Cr Amount', 'CR'));
  const amountValue = pick('Amount', 'Transaction Amount');
  const amount = parseAmount(amountValue);
  const type = String(pick('Type', 'Dr/Cr', 'Debit/Credit', 'Transaction Type')).toLowerCase();
  if (!debit && !credit && amount) {
    if (type.includes('dr') || type.includes('debit') || String(amountValue).trim().startsWith('-')) debit = amount;
    else credit = amount;
  }
  return {
    transaction_date: transactionDate,
    value_date: parseExcelDate(pick('Value Date')) || null,
    description: String(pick('Description', 'Narration', 'Particulars', 'Transaction Details', 'Remarks') || 'Bank transaction').trim(),
    reference: String(pick('Reference', 'Transaction ID', 'UTR', 'Cheque No', 'Cheque Number', 'Ref No')).trim(),
    debit,
    credit,
    running_balance: pick('Balance', 'Closing Balance', 'Running Balance'),
  };
};

const statusTone = {
  MATCHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SUGGESTED: 'border-blue-200 bg-blue-50 text-blue-700',
  UNMATCHED: 'border-amber-200 bg-amber-50 text-amber-700',
  IGNORED: 'border-slate-200 bg-slate-50 text-slate-600',
  CLOSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
};

const MetricCard = ({ icon, label, value, hint, tone = 'text-mr-text' }) => (
  <div className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-slate-900/[0.02]">
    <div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mr-muted">{label}</p>{createElement(icon, { className: `h-4 w-4 ${tone}` })}</div>
    <p className={`mt-2 text-xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
    {hint ? <p className="mt-1 text-xs text-mr-muted">{hint}</p> : null}
  </div>
);

export default function BankAccountDetail() {
  const { id } = useParams();
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('plot_payments', 'write');
  const canUpdate = hasPermission('plot_payments', 'update');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('activity');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [workspace, setWorkspace] = useState(null);
  const [batches, setBatches] = useState([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconFilter, setReconFilter] = useState('exceptions');
  const [busyLine, setBusyLine] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState(EMPTY_IMPORT);
  const [statementFile, setStatementFile] = useState(null);
  const [statementRows, setStatementRows] = useState([]);
  const [statementPreview, setStatementPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustment, setAdjustment] = useState(EMPTY_ADJUSTMENT);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [manualLine, setManualLine] = useState(null);

  const loadLedger = useCallback(async () => {
    if (!siteId || !id) return;
    setLoading(true);
    try {
      const response = await api.get(`/bank-accounts/${id}/transactions`, {
        params: { site_id: siteId, page, limit: 25, ...(search ? { search } : {}), ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) },
      });
      setData(response.data);
    } catch (error) { toast.error(error.response?.data?.message || 'Bank ledger could not be loaded'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, id, page, search, siteId]);

  const loadReconciliation = useCallback(async ({ quiet = false } = {}) => {
    if (!siteId || !id || !month) return;
    if (!quiet) setReconLoading(true);
    try {
      const [{ data: nextWorkspace }, { data: history }] = await Promise.all([
        api.get(`/bank-accounts/${id}/reconciliation`, { params: { site_id: siteId, month } }),
        api.get(`/bank-accounts/${id}/reconciliations`, { params: { site_id: siteId } }),
      ]);
      setWorkspace(nextWorkspace);
      setBatches(history.reconciliations || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Reconciliation workspace could not be loaded'); }
    finally { setReconLoading(false); }
  }, [id, month, siteId]);

  useEffect(() => { void loadLedger(); }, [loadLedger]);
  useEffect(() => { if (tab === 'reconciliation') void loadReconciliation(); }, [loadReconciliation, tab]);

  const account = data?.account;
  const summary = data?.summary || {};
  const pagination = data?.pagination || {};
  const reconciliation = workspace?.reconciliation;
  const metrics = workspace?.metrics || {};
  const filteredLines = useMemo(() => {
    const lines = workspace?.lines || [];
    if (reconFilter === 'matched') return lines.filter((line) => line.match_status === 'MATCHED');
    if (reconFilter === 'all') return lines;
    return lines.filter((line) => ['UNMATCHED', 'SUGGESTED'].includes(line.match_status));
  }, [reconFilter, workspace?.lines]);

  const resetImport = () => {
    setImportForm({ ...EMPTY_IMPORT, statement_month: month });
    setStatementFile(null); setStatementRows([]); setStatementPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const openImport = () => { resetImport(); setImportOpen(true); };
  const handleStatementFile = async (file) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const parsed = rawRows.map(parseStatementRow).filter((row) => row.transaction_date && ((row.debit > 0) !== (row.credit > 0)));
      if (!parsed.length) throw new Error('No valid rows found. Include Date, Narration/Description, and Debit or Credit columns.');
      setStatementFile(file); setStatementRows(parsed); setStatementPreview(parsed.slice(0, 5));
      setImportForm((current) => ({ ...current, statement_month: parsed[0].transaction_date.slice(0, 7) || current.statement_month }));
    } catch (error) {
      setStatementFile(null); setStatementRows([]); setStatementPreview([]);
      toast.error(error.message || 'Statement file could not be read');
    }
  };

  const importStatement = async () => {
    if (!statementRows.length) return toast.error('Choose a valid CSV or Excel bank statement');
    setImporting(true);
    try {
      const { data: result } = await api.post(`/bank-accounts/${id}/statements`, {
        site_id: siteId, ...importForm, file_name: statementFile?.name, rows: statementRows,
      });
      setMonth(importForm.statement_month); setWorkspace(result); setImportOpen(false);
      toast.success(`Imported ${result.import_summary?.imported || statementRows.length} rows and matched ${result.metrics?.matched_lines || 0}`);
      const [, history] = await Promise.all([
        loadLedger(),
        api.get(`/bank-accounts/${id}/reconciliations`, { params: { site_id: siteId } }),
      ]);
      setBatches(history.data.reconciliations || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Statement could not be imported'); }
    finally { setImporting(false); }
  };

  const runAutoMatch = async () => {
    if (!reconciliation) return;
    setReconLoading(true);
    try {
      const { data: result } = await api.post(`/bank-accounts/${id}/reconciliations/${reconciliation.id}/auto-match`, { site_id: siteId });
      setWorkspace(result); toast.success('Matching refreshed against the latest ledger');
    } catch (error) { toast.error(error.response?.data?.message || 'Automatic matching failed'); }
    finally { setReconLoading(false); }
  };

  const updateLine = async (line, action, candidate = null) => {
    setBusyLine(line.id);
    try {
      const { data: result } = await api.put(`/bank-accounts/${id}/reconciliations/${reconciliation.id}/lines/${line.id}`, {
        site_id: siteId, action, ...(candidate ? { source: candidate.source, source_id: candidate.id } : {}),
      });
      setWorkspace(result); setManualLine(null);
    } catch (error) { toast.error(error.response?.data?.message || 'Match could not be updated'); }
    finally { setBusyLine(null); }
  };

  const closeMonth = async (action = 'close') => {
    try {
      const { data: result } = await api.post(`/bank-accounts/${id}/reconciliations/${reconciliation.id}/${action}`, { site_id: siteId });
      setWorkspace(result); toast.success(action === 'close' ? 'Bank month closed' : 'Bank month reopened');
      void loadReconciliation({ quiet: true });
    } catch (error) { toast.error(error.response?.data?.message || `Month could not be ${action}d`); }
  };

  const openAdjustment = (line = null) => {
    setAdjustment(line ? {
      date: String(line.transaction_date).slice(0, 10), direction: Number(line.debit) > 0 ? 'debit' : 'credit',
      amount: String(Number(line.debit) || Number(line.credit) || ''), payment_mode: 'BANK',
      description: line.description || '', reference: line.reference || '',
    } : EMPTY_ADJUSTMENT);
    setAdjustmentOpen(true);
  };
  const saveAdjustment = async () => {
    setSavingAdjustment(true);
    try {
      await api.post(`/bank-accounts/${id}/transactions`, { site_id: siteId, ...adjustment });
      toast.success('Bank entry added to the unified ledger'); setAdjustmentOpen(false);
      await loadLedger();
      if (reconciliation) await runAutoMatch();
    } catch (error) { toast.error(error.response?.data?.message || 'Bank entry could not be added'); }
    finally { setSavingAdjustment(false); }
  };

  const candidateRows = useMemo(() => {
    if (!manualLine) return [];
    const sameAmount = (row) => Number(row.debit || 0) === Number(manualLine.debit || 0) && Number(row.credit || 0) === Number(manualLine.credit || 0);
    return [...(workspace?.ledger_unmatched || [])].sort((a, b) => Number(sameAmount(b)) - Number(sameAmount(a)) || String(b.date).localeCompare(String(a.date)));
  }, [manualLine, workspace?.ledger_unmatched]);

  if (!currentSite) return <div className="flex min-h-72 flex-col items-center justify-center text-center"><Landmark className="h-9 w-9 text-mr-faint" /><p className="mt-3 text-sm text-mr-muted">Select a Site to open its banking workspace.</p></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      <Link to="/bank-configs" className="inline-flex items-center gap-2 text-sm font-medium text-mr-muted transition-colors hover:text-mr-text"><ArrowLeft className="h-4 w-4" /> Bank accounts</Link>

      <header className="relative overflow-hidden rounded-3xl bg-mr-ink p-5 text-white shadow-xl shadow-slate-950/10 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-mr-lime/10 blur-3xl" />
        {loading && !account ? <Skeleton className="h-36 bg-white/10" /> : <div className="relative">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10"><Landmark className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mr-lime">Banking workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{account?.bank_name || account?.label || 'Bank account'}</h1><p className="mt-1.5 text-sm text-zinc-300">{account?.label}{account?.masked_account_no ? ` · ${account.masked_account_no}` : ''}{account?.ifsc ? ` · ${account.ifsc}` : ''}</p></div></div>
            {canWrite ? <Button onClick={() => openAdjustment()} className="rounded-full bg-white text-slate-950 hover:bg-zinc-100"><Plus className="mr-2 h-4 w-4" /> Add bank entry</Button> : null}
          </div>
          <div className="mt-7 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[['Transactions', summary.total || 0], ['Money in', money(summary.total_credit)], ['Money out', money(summary.total_debit)], ['Ledger balance', money(summary.balance)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur"><p className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1 text-base font-semibold tabular-nums sm:text-lg">{value}</p></div>)}
          </div>
        </div>}
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-mr-line bg-mr-surface-2 p-1 sm:w-[420px]">
          <TabsTrigger value="activity" className="gap-2 rounded-lg"><ListFilter className="h-4 w-4" /> Account activity</TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-2 rounded-lg"><ShieldCheck className="h-4 w-4" /> Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <section className="overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-slate-900/[0.02]">
            <div className="flex flex-col gap-3 border-b border-mr-line p-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-semibold text-mr-text">Unified bank ledger</h2><p className="text-xs text-mr-muted">Non-cash entries posted from Dashboard, payments, expenses, firms, vendors, commissions, registry and cashflow.</p></div>
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}>
                <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="h-9 sm:w-36" aria-label="From date" />
                <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="h-9 sm:w-36" aria-label="To date" />
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search narration or UTR" className="h-9 pl-9 sm:w-64" /></div>
              </form>
            </div>
            {loading ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : !data?.transactions?.length ? <div className="py-16 text-center"><FileSearch className="mx-auto h-10 w-10 text-mr-faint" /><p className="mt-3 text-sm font-medium">No bank transactions in this scope</p><p className="mt-1 text-xs text-mr-muted">Choose this account in a non-cash entry modal or add a bank entry here.</p></div> : <>
              <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow className="bg-mr-surface-2"><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Description</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Money out</TableHead><TableHead className="text-right">Money in</TableHead></TableRow></TableHeader><TableBody>{data.transactions.map((transaction) => <TableRow key={`${transaction.source}-${transaction.id}`}><TableCell className="whitespace-nowrap">{dateLabel(transaction.date)}</TableCell><TableCell><Badge variant="outline" className="rounded-full border-mr-line">{title(transaction.source)}</Badge></TableCell><TableCell><p className="max-w-sm truncate font-medium text-mr-text">{transaction.description || 'Transaction'}</p><p className="max-w-sm truncate text-xs text-mr-muted">{transaction.reference || 'No reference'}</p></TableCell><TableCell className="text-xs font-medium">{transaction.payment_mode || 'BANK'}</TableCell><TableCell><span className="text-xs capitalize text-mr-muted">{transaction.status || 'posted'}</span></TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-coral-ink">{Number(transaction.debit) ? money(transaction.debit) : '—'}</TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-lime-ink">{Number(transaction.credit) ? money(transaction.credit) : '—'}</TableCell></TableRow>)}</TableBody></Table></div>
              <div className="divide-y divide-mr-line md:hidden">{data.transactions.map((transaction) => <div key={`${transaction.source}-${transaction.id}`} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-mr-text">{transaction.description || 'Transaction'}</p><p className="mt-1 text-xs text-mr-muted">{dateLabel(transaction.date)} · {title(transaction.source)}</p></div><p className={`font-semibold tabular-nums ${Number(transaction.debit) ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>{Number(transaction.debit) ? `−${money(transaction.debit)}` : `+${money(transaction.credit)}`}</p></div><p className="mt-2 truncate text-xs text-mr-muted">{transaction.reference || 'No reference'}</p></div>)}</div>
            </>}
            {pagination.totalPages > 1 ? <div className="flex items-center justify-between border-t border-mr-line p-4"><p className="text-xs text-mr-muted">Page {pagination.currentPage} of {pagination.totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div> : null}
          </section>
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <section className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-slate-900/[0.02] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mr-muted">Month-end control</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-mr-text">Bank statement reconciliation</h2><p className="mt-1 text-sm text-mr-muted">Match the bank-issued statement to transactions posted from every module.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row"><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 sm:w-44" />{canWrite ? <Button onClick={openImport} className="h-10"><Upload className="mr-2 h-4 w-4" /> {reconciliation ? 'Replace statement' : 'Import statement'}</Button> : null}</div>
            </div>
            {batches.length ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{batches.slice(0, 12).map((batch) => <button key={batch.id} type="button" onClick={() => setMonth(String(batch.statement_month).slice(0, 7))} className={`min-w-36 rounded-xl border px-3 py-2 text-left transition-colors ${String(batch.statement_month).slice(0, 7) === month ? 'border-mr-ink bg-mr-ink text-white' : 'border-mr-line bg-mr-surface-2 text-mr-text hover:bg-mr-surface'}`}><p className="text-xs font-semibold">{new Date(`${String(batch.statement_month).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p><p className={`mt-1 text-[10px] ${String(batch.statement_month).slice(0, 7) === month ? 'text-zinc-300' : 'text-mr-muted'}`}>{batch.matched_lines}/{batch.total_lines} matched · {title(batch.status)}</p></button>)}</div> : null}
          </section>

          {reconLoading ? <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div> : !reconciliation ? <section className="rounded-2xl border border-dashed border-mr-line bg-mr-surface py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mr-surface-2"><FileSpreadsheet className="h-6 w-6 text-mr-muted" /></span><h3 className="mt-4 font-semibold text-mr-text">No statement imported for this month</h3><p className="mx-auto mt-2 max-w-lg text-sm text-mr-muted">Upload an Excel or CSV bank statement. Exact date-and-amount rows will match automatically; exceptions remain for review.</p><div className="mx-auto mt-6 grid max-w-2xl gap-3 px-4 text-left sm:grid-cols-3">{[[Upload, '1. Import', 'Upload the bank-issued file.'], [Sparkles, '2. Auto-match', 'Compare every connected module.'], [LockKeyhole, '3. Close month', 'Resolve exceptions and lock.']].map(([icon, heading, copy]) => <div key={heading} className="rounded-xl border border-mr-line bg-mr-surface-2 p-3">{createElement(icon, { className: 'h-4 w-4 text-mr-lime-ink' })}<p className="mt-2 text-sm font-semibold">{heading}</p><p className="mt-1 text-xs text-mr-muted">{copy}</p></div>)}</div>{canWrite ? <Button className="mt-6" onClick={openImport}><Upload className="mr-2 h-4 w-4" /> Import statement</Button> : null}</section> : <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={ShieldCheck} label="Matched" value={`${metrics.matched_lines || 0} / ${metrics.total_lines || 0}`} hint={`${metrics.progress || 0}% statement coverage`} tone="text-emerald-700" />
              <MetricCard icon={AlertCircle} label="Statement exceptions" value={(metrics.unmatched_lines || 0) + (metrics.suggested_lines || 0)} hint={`${metrics.suggested_lines || 0} suggestions awaiting review`} tone={(metrics.unmatched_lines || metrics.suggested_lines) ? 'text-amber-700' : 'text-emerald-700'} />
              <MetricCard icon={Unlink} label="Missing in statement" value={metrics.ledger_unmatched || 0} hint="System ledger rows not matched" tone={metrics.ledger_unmatched ? 'text-amber-700' : 'text-emerald-700'} />
              <MetricCard icon={CircleDollarSign} label="Net difference" value={money(metrics.difference || 0)} hint={`Closing variance ${money(metrics.closing_variance || 0)}`} tone={Math.abs(metrics.difference || 0) > 0.009 ? 'text-rose-700' : 'text-emerald-700'} />
            </div>

            <section className="rounded-2xl border border-mr-line bg-mr-surface p-4 shadow-sm shadow-slate-900/[0.02]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-mr-text">{reconciliation.file_name || 'Imported statement'}</h3><Badge variant="outline" className={`rounded-full ${statusTone[reconciliation.status] || statusTone.IN_PROGRESS}`}>{title(reconciliation.status)}</Badge></div><p className="mt-1 text-xs text-mr-muted">{dateLabel(reconciliation.period_start)} – {dateLabel(reconciliation.period_end)} · Opening {money(reconciliation.opening_balance)} · Closing {reconciliation.closing_balance == null ? 'Not provided' : money(reconciliation.closing_balance)}</p><Progress value={metrics.progress || 0} className="mt-3 h-2 max-w-xl bg-slate-100 [&>div]:bg-emerald-500" /></div><div className="flex flex-wrap gap-2">{reconciliation.status !== 'CLOSED' && canUpdate ? <><Button variant="outline" size="sm" onClick={runAutoMatch} disabled={reconLoading}><RefreshCw className="mr-2 h-4 w-4" /> Auto-match</Button><Button size="sm" onClick={() => closeMonth('close')} disabled={!metrics.can_close}><LockKeyhole className="mr-2 h-4 w-4" /> Close month</Button></> : canUpdate ? <Button variant="outline" size="sm" onClick={() => closeMonth('reopen')}><RotateCcw className="mr-2 h-4 w-4" /> Reopen</Button> : null}</div></div>
              {!metrics.can_close && reconciliation.status !== 'CLOSED' ? <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Month is not ready to close</AlertTitle><AlertDescription>Resolve {metrics.unmatched_lines || 0} unmatched lines, review {metrics.suggested_lines || 0} suggestions, and account for {metrics.ledger_unmatched || 0} ledger rows. Net and closing differences must be zero.</AlertDescription></Alert> : null}
            </section>

            <section className="overflow-hidden rounded-2xl border border-mr-line bg-mr-surface shadow-sm shadow-slate-900/[0.02]">
              <div className="flex flex-col gap-3 border-b border-mr-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-mr-text">Statement lines</h3><p className="text-xs text-mr-muted">Review automatic matches and resolve exceptions.</p></div><div className="flex rounded-lg border border-mr-line bg-mr-surface-2 p-1">{[['exceptions', 'Exceptions'], ['matched', 'Matched'], ['all', 'All']].map(([value, label]) => <button key={value} type="button" onClick={() => setReconFilter(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${reconFilter === value ? 'bg-white text-mr-text shadow-sm' : 'text-mr-muted'}`}>{label}</button>)}</div></div>
              {!filteredLines.length ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" /><p className="mt-3 text-sm font-medium">No lines in this view</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-mr-surface-2"><TableHead>Bank statement</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Match</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filteredLines.map((line) => <TableRow key={line.id}><TableCell><p className="font-medium text-mr-text">{line.description}</p><p className="mt-0.5 text-xs text-mr-muted">{dateLabel(line.transaction_date)} · {line.reference || `Row ${line.row_number}`}</p></TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-coral-ink">{Number(line.debit) ? money(line.debit) : '—'}</TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-lime-ink">{Number(line.credit) ? money(line.credit) : '—'}</TableCell><TableCell><Badge variant="outline" className={`rounded-full ${statusTone[line.match_status] || statusTone.UNMATCHED}`}>{title(line.match_status)}</Badge>{line.matched_transaction ? <div className="mt-1 max-w-xs text-xs text-mr-muted"><span className="font-medium text-mr-text">{title(line.matched_transaction.source)}</span> · {dateLabel(line.matched_transaction.date)} · {line.match_note}</div> : line.match_note ? <p className="mt-1 max-w-xs text-xs text-mr-muted">{line.match_note}</p> : null}</TableCell><TableCell><div className="flex justify-end gap-1">{line.match_status === 'SUGGESTED' && canUpdate ? <Button size="sm" className="h-8" disabled={busyLine === line.id} onClick={() => updateLine(line, 'accept')}><Check className="mr-1 h-3.5 w-3.5" /> Accept</Button> : null}{['UNMATCHED', 'SUGGESTED'].includes(line.match_status) && canUpdate ? <><Button variant="outline" size="sm" className="h-8" onClick={() => setManualLine(line)}>Find match</Button>{canWrite ? <Button variant="ghost" size="sm" className="h-8" onClick={() => openAdjustment(line)}>Create entry</Button> : null}</> : null}{line.match_status === 'MATCHED' && canUpdate ? <Button variant="ghost" size="sm" className="h-8 text-mr-muted" onClick={() => updateLine(line, 'clear')}><X className="mr-1 h-3.5 w-3.5" /> Unmatch</Button> : null}{line.match_status === 'UNMATCHED' && canUpdate ? <Button variant="ghost" size="sm" className="h-8 text-mr-muted" onClick={() => updateLine(line, 'ignore')}>Ignore</Button> : null}</div></TableCell></TableRow>)}</TableBody></Table></div>}
            </section>

            {workspace.ledger_unmatched?.length ? <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40"><div className="border-b border-amber-200 p-4"><h3 className="font-semibold text-amber-950">System entries missing from statement</h3><p className="text-xs text-amber-800/70">These transactions were posted in the selected month but are not matched to any bank row.</p></div><div className="divide-y divide-amber-100">{workspace.ledger_unmatched.slice(0, 20).map((row) => <div key={`${row.source}-${row.id}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-mr-text">{row.description || 'Ledger transaction'}</p><p className="text-xs text-mr-muted">{dateLabel(row.date)} · {title(row.source)} · {row.reference || 'No reference'}</p></div><p className={`font-semibold tabular-nums ${Number(row.debit) ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>{Number(row.debit) ? `−${money(row.debit)}` : `+${money(row.credit)}`}</p></div>)}</div></section> : null}
          </>}
        </TabsContent>
      </Tabs>

      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) resetImport(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Import bank statement</DialogTitle><DialogDescription>Excel and CSV files are parsed locally, then valid rows are stored and matched to the unified ledger.</DialogDescription></DialogHeader><div className="space-y-5 py-2"><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5"><Label>Statement month</Label><Input type="month" value={importForm.statement_month} onChange={(event) => setImportForm((current) => ({ ...current, statement_month: event.target.value }))} /></div><div className="space-y-1.5"><Label>Opening balance</Label><Input type="number" step="0.01" value={importForm.opening_balance} onChange={(event) => setImportForm((current) => ({ ...current, opening_balance: event.target.value }))} placeholder="0.00" /></div><div className="space-y-1.5"><Label>Closing balance</Label><Input type="number" step="0.01" value={importForm.closing_balance} onChange={(event) => setImportForm((current) => ({ ...current, closing_balance: event.target.value }))} placeholder="Optional" /></div></div><button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-mr-line bg-mr-surface-2 px-6 py-8 text-center transition-colors hover:border-mr-muted"><Upload className="h-7 w-7 text-mr-muted" /><p className="mt-3 text-sm font-semibold text-mr-text">{statementFile ? statementFile.name : 'Choose Excel or CSV statement'}</p><p className="mt-1 text-xs text-mr-muted">Expected columns: Date, Narration, Debit, Credit, Reference, Balance</p><input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => handleStatementFile(event.target.files?.[0])} /></button>{statementRows.length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-medium text-emerald-800">{statementRows.length} valid rows ready</p><p className="mt-1 text-xs text-emerald-700">Debit {money(statementRows.reduce((sum, row) => sum + row.debit, 0))} · Credit {money(statementRows.reduce((sum, row) => sum + row.credit, 0))}</p></div> : null}{statementPreview.length ? <div className="overflow-x-auto rounded-xl border border-mr-line"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Narration</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{statementPreview.map((row, index) => <TableRow key={`${row.transaction_date}-${index}`}><TableCell>{dateLabel(row.transaction_date)}</TableCell><TableCell className="max-w-xs truncate">{row.description}</TableCell><TableCell className="text-right">{row.debit ? money(row.debit) : '—'}</TableCell><TableCell className="text-right">{row.credit ? money(row.credit) : '—'}</TableCell></TableRow>)}</TableBody></Table></div> : null}<div className="space-y-1.5"><Label>Reconciliation notes</Label><Textarea value={importForm.notes} onChange={(event) => setImportForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional month-end notes" rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button><Button onClick={importStatement} disabled={importing || !statementRows.length}>{importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Import and match</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add bank entry</DialogTitle><DialogDescription>Record a bank charge, interest, correction, or missing transaction directly in this account ledger.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="grid grid-cols-2 gap-3"><Button type="button" variant={adjustment.direction === 'debit' ? 'default' : 'outline'} onClick={() => setAdjustment((current) => ({ ...current, direction: 'debit' }))}><ArrowUpRight className="mr-2 h-4 w-4" /> Money out</Button><Button type="button" variant={adjustment.direction === 'credit' ? 'default' : 'outline'} onClick={() => setAdjustment((current) => ({ ...current, direction: 'credit' }))}><ArrowDownLeft className="mr-2 h-4 w-4" /> Money in</Button></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Date</Label><Input type="date" value={adjustment.date} onChange={(event) => setAdjustment((current) => ({ ...current, date: event.target.value }))} /></div><div className="space-y-1.5"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={adjustment.amount} onChange={(event) => setAdjustment((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div><div className="space-y-1.5"><Label>Payment mode</Label><Select value={adjustment.payment_mode} onValueChange={(value) => setAdjustment((current) => ({ ...current, payment_mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BANK">Bank</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="NEFT">NEFT</SelectItem><SelectItem value="RTGS">RTGS</SelectItem><SelectItem value="IMPS">IMPS</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>UTR / reference</Label><Input value={adjustment.reference} onChange={(event) => setAdjustment((current) => ({ ...current, reference: event.target.value }))} /></div></div><div className="space-y-1.5"><Label>Description</Label><Textarea value={adjustment.description} onChange={(event) => setAdjustment((current) => ({ ...current, description: event.target.value }))} placeholder="Bank charge, interest credit, correction…" rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setAdjustmentOpen(false)}>Cancel</Button><Button onClick={saveAdjustment} disabled={savingAdjustment || !adjustment.date || !adjustment.amount || !adjustment.description.trim()}>{savingAdjustment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add entry</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!manualLine} onOpenChange={(open) => { if (!open) setManualLine(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Find ledger match</DialogTitle><DialogDescription>Choose the system transaction represented by “{manualLine?.description}”. Same-side amount matches are shown first.</DialogDescription></DialogHeader><div className="divide-y divide-mr-line rounded-xl border border-mr-line">{candidateRows.length ? candidateRows.slice(0, 100).map((row) => <button type="button" key={`${row.source}-${row.id}`} onClick={() => updateLine(manualLine, 'match', row)} className="flex w-full items-center justify-between gap-4 p-3 text-left transition-colors hover:bg-mr-surface-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-mr-text">{row.description}</p><p className="mt-1 text-xs text-mr-muted">{dateLabel(row.date)} · {title(row.source)} · {row.reference || 'No reference'}</p></div><div className="flex shrink-0 items-center gap-3"><p className={`font-semibold tabular-nums ${Number(row.debit) ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>{Number(row.debit) ? money(row.debit) : money(row.credit)}</p><ChevronRight className="h-4 w-4 text-mr-faint" /></div></button>) : <div className="p-8 text-center text-sm text-mr-muted">No unmatched ledger transactions are available in this period.</div>}</div><DialogFooter><Button variant="outline" onClick={() => setManualLine(null)}>Cancel</Button></DialogFooter></DialogContent></Dialog>

      {loading && data ? <div className="fixed bottom-5 right-5 rounded-full bg-mr-ink p-3 text-white shadow-lg"><Loader2 className="h-4 w-4 animate-spin" /></div> : null}
    </div>
  );
}
