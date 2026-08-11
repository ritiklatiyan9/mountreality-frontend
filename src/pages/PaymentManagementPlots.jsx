import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../components/ui/sheet';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TableCell, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import {
  Search, Filter, X, Loader2, Plus, Trash2, Eye, IndianRupee,
  CalendarClock, AlertTriangle, CheckCircle2, Clock, CreditCard, Receipt, TrendingUp, Calendar,
  Wallet, ExternalLink, ArrowRight, Percent, ArrowLeft,
  ArrowUpDown, ChevronsUpDown, MapPin,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command';
import VoucherUpload from '../components/VoucherUpload';
import CreditDebitTabs from '../components/CreditDebitTabs';
import {
  EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips,
} from '../components/EntryModal';
import { classifyPaymentMode } from '../utils/paymentMode';
import BankAccountSelect from '../components/BankAccountSelect';

// ══════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════

const STATUS_CONFIG = {
  paid:           { label: 'Paid',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  partially_paid: { label: 'Partial',        color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Clock },
  overdue:        { label: 'Overdue',        color: 'bg-red-50 text-red-700 border-red-200',             icon: AlertTriangle },
  pending:        { label: 'Pending',        color: 'bg-slate-50 text-slate-600 border-slate-200',       icon: CalendarClock },
};

const DUE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Due Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'overdue', label: 'Overdue' },
];

const INTEREST_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_quarter', label: 'Per Quarter' },
  { value: 'per_year', label: 'Per Year' },
];

const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'IMPS', 'ADJUST', 'RETURN', 'REFUND',
];
const derivePaymentType = (from) => {
  const bucket = classifyPaymentMode(from);
  return bucket === 'cash' ? 'CASH' : bucket === 'cheque' ? 'CHEQUE' : 'BANK';
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Natural sort so "A1, A2, A10, A100" order correctly instead of lexicographic "A1, A10, A100, A2".
const naturalPlotCompare = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true });

// ══════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════

export default function PaymentManagementPlots() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Data ───
  const [plots, setPlots] = useState([]);
  const [summary, setSummary] = useState({});
  const [plotIndex, setPlotIndex] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [approvers, setApprovers] = useState([]);

  // ─── Filters ───
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [plotPickerOpen, setPlotPickerOpen] = useState(false);
  const [sortKey, setSortKey] = useState(null); // null = natural plot-number order
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    return () => clearTimeout(t);
  }, [message]);

  // ─── Installment Detail Dialog ───
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPlot, setDetailPlot] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Record Payment Dialog ───
  const [payOpen, setPayOpen] = useState(false);
  const [payPlot, setPayPlot] = useState(null);
  const [payMode, setPayMode] = useState('receive');
  const [payForm, setPayForm] = useState({ date: today(), amount: '', payment_from: '', payment_type: 'CASH', bank_details: '', narration: '', received_by: '', voucher_url: '', assigned_admin_id: '', bank_account_id: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);

  // ─── Create Installments Dialog ───
  const [instOpen, setInstOpen] = useState(false);
  const [instPlot, setInstPlot] = useState(null);
  const [instRows, setInstRows] = useState([]);
  const [instSubmitting, setInstSubmitting] = useState(false);

  // ─── Settings Dialog ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPlot, setSettingsPlot] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ interest_enabled: false, interest_rate: '', interest_type: 'per_month' });
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // ─── Confirm Dialog ───
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ══════════════════════════════════════════════════
  //  FETCH DATA
  // ══════════════════════════════════════════════════

  const fetchData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dueFilter !== 'all') params.set('due_filter', dueFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/plots/payment-management?${params}`);
      const rows = res.data.plots || [];
      setPlots(rows);
      setSummary(res.data.summary || {});
      setPlotIndex((prev) => {
        const next = { ...prev };
        rows.forEach((p) => { next[p.id] = p; });
        return next;
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [siteId, statusFilter, dueFilter, search]);

  const fetchApprovers = useCallback(async () => {
    try {
      const url = siteId ? `/admin/approvers?site_id=${siteId}` : '/admin/approvers';
      const res = await api.get(url);
      setApprovers(res.data.approvers || []);
    } catch (err) {
      console.error('Failed to fetch approvers', err);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
    fetchApprovers();
  }, [fetchData, fetchApprovers]);

  const fetchInstallments = useCallback(async (plotId) => {
    setDetailLoading(true);
    try {
      const instRes = await api.get(`/plots/${plotId}/installments`);
      setInstallments(instRes.data.installments || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load installments' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ══════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════

  const getPlotStatus = (plot) => {
    if (plot.installment_count === 0) return 'pending';
    if (plot.overdue_count > 0) return 'overdue';
    if (plot.total_remaining <= 0) return 'paid';
    if (plot.total_paid > 0) return 'partially_paid';
    return 'pending';
  };

  const statusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.color} gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  const progressPct = (paid, total) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const getAssignedAdminLabel = (adminId) => {
    if (!adminId) return null;
    const admin = approvers.find(a => a.id === parseInt(adminId));
    return admin ? admin.full_name : null;
  };

  useEffect(() => { setPlotIndex({}); }, [siteId]);

  // Open detail dialog (defined before the query-param auto-open effect below, which calls it)
  const openDetail = (plot) => {
    setDetailPlot(plot);
    setDetailOpen(true);
    fetchInstallments(plot.id);
  };

  // ── Deep-link from the Reminders page: ?plot=<id>&plot_no=&block=&buyer_name= ──
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const plotParam = searchParams.get('plot');
    if (!plotParam || loading) return;
    autoOpenedRef.current = true;
    const resolved = plotIndex[plotParam] || plots.find((p) => String(p.id) === String(plotParam)) || {
      id: plotParam,
      plot_no: searchParams.get('plot_no') || plotParam,
      block: searchParams.get('block') || undefined,
      buyer_name: searchParams.get('buyer_name') || undefined,
    };
    openDetail(resolved);
    // Clean the URL so a refresh/back doesn't re-trigger the auto-open.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, plotIndex, plots, searchParams]);

  // ── Client-side column sort. Default (no explicit sortKey) = natural plot-number order. ──
  const filteredPlots = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (!sortKey) return [...plots].sort((a, b) => naturalPlotCompare(a.plot_no, b.plot_no));
    return [...plots].sort((a, b) => {
      if (sortKey === 'plot_no') return dir * naturalPlotCompare(a.plot_no, b.plot_no);
      if (sortKey === 'next_due') {
        const av = a.next_due_date ? new Date(a.next_due_date).getTime() : Infinity;
        const bv = b.next_due_date ? new Date(b.next_due_date).getTime() : Infinity;
        return dir * (av - bv);
      }
      if (sortKey === 'pct') {
        const av = (parseFloat(a.sale_price) || 0) > 0 ? (a.total_paid / parseFloat(a.sale_price)) : 0;
        const bv = (parseFloat(b.sale_price) || 0) > 0 ? (b.total_paid / parseFloat(b.sale_price)) : 0;
        return dir * (av - bv);
      }
      return dir * ((parseFloat(a[sortKey]) || 0) - (parseFloat(b[sortKey]) || 0));
    });
  }, [plots, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey(null); setSortDir('asc'); } // third click = back to natural plot order
    } else { setSortKey(key); setSortDir(key === 'plot_no' ? 'asc' : 'desc'); }
  };

  const plotPickerOptions = useMemo(
    () => Object.values(plotIndex).sort((a, b) => naturalPlotCompare(a.plot_no, b.plot_no)),
    [plotIndex]
  );

  // ══════════════════════════════════════════════════
  //  ACTIONS
  // ══════════════════════════════════════════════════

  const openPayment = (plot) => {
    setPayPlot(plot);
    setPayMode('receive');
    setPayForm({
      date: today(),
      amount: '',
      payment_from: '',
      payment_type: 'CASH',
      bank_details: '',
      narration: '',
      received_by: '',
      voucher_url: '',
      assigned_admin_id: plot.assigned_admin_id || '',
      bank_account_id: '',
    });
    setPayOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return setMessage({ type: 'error', text: 'Enter a valid amount' });
    if (payForm.payment_type !== 'CASH' && !payForm.bank_account_id) return setMessage({ type: 'error', text: 'Select the bank account used for this transaction' });
    setPaySubmitting(true);
    try {
      const rawAmt = Math.abs(parseFloat(payForm.amount) || 0);
      await api.post('/plots/payments', {
        plot_id: payPlot.id,
        date: payForm.date,
        payment_from: payForm.payment_from,
        payment_type: payForm.payment_type,
        bank_details: payForm.bank_details,
        narration: payForm.narration,
        received_by: payForm.received_by,
        amount: payMode === 'refund' ? -rawAmt : rawAmt,
        voucher_url: payForm.voucher_url || null,
        assigned_admin_id: payForm.assigned_admin_id || null,
        bank_account_id: payForm.bank_account_id || null,
      });
      setMessage({ type: 'success', text: payMode === 'refund' ? 'Refund recorded' : 'Payment recorded' });
      setPayOpen(false);
      fetchData();
      if (detailOpen && detailPlot?.id === payPlot.id) fetchInstallments(payPlot.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Payment failed' });
    } finally {
      setPaySubmitting(false);
    }
  };

  const openCreateInstallments = (plot) => {
    setInstPlot(plot);
    setInstRows([{ installment_name: '', amount: '', due_date: '' }]);
    setInstOpen(true);
  };

  const addInstRow = () => setInstRows(prev => [...prev, { installment_name: '', amount: '', due_date: '' }]);
  const removeInstRow = (i) => setInstRows(prev => prev.filter((_, idx) => idx !== i));
  const updateInstRow = (i, field, val) => setInstRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleCreateInstallments = async (e) => {
    e.preventDefault();
    const valid = instRows.filter(r => r.amount && r.due_date);
    if (valid.length === 0) return setMessage({ type: 'error', text: 'Add at least one valid installment' });
    setInstSubmitting(true);
    try {
      await api.post(`/plots/${instPlot.id}/installments`, { installments: valid });
      setMessage({ type: 'success', text: `${valid.length} installment(s) created` });
      setInstOpen(false);
      fetchData();
      if (detailOpen && detailPlot?.id === instPlot.id) fetchInstallments(instPlot.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create installments' });
    } finally {
      setInstSubmitting(false);
    }
  };

  const handleDeleteInstallment = async (instId) => {
    try {
      await api.delete(`/plots/installments/${instId}`);
      setMessage({ type: 'success', text: 'Installment deleted' });
      if (detailPlot) fetchInstallments(detailPlot.id);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const openSettings = (plot) => {
    setSettingsPlot(plot);
    setSettingsForm({
      interest_enabled: !!plot.interest_enabled,
      interest_rate: plot.interest_rate || '',
      interest_type: plot.interest_type || 'per_month',
    });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    try {
      await api.put(`/plots/${settingsPlot.id}/installment-settings`, settingsForm);
      setMessage({ type: 'success', text: 'Settings updated' });
      setSettingsOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSettingsSubmitting(false);
    }
  };

  const confirmAndDo = (action) => { setConfirmAction(() => action); setConfirmOpen(true); };
  const executeConfirm = () => { if (confirmAction) confirmAction(); setConfirmOpen(false); setConfirmAction(null); };

  // ══════════════════════════════════════════════════
  //  GUARD
  // ══════════════════════════════════════════════════

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <IndianRupee className="w-10 h-10" />
        <p className="text-sm">Select a site to manage payments</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/payment-management')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">All Plots</h1>
          <p className="text-xs text-slate-500">
            Ordered by plot number · installments, collections & overdue interest{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
      </div>

      {/* ── Message Banner ── */}
      {message.text && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <X className="w-4 h-4 ml-auto cursor-pointer" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      {/* ── Filter Bar ── */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            {[
              { key: 'all', label: 'All', count: summary.total_count },
              { key: 'overdue', label: 'Overdue', count: summary.overdue_count, on: 'bg-red-600 border-red-600 text-white' },
              { key: 'partially_paid', label: 'Partial', count: summary.partial_count, on: 'bg-amber-500 border-amber-500 text-white' },
              { key: 'pending', label: 'Pending', count: summary.pending_count },
              { key: 'paid', label: 'Fully Paid', count: summary.paid_count, on: 'bg-emerald-600 border-emerald-600 text-white' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(statusFilter === f.key ? 'all' : f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  statusFilter === f.key
                    ? (f.on || 'bg-slate-900 text-white border-slate-900')
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {f.label} {f.count != null ? <span className="opacity-70">({f.count})</span> : null}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {DUE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setDueFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  dueFilter === f.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >{f.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search plot no, buyer, booking by…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Popover open={plotPickerOpen} onOpenChange={setPlotPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-40 justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Jump to plot…
                  </span>
                  <ChevronsUpDown className="w-3 h-3 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Plot no or buyer…" className="h-8 text-xs" />
                  <CommandList>
                    <CommandEmpty>No plot found.</CommandEmpty>
                    <CommandGroup>
                      {plotPickerOptions.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.plot_no} ${p.buyer_name || ''}`}
                          onSelect={() => { setPlotPickerOpen(false); openDetail(p); }}
                          className="text-xs"
                        >
                          <span className="font-semibold text-slate-800">{p.plot_no}</span>
                          {p.block && <span className="ml-1 text-slate-400">({p.block})</span>}
                          {p.buyer_name && <span className="ml-2 truncate text-slate-500">{p.buyer_name}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {(statusFilter !== 'all' || dueFilter !== 'all' || search) && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Status: {STATUS_CONFIG[statusFilter]?.label} <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
                </Badge>
              )}
              {dueFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Due: {DUE_FILTERS.find(f => f.value === dueFilter)?.label} <X className="w-3 h-3 cursor-pointer" onClick={() => setDueFilter('all')} />
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Search: {search} <X className="w-3 h-3 cursor-pointer" onClick={() => { setSearch(''); setSearchInput(''); }} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { setStatusFilter('all'); setDueFilter('all'); setSearch(''); setSearchInput(''); }}>Clear all</Button>
              <span className="text-xs text-slate-400 ml-auto">Showing {filteredPlots.length} plots</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Data Table ── */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : filteredPlots.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No plots with installments found</p>
              <p className="text-xs text-slate-400 mt-1">Enable installments on plots from the Plot Payments page</p>
            </div>
          ) : (
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left sticky left-0 z-40 bg-slate-50 px-3 py-2 min-w-24" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('plot_no')} className="h-6 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Plot
                        {sortKey === 'plot_no'
                          ? <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                          : <ArrowUpDown className="w-3 h-3 ml-1" />}
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left px-3 py-2 whitespace-nowrap">Buyer</th>
                    {[
                      { key: 'sale_price', label: 'Sale Price' },
                      { key: 'pct', label: 'Progress', left: true },
                      { key: 'total_paid', label: 'Paid' },
                      { key: 'total_remaining', label: 'Remaining' },
                      { key: 'next_due', label: 'Next Due', left: true },
                    ].map(({ key, label, left }) => (
                      <th key={key} className={`text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-2 whitespace-nowrap ${left ? 'text-left' : 'text-right'}`}>
                        <Button variant="ghost" size="sm" onClick={() => toggleSort(key)} className="h-6 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {label}
                          {sortKey === key
                            ? <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                            : <ArrowUpDown className="w-3 h-3 ml-1" />}
                        </Button>
                      </th>
                    ))}
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left px-3 py-2 whitespace-nowrap">Assigned To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Interest</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left px-3 py-2 whitespace-nowrap">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlots.map((plot) => {
                    const st = getPlotStatus(plot);
                    const pct = progressPct(plot.total_paid, parseFloat(plot.sale_price) || 0);
                    return (
                      <TableRow key={plot.id} className="group cursor-pointer" onClick={() => openDetail(plot)}>
                        <TableCell className="font-medium text-sm sticky left-0 z-10 bg-white group-hover:bg-slate-50" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                          <span className="inline-flex items-center gap-1 text-slate-900 group-hover:text-blue-600 transition-colors">
                            {plot.plot_no}
                            <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </span>
                          {plot.block && <span className="text-xs text-slate-400 ml-1">({plot.block})</span>}
                        </TableCell>
                        <TableCell className="text-sm">{plot.buyer_name || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-medium">₹{fmt(plot.sale_price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-slate-500 font-medium w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right text-emerald-600 font-medium">₹{fmt(plot.total_paid)}</TableCell>
                        <TableCell className="text-sm text-right text-slate-600 font-medium">₹{fmt(plot.total_remaining)}</TableCell>
                        <TableCell className="text-xs">
                          {plot.next_due_date ? (
                            <div>
                              <div className={new Date(plot.next_due_date) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                                {fmtDate(plot.next_due_date)}
                              </div>
                              {plot.next_due_amount > 0 && (
                                <div className="text-[10px] text-slate-400">₹{fmt(plot.next_due_amount)}</div>
                              )}
                            </div>
                           ) : '—'}
                        </TableCell>
                        <TableCell>
                          {getAssignedAdminLabel(plot.assigned_admin_id) ? (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                              {getAssignedAdminLabel(plot.assigned_admin_id)}
                            </Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {plot.interest_due > 0 ? (
                            <span className="text-red-600 font-medium">₹{fmt(plot.interest_due)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(st)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            {[
                              { icon: Eye, label: 'View Timeline', fn: () => openDetail(plot) },
                              { icon: CreditCard, label: 'Record Payment', fn: () => openPayment(plot) },
                              { icon: Plus, label: 'Add Installments', fn: () => openCreateInstallments(plot) },
                              { icon: TrendingUp, label: 'Interest Settings', fn: () => openSettings(plot) },
                              { icon: ExternalLink, label: 'Open Full Plot', fn: () => navigate(`/plot-payments/${plot.id}`) },
                            ].map(({ icon: Icon, label, fn }) => (
                              <Tooltip key={label}>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fn}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{label}</TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════ SHEET: Installment Timeline ══════ */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col gap-0">
          <SheetHeader className="shrink-0 space-y-0 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-bold shrink-0">
                    {detailPlot?.plot_no}
                  </span>
                  <span className="truncate">Plot {detailPlot?.plot_no}{detailPlot?.block ? ` · ${detailPlot.block}` : ''}</span>
                </SheetTitle>
                <SheetDescription className="mt-1 truncate">
                  {detailPlot?.buyer_name || '—'} · Sale ₹{fmt(detailPlot?.sale_price)}
                </SheetDescription>
              </div>
              {detailPlot && (
                <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs"
                  onClick={() => navigate(`/plot-payments/${detailPlot.id}`)}>
                  Full Plot <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : installments.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Calendar className="w-7 h-7 text-slate-300" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">No installments yet</p>
              <p className="text-xs text-slate-400">Create a schedule to start tracking dues</p>
              <Button size="sm" className="mt-4" onClick={() => { setDetailOpen(false); openCreateInstallments(detailPlot); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Installments
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-5">
                {(() => {
                  const total = installments.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                  const paid = installments.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);
                  const remaining = installments.reduce((s, i) => s + (parseFloat(i.remaining_amount) || 0), 0);
                  const interest = installments.reduce((s, i) => s + (parseFloat(i.interest_due) || 0), 0);
                  const pct = progressPct(paid, total);
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overall Progress</span>
                        <span className="text-sm font-bold text-slate-900">{pct}%</span>
                      </div>
                      <Progress value={pct} className="mt-2 h-2" />
                      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-slate-50 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-900">₹{fmt(total)}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-emerald-500">Paid</p>
                          <p className="mt-0.5 text-sm font-bold text-emerald-700">₹{fmt(paid)}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 py-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">Remaining</p>
                          <p className="mt-0.5 text-sm font-bold text-slate-700">₹{fmt(remaining)}</p>
                        </div>
                      </div>
                      {interest > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                          <Percent className="h-3.5 w-3.5" /> Overdue interest accrued: ₹{fmt(interest)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Installment Timeline</p>
                  <div className="relative">
                    {installments.map((inst, idx) => {
                      const stCfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.pending;
                      const Icon = stCfg.icon;
                      const pct = progressPct(inst.paid_amount, inst.amount);
                      const isLast = idx === installments.length - 1;
                      const isPaid = inst.status === 'paid';
                      const isOverdue = inst.status === 'overdue';
                      return (
                        <div key={inst.id} className="relative pl-11 pb-4 last:pb-0">
                          {!isLast && <span className="absolute left-[18px] top-9 -bottom-1 w-px bg-slate-200" />}
                          <span className={cn(
                            'absolute left-0 top-0.5 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white shrink-0',
                            isPaid ? 'bg-emerald-500 text-white'
                              : isOverdue ? 'bg-red-500 text-white'
                              : inst.status === 'partially_paid' ? 'bg-amber-500 text-white'
                              : 'bg-slate-200 text-slate-500',
                          )}>
                            {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                          </span>
                          <div className={cn(
                            'group rounded-xl border bg-white p-3 transition-shadow hover:shadow-sm',
                            isOverdue ? 'border-red-200' : 'border-slate-200',
                          )}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {inst.installment_name || `Installment ${idx + 1}`}
                                </p>
                                <p className={cn('mt-0.5 flex items-center gap-1 text-xs',
                                  isOverdue ? 'text-red-600 font-medium' : 'text-slate-500')}>
                                  <Calendar className="h-3 w-3" /> Due {fmtDate(inst.due_date)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {statusBadge(inst.status)}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => confirmAndDo(() => handleDeleteInstallment(inst.id))}>
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete installment</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between text-xs">
                              <span className="text-slate-500">Paid <b className="text-emerald-600">₹{fmt(inst.paid_amount)}</b> of <b className="text-slate-700">₹{fmt(inst.amount)}</b></span>
                              <span className="font-semibold text-slate-700">{pct}%</span>
                            </div>
                            <Progress value={pct} className="mt-1.5 h-1.5" />
                            {inst.interest_due > 0 && (
                              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-500">
                                <AlertTriangle className="h-3 w-3" /> Interest due: ₹{fmt(inst.interest_due)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <SheetFooter className="shrink-0 flex-row gap-2 border-t border-slate-100 bg-white px-6 py-3">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setDetailOpen(false); openCreateInstallments(detailPlot); }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
            <Button size="sm" className="flex-1" onClick={() => { setDetailOpen(false); openPayment(detailPlot); }}>
              <CreditCard className="w-3.5 h-3.5 mr-1" /> Record Payment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ══════ DIALOG: Record Payment ══════ */}
      <EntryDialog
        open={payOpen}
        onOpenChange={(open) => { setPayOpen(open); }}
        title="Record Payment"
        description={<>Plot {payPlot?.plot_no}{payPlot?.buyer_name ? ' — ' + payPlot?.buyer_name : ''} · Remaining: ₹{fmt(payPlot?.total_remaining)}</>}
        footer={
          <EntryFooter
            onCancel={() => setPayOpen(false)}
            onSubmit={() => document.getElementById('pm-record-payment-form')?.requestSubmit()}
            submitting={paySubmitting}
            submitLabel={payMode === 'refund' ? '↑ Record Refund' : '↓ Record Payment'}
            submitClassName={payMode === 'refund' ? 'bg-red-600 hover:bg-red-700' : undefined}
          />
        }>
        <form id="pm-record-payment-form" onSubmit={handleRecordPayment} className="space-y-4">
          <CreditDebitTabs
            value={payMode === 'refund' ? 'debit' : 'credit'}
            onChange={(v) => setPayMode(v === 'debit' ? 'refund' : 'receive')}
            creditHint="Receive payment"
            debitHint="Refund / return"
          />

          <EntryRow>
            <EntryField label="Date" required>
              <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} required />
            </EntryField>
            <EntryField label="Payment Type (Bank / Cash)" required>
              <EntryModeChips
                value={payForm.payment_type}
                modes={['BANK', 'CASH']}
                onChange={(m) => setPayForm({ ...payForm, payment_type: m })}
              />
            </EntryField>
          </EntryRow>

          <BankAccountSelect
            value={payForm.bank_account_id}
            onChange={(bankAccountId) => setPayForm({ ...payForm, bank_account_id: bankAccountId })}
            paymentMode={payForm.payment_type}
            disabled={paySubmitting}
          />

          <EntryAmount
            direction={payMode === 'refund' ? 'debit' : 'credit'}
            label={payMode === 'refund' ? 'Refund Amount (₹)' : 'Receive Amount (₹)'}
            hint={payForm.amount
              ? `${payMode === 'refund' ? '−' : '+'} ₹${fmt(Math.abs(parseFloat(payForm.amount) || 0))}${payMode === 'refund' ? ' will be deducted' : ' will be received'}`
              : undefined}
            inputProps={{
              step: '0.01', min: '0', placeholder: '50000',
              value: payForm.amount,
              onChange: (e) => setPayForm({ ...payForm, amount: e.target.value }),
              required: true,
            }}
          />

          <EntryField label="Payment From (Mode)">
            <EntryModeChips
              value={payForm.payment_from}
              modes={PAYMENT_FROM_OPTIONS}
              onChange={(f) => {
                const newFrom = payForm.payment_from === f ? '' : f;
                setPayForm({ ...payForm, payment_from: newFrom, payment_type: newFrom ? derivePaymentType(newFrom) : payForm.payment_type });
              }}
            />
            <Input placeholder="Or type custom mode..." className="mt-1.5"
              value={!PAYMENT_FROM_OPTIONS.includes(payForm.payment_from) ? payForm.payment_from : ''}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setPayForm({ ...payForm, payment_from: val, payment_type: val ? derivePaymentType(val) : payForm.payment_type });
              }} />
          </EntryField>

          <EntryRow>
            <EntryField label="Bank Details">
              <Input placeholder="CASH / SBI-613266 / UNB-037191" value={payForm.bank_details}
                onChange={(e) => setPayForm({ ...payForm, bank_details: e.target.value.toUpperCase() })} />
            </EntryField>
            <EntryField label="Received By">
              <Input placeholder="PRAVINDRA, SONU CHAUDHARY..." value={payForm.received_by}
                onChange={(e) => setPayForm({ ...payForm, received_by: e.target.value.toUpperCase() })} />
            </EntryField>
          </EntryRow>

          <EntryField label="Narration">
            <Textarea placeholder={payMode === 'refund' ? 'REFUND, RETURN...' : 'REGISTRY, BOOKING, INSTALLMENT...'}
              value={payForm.narration} onChange={(e) => setPayForm({ ...payForm, narration: e.target.value.toUpperCase() })} rows={2} className="text-sm resize-none" />
          </EntryField>

          <EntryField label="Voucher / Receipt">
            <VoucherUpload value={payForm.voucher_url} onChange={(url) => setPayForm({ ...payForm, voucher_url: url })} />
          </EntryField>

          <EntryField label="Assign To Admin">
            <Select
              value={payForm.assigned_admin_id?.toString() || "none"}
              onValueChange={(val) => setPayForm({ ...payForm, assigned_admin_id: val === "none" ? "" : val })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select Admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Assigned</SelectItem>
                {approvers.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id.toString()}>
                    {admin.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>

          <p className="text-[10px] text-slate-400">Payment will auto-apply to installments in order.</p>
        </form>
      </EntryDialog>

      {/* ══════ DIALOG: Create Installments ══════ */}
      <Dialog open={instOpen} onOpenChange={setInstOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Installments — {instPlot?.plot_no}</DialogTitle>
            <DialogDescription>{instPlot?.buyer_name} · Sale Price: ₹{fmt(instPlot?.sale_price)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstallments} className="space-y-4">
            <div className="space-y-2">
              {instRows.map((row, i) => (
                <div key={i} className="flex items-end gap-2 bg-slate-50 rounded-lg p-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input
                      value={row.installment_name}
                      onChange={(e) => updateInstRow(i, 'installment_name', e.target.value)}
                      placeholder={`Installment ${i + 1}`}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-xs font-medium">Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={row.amount}
                      onChange={(e) => updateInstRow(i, 'amount', e.target.value)}
                      placeholder="₹0.00"
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs font-medium">Due Date *</Label>
                    <Input
                      type="date"
                      value={row.due_date}
                      onChange={(e) => updateInstRow(i, 'due_date', e.target.value)}
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  {instRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeInstRow(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addInstRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>
            <DialogFooter>
              <Button type="submit" disabled={instSubmitting}>
                {instSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create {instRows.length} Installment{instRows.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Interest Settings ══════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interest Settings — {settingsPlot?.plot_no}</DialogTitle>
            <DialogDescription>Configure overdue interest for this plot</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input
                type="checkbox"
                id="interest_enabled"
                checked={settingsForm.interest_enabled}
                onChange={(e) => setSettingsForm(p => ({ ...p, interest_enabled: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="interest_enabled" className="text-sm cursor-pointer">Enable overdue interest calculation</Label>
            </div>
            {settingsForm.interest_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm.interest_rate}
                    onChange={(e) => setSettingsForm(p => ({ ...p, interest_rate: e.target.value }))}
                    placeholder="e.g. 1.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Period</Label>
                  <Select value={settingsForm.interest_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, interest_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTEREST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={settingsSubmitting}>
                {settingsSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Confirm ══════ */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={executeConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
