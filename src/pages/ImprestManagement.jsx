import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import UserAvatar from '../components/UserAvatar';
import CreditDebitTabs from '../components/CreditDebitTabs';
import { EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount } from '../components/EntryModal';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '../components/ui/tabs';
import {
  Plus, AlertCircle, Search, Loader2, IndianRupee, Wallet,
  Users, ArrowUpRight, ArrowDownRight, Check, X, RefreshCw,
  Send, Eye, Clock, CheckCircle2, XCircle, Banknote, Settings2, Undo2,
} from 'lucide-react';

// ── Helpers ──
const toLocal = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(num);
};

const STATUS_CONFIG = {
  PENDING_RECEIPT: { label: 'Pending Receipt', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED: { label: 'Received', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  ACCEPTED: { label: 'Accepted', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ImprestManagement = () => {
  const { currentSite, isAdmin } = useAuth();

  // ── State ──
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [balances, setBalances] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [expenseRequests, setExpenseRequests] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [approvers, setApprovers] = useState([]);

  // Returns
  const [returns, setReturns] = useState([]);

  // Modals
  const [allocateModal, setAllocateModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, request: null });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', item: null });
  const [returnConfirmDialog, setReturnConfirmDialog] = useState({ open: false, type: '', item: null, remark: '' });

  // Allocation form
  const [allocForm, setAllocForm] = useState({
    sub_admin_id: '', amount: '', remark: '', date: toLocal(new Date()),
    assigned_admin_id: '',
  });

  // Adjustment form
  const [adjustForm, setAdjustForm] = useState({
    user_id: '', amount: '', remarks: '',
  });
  const [adjustDirection, setAdjustDirection] = useState('credit');

  // ── Data loading ──
  const loadData = useCallback(async () => {
    if (!currentSite?.id) return;
    setLoading(true);
    try {
      const siteParam = { site_id: currentSite.id };
      const [balRes, allocRes, reqRes, saRes, appRes, retRes] = await Promise.all([
        api.get('/imprest/all-balances', { params: siteParam }),
        api.get('/imprest/allocations', { params: siteParam }),
        api.get('/imprest/expense-requests', { params: siteParam }),
        api.get('/admin/sub-admins'),
        api.get(`/admin/approvers?site_id=${currentSite.id}`).catch(() => ({ data: { approvers: [] } })),
        api.get('/imprest/returns', { params: siteParam }).catch(() => ({ data: { returns: [] } })),
      ]);
      setBalances(balRes.data.balances || []);
      setAllocations(allocRes.data.allocations || []);
      setExpenseRequests(reqRes.data.requests || []);
      setSubAdmins(saRes.data.subAdmins || []);
      setApprovers(appRes.data.approvers || []);
      setReturns(retRes.data.returns || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [currentSite?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Auto-dismiss messages ──
  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalAllocated = balances.reduce((s, b) => s + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);
    const totalOverdraft = balances.reduce((s, b) => s + (parseFloat(b.balance) < 0 ? Math.abs(parseFloat(b.balance)) : 0), 0);
    const pendingAllocations = allocations.filter(a => a.status === 'PENDING_RECEIPT').length;
    const pendingRequests = expenseRequests.filter(r => r.status === 'PENDING').length;
    const pendingReturns = returns.filter(r => r.status === 'PENDING').length;
    return { totalAllocated, totalOverdraft, pendingAllocations, pendingRequests, pendingReturns };
  }, [balances, allocations, expenseRequests, returns]);

  // ── Allocate Imprest ──
  const handleAllocate = async () => {
    if (!allocForm.sub_admin_id || !allocForm.amount) {
      setMessage({ type: 'error', text: 'Sub-admin and amount are required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/allocations', {
        ...allocForm,
        date: isAdmin ? (allocForm.date || toLocal(new Date())) : toLocal(new Date()),
        site_id: currentSite?.id,
      });
      setMessage({ type: 'success', text: 'Imprest allocated successfully' });
      setAllocateModal(false);
      setAllocForm({ sub_admin_id: '', amount: '', remark: '', date: toLocal(new Date()), assigned_admin_id: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to allocate' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Adjust Balance ──
  const handleAdjust = async () => {
    if (!adjustForm.user_id || adjustForm.amount === '') {
      setMessage({ type: 'error', text: 'User and amount are required' });
      return;
    }
    setSubmitting(true);
    try {
      // ponytail: strip any typed "-" so debit can't double-sign; payload stays a signed string as before
      const amt = String(adjustForm.amount).replace(/^-/, '');
      await api.post('/imprest/adjust', {
        ...adjustForm,
        amount: adjustDirection === 'debit' ? `-${amt}` : amt,
        site_id: currentSite?.id,
      });
      setMessage({ type: 'success', text: 'Balance adjusted successfully' });
      setAdjustModal(false);
      setAdjustForm({ user_id: '', amount: '', remarks: '' });
      setAdjustDirection('credit');
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to adjust' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Allocation ──
  const handleCancelAllocation = async (id) => {
    try {
      await api.delete(`/imprest/allocations/${id}`);
      setMessage({ type: 'success', text: 'Allocation cancelled' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to cancel' });
    }
  };

  // ── Approve/Reject Expense Request ──
  const handleExpenseRequestAction = async (id, action) => {
    setSubmitting(true);
    try {
      await api.put(`/imprest/expense-requests/${id}/${action}`, {
        review_remark: confirmDialog.remark || '',
      });
      setMessage({ type: 'success', text: `Request ${action}d successfully` });
      setConfirmDialog({ open: false, type: '', item: null });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${action}` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Accept / Reject Return ──
  const handleReturnAction = async (id, action) => {
    setSubmitting(true);
    try {
      await api.put(`/imprest/returns/${id}/${action}`, {
        review_remark: returnConfirmDialog.remark || '',
      });
      setMessage({ type: 'success', text: `Return ${action === 'accept' ? 'accepted' : 'rejected'} successfully` });
      setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${action} return` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtered data ──
  const filteredBalances = useMemo(() => {
    if (!searchQuery) return balances;
    const q = searchQuery.toLowerCase();
    return balances.filter(b => b.name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q));
  }, [balances, searchQuery]);

  const filteredAllocations = useMemo(() => {
    if (!searchQuery) return allocations;
    const q = searchQuery.toLowerCase();
    return allocations.filter(a =>
      a.sub_admin_name?.toLowerCase().includes(q) || a.remark?.toLowerCase().includes(q)
    );
  }, [allocations, searchQuery]);

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  // No site picked yet — avoid loading indefinitely or showing cross-site data.
  if (!currentSite?.id) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
          <Banknote className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Select a site to continue</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Pick a site from the sidebar to manage imprest allocations, requests and returns for that site.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white py-24">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* ── Header ── */}
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-900/[0.03] sm:px-7">
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,.16),transparent_65%)]" />
        <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Banknote className="h-5 w-5" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-600">Cash control</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Imprest management</h1><p className="mt-1 text-sm text-slate-500">
            {currentSite?.name ? (
              <>
                Petty-cash operations for <span className="font-semibold text-slate-700">{currentSite.name}</span>
              </>
            ) : (
              'Manage petty cash allocations to sub-admins'
            )}
          </p></div></div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 rounded-full">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdjustModal(true)} className="gap-1.5 rounded-full">
            <Settings2 className="h-3.5 w-3.5" /> Adjust
          </Button>
          <Button size="sm" onClick={() => setAllocateModal(true)} className="gap-1.5 rounded-full bg-amber-600 hover:bg-amber-700">
            <Plus className="h-3.5 w-3.5" /> Allocate imprest
          </Button>
          </div></div>
      </section>

      {/* ── Message ── */}
      {message.text && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <section className="grid overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-b border-slate-100 p-4 sm:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Outstanding</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-950 tabular-nums">{formatCurrency(stats.totalAllocated)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{balances.length} sub-admin{balances.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Overdraft</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-red-600 tabular-nums">{formatCurrency(stats.totalOverdraft)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{balances.filter(b => parseFloat(b.balance) < 0).length} account{balances.filter(b => parseFloat(b.balance) < 0).length !== 1 ? 's' : ''}</p>
        </div>

        <div className="border-b border-slate-100 p-4 sm:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Pending receipts</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-950 tabular-nums">{stats.pendingAllocations}</p>
          <p className="mt-1 text-[11px] text-slate-400">awaiting confirmation</p>
        </div>

        <button
          onClick={() => stats.pendingRequests > 0 && setActiveTab('requests')}
          className={`p-4 text-left transition-colors ${
            stats.pendingRequests > 0
              ? 'bg-violet-50/60 hover:bg-violet-50 cursor-pointer'
              : 'bg-white'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Pending requests</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className={`text-xl font-bold tabular-nums ${stats.pendingRequests > 0 ? 'text-violet-700' : 'text-slate-950'}`}>
            {stats.pendingRequests}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{stats.pendingRequests > 0 ? 'Click to review' : 'no pending'}</p>
        </button>
      </section>

      {/* ── Pending requests alert banner ── */}
      {stats.pendingRequests > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-violet-600 shadow-sm">
            <Send className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800">
              {stats.pendingRequests} imprest request{stats.pendingRequests !== 1 ? 's' : ''} awaiting your approval
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Sub-admins are waiting for funds to continue their work</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab('requests')}
            className="shrink-0 rounded-full border-violet-300 text-violet-700 hover:bg-violet-100"
          >
            Review Now
          </Button>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.02] sm:p-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview" className="shrink-0 rounded-lg text-xs">Sub-admin balances</TabsTrigger>
          <TabsTrigger value="allocations" className="shrink-0 rounded-lg text-xs">Allocations</TabsTrigger>
          <TabsTrigger value="requests">
            Expense Requests
            {stats.pendingRequests > 0 && (
              <Badge className="ml-1.5 bg-red-100 text-red-700 text-[10px] px-1.5">{stats.pendingRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="returns" className="shrink-0 rounded-lg text-xs">
            Returns
            {stats.pendingReturns > 0 && (
              <Badge className="ml-1.5 bg-purple-100 text-purple-700 text-[10px] px-1.5">{stats.pendingReturns}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Search ── */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-slate-200 pl-9 text-sm"
            />
          </div>
        </div>

        {/* ── Tab: Overview ── */}
        <TabsContent value="overview" className="mt-4">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-none">
            <CardContent className="p-0">
              <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 350px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 2px 0 0 #e2e8f0' }}>
                    <tr>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Sub-Admin</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Email</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Balance</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Transactions</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Last Activity</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-sm text-slate-400">
                          No sub-admins found
                        </td>
                      </tr>
                    ) : (
                      filteredBalances.map((b) => (
                        <tr key={b.user_id} className="border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                          <td className="font-medium text-sm sticky left-0 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{b.name}</td>
                          <td className="text-sm text-slate-500 px-3 py-2">{b.email}</td>
                          <td className={`text-right font-semibold text-sm px-3 py-2 ${parseFloat(b.balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(b.balance)}
                          </td>
                          <td className="text-right text-sm text-slate-500 px-3 py-2">{b.total_transactions}</td>
                          <td className="text-xs text-slate-400 px-3 py-2">
                            {b.last_transaction_at ? fmtDate(b.last_transaction_at) : '—'}
                          </td>
                          <td className="text-right px-3 py-2">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => {
                                setAllocForm(f => ({ ...f, sub_admin_id: String(b.user_id) }));
                                setAllocateModal(true);
                              }}
                              className="gap-1 text-xs h-7"
                            >
                              <Plus className="w-3 h-3" /> Allocate
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Allocations ── */}
        <TabsContent value="allocations" className="mt-4">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-none">
            <CardContent className="p-0">
              <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 350px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 2px 0 0 #e2e8f0' }}>
                    <tr>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left">Date</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-24 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Sub-Admin</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Amount</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Remark</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Assigned To</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Status</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Confirmed At</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Created By</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-sm text-slate-400">
                          No allocations yet
                        </td>
                      </tr>
                    ) : (
                      filteredAllocations.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                          <td className="text-sm sticky left-0 z-10 bg-white px-3 py-2">{fmtDate(a.created_at)}</td>
                          <td className="font-medium text-sm sticky left-24 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{a.sub_admin_name}</td>
                          <td className="text-right font-semibold text-sm text-emerald-600 px-3 py-2">
                            {formatCurrency(a.amount)}
                          </td>
                          <td className="text-sm text-slate-500 max-w-[200px] truncate px-3 py-2">{a.remark || '—'}</td>
                          <td className="px-3 py-2">
                            {a.assigned_admin_name ? (
                              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                                {a.assigned_admin_name}
                              </Badge>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                          <td className="text-xs text-slate-400 px-3 py-2">
                            {a.confirmed_at ? fmtDate(a.confirmed_at) : '—'}
                          </td>
                          <td className="text-xs text-slate-600 px-3 py-2">
                            <UserAvatar name={a.admin_name} label="Created by" />
                          </td>
                          <td className="text-right px-3 py-2">
                            {a.status === 'PENDING_RECEIPT' && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleCancelAllocation(a.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                              >
                                <X className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Expense Requests (Overdraft) ── */}
        <TabsContent value="requests" className="mt-4">
          {expenseRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 shadow-sm">
                <Send className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No expense requests</p>
                <p className="text-xs text-slate-400 mt-0.5">Sub-admin imprest requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {expenseRequests.map((r) => {
                const data = typeof r.expense_data === 'string' ? JSON.parse(r.expense_data) : r.expense_data;
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                const CfgIcon = cfg.icon;
                const isPending = r.status === 'PENDING';
                return (
                  <div key={r.id} className={`rounded-2xl border bg-white px-4 py-4 shadow-sm shadow-slate-900/[0.02] transition-colors hover:bg-slate-50/60 ${isPending ? 'border-violet-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPending ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Send className={`w-4.5 h-4.5 ${isPending ? 'text-violet-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{r.sub_admin_name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{r.site_name} · {fmtDate(r.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(r.amount)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                              <CfgIcon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                        </div>
                        {(r.reason || data?.remark) && (
                          <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 italic">
                            {r.reason || data?.remark}
                          </p>
                        )}
                        {r.assigned_admin_name && (
                          <div className="mt-1.5">
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">
                              Assigned: {r.assigned_admin_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 mt-3 ml-13 pl-0.5">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setDetailModal({ open: true, request: r })}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="w-3 h-3" /> Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirmDialog({ open: true, type: 'approve', item: r })}
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs gap-1"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => setConfirmDialog({ open: true, type: 'reject', item: r })}
                          className="h-7 text-xs gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        {/* ── Tab: Returns ── */}
        <TabsContent value="returns" className="mt-4">
          {returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 shadow-sm">
                <Undo2 className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No return requests</p>
                <p className="text-xs text-slate-400 mt-0.5">Sub-admin return requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {returns.map((r) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                const CfgIcon = cfg.icon;
                const isPending = r.status === 'PENDING';
                return (
                  <div key={r.id} className={`rounded-2xl border bg-white px-4 py-4 shadow-sm shadow-slate-900/[0.02] transition-colors hover:bg-slate-50/60 ${isPending ? 'border-purple-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPending ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Undo2 className={`w-4.5 h-4.5 ${isPending ? 'text-purple-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{r.sub_admin_name || '—'}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(r.created_at)}{r.payment_mode ? ` · ${r.payment_mode}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-base font-bold text-purple-700 tabular-nums">{formatCurrency(r.amount)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                              <CfgIcon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                        </div>
                        {r.reason && (
                          <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 italic">{r.reason}</p>
                        )}
                        {!isPending && r.review_remark && (
                          <p className="text-xs text-slate-400 mt-1.5">Admin: {r.review_remark}</p>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => setReturnConfirmDialog({ open: true, type: 'accept', item: r, remark: '' })}
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs gap-1"
                        >
                          <Check className="w-3 h-3" /> Accept Return
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => setReturnConfirmDialog({ open: true, type: 'reject', item: r, remark: '' })}
                          className="h-7 text-xs gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════
           MODAL: Allocate Imprest
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={allocateModal}
        onOpenChange={(v) => { if (!v) setAllocateModal(false); }}
        title="Allocate Imprest"
        description="Allocate petty cash to a sub-admin"
        footer={
          <EntryFooter
            onCancel={() => setAllocateModal(false)}
            onSubmit={handleAllocate}
            submitLabel="Allocate"
            submitting={submitting}
          />
        }
      >
        <EntryRow>
          <EntryField label={isAdmin ? 'Date' : 'Date (Auto)'}>
            <Input
              type="date"
              value={isAdmin ? allocForm.date : toLocal(new Date())}
              onChange={isAdmin ? ((e) => setAllocForm(f => ({ ...f, date: e.target.value }))) : undefined}
              readOnly={!isAdmin}
              disabled={!isAdmin}
            />
          </EntryField>
        </EntryRow>
        <EntryAmount
          direction="credit"
          inputProps={{
            step: '0.01',
            value: allocForm.amount,
            onChange: (e) => setAllocForm(f => ({ ...f, amount: e.target.value })),
            placeholder: '0.00',
          }}
        />
        <EntryRow>
          <EntryField label="Sub-Admin" required>
            <Select value={allocForm.sub_admin_id} onValueChange={(v) => setAllocForm(f => ({ ...f, sub_admin_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select sub-admin" />
              </SelectTrigger>
              <SelectContent>
                {subAdmins.map((sa) => (
                  <SelectItem key={sa.id} value={String(sa.id)} className="text-sm">
                    {sa.name} ({sa.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
          <EntryField label="Assign To Admin">
            <Select
              value={allocForm.assigned_admin_id || "none"}
              onValueChange={(val) => setAllocForm(f => ({ ...f, assigned_admin_id: val === "none" ? "" : val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Auto-assign</SelectItem>
                {approvers.map((admin) => (
                  <SelectItem key={admin.id} value={String(admin.id)}>
                    {admin.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        </EntryRow>
        <EntryField label="Remark">
          <Textarea
            value={allocForm.remark}
            onChange={(e) => setAllocForm(f => ({ ...f, remark: e.target.value }))}
            placeholder="e.g. Monthly petty cash"
            className="text-sm resize-none"
            rows={2}
          />
        </EntryField>
      </EntryDialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Adjust Balance
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={adjustModal}
        onOpenChange={(v) => { if (!v) setAdjustModal(false); }}
        title="Adjust Imprest Balance"
        description="Manually adjust a sub-admin's imprest balance"
        footer={
          <EntryFooter
            onCancel={() => setAdjustModal(false)}
            onSubmit={handleAdjust}
            submitLabel="Adjust"
            submitting={submitting}
          />
        }
      >
        <CreditDebitTabs
          value={adjustDirection}
          onChange={setAdjustDirection}
          creditHint="Add to balance"
          debitHint="Deduct from balance"
        />
        <EntryAmount
          direction={adjustDirection}
          inputProps={{
            step: '0.01',
            value: adjustForm.amount,
            onChange: (e) => setAdjustForm(f => ({ ...f, amount: e.target.value })),
            placeholder: 'Enter amount',
          }}
        />
        <EntryRow>
          <EntryField label="Sub-Admin" required>
            <Select value={adjustForm.user_id} onValueChange={(v) => setAdjustForm(f => ({ ...f, user_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select sub-admin" />
              </SelectTrigger>
              <SelectContent>
                {subAdmins.map((sa) => (
                  <SelectItem key={sa.id} value={String(sa.id)} className="text-sm">
                    {sa.name} ({sa.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        </EntryRow>
        <EntryField label="Remarks">
          <Textarea
            value={adjustForm.remarks}
            onChange={(e) => setAdjustForm(f => ({ ...f, remarks: e.target.value }))}
            placeholder="Reason for adjustment"
            className="text-sm resize-none"
            rows={2}
          />
        </EntryField>
      </EntryDialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Request Detail
         ═══════════════════════════════════════════════ */}
      <Dialog open={detailModal.open} onOpenChange={(v) => setDetailModal({ open: v, request: null })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Expense Request Detail</DialogTitle>
          </DialogHeader>
          {detailModal.request && (() => {
            const r = detailModal.request;
            const data = typeof r.expense_data === 'string' ? JSON.parse(r.expense_data) : r.expense_data;
            return (
              <div className="space-y-3 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-400">Sub-Admin:</span> <span className="font-medium">{r.sub_admin_name}</span></div>
                  <div><span className="text-slate-400">Site:</span> <span className="font-medium">{r.site_name}</span></div>
                  <div><span className="text-slate-400">Amount:</span> <span className="font-semibold text-slate-900">{formatCurrency(r.amount)}</span></div>
                  <div><span className="text-slate-400">Date:</span> <span>{fmtDate(data?.date)}</span></div>
                  <div><span className="text-slate-400">Category:</span> <span>{data?.category || '—'}</span></div>
                  <div><span className="text-slate-400">Payment Mode:</span> <span>{data?.payment_mode || '—'}</span></div>
                  <div><span className="text-slate-400">To:</span> <span>{data?.to_entity || '—'}</span></div>
                  <div><span className="text-slate-400">From:</span> <span>{data?.from_entity || '—'}</span></div>
                </div>
                <Separator />
                <div><span className="text-slate-400">Reason:</span> <span>{r.reason || '—'}</span></div>
                <div><span className="text-slate-400">Remark:</span> <span>{data?.remark || '—'}</span></div>
              </div>
            );
          })()}
          <DialogFooter>
            {detailModal.request?.status === 'PENDING' && (
              <>
                <Button
                  onClick={() => {
                    setDetailModal({ open: false, request: null });
                    setConfirmDialog({ open: true, type: 'approve', item: detailModal.request });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                >
                  <Check className="w-4 h-4" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailModal({ open: false, request: null });
                    setConfirmDialog({ open: true, type: 'reject', item: detailModal.request });
                  }}
                  className="gap-1"
                >
                  <X className="w-4 h-4" /> Reject
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetailModal({ open: false, request: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Confirm Approve/Reject
         ═══════════════════════════════════════════════ */}
      <Dialog open={confirmDialog.open} onOpenChange={(v) => { if (!v) setConfirmDialog({ open: false, type: '', item: null }); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'} Expense Request
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'approve'
                ? 'This will create the expense and record a negative imprest balance (overdraft).'
                : 'This will reject the expense request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {confirmDialog.item && (
              <div className="text-sm">
                <span className="text-slate-400">Amount: </span>
                <span className="font-semibold">{formatCurrency(confirmDialog.item.amount)}</span>
                <span className="text-slate-400 ml-3">by </span>
                <span className="font-medium">{confirmDialog.item.sub_admin_name}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Remark (optional)</Label>
              <Textarea
                value={confirmDialog.remark || ''}
                onChange={(e) => setConfirmDialog(c => ({ ...c, remark: e.target.value }))}
                placeholder="Add a remark..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, type: '', item: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className={confirmDialog.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={confirmDialog.type === 'reject' ? 'destructive' : 'default'}
              onClick={() => handleExpenseRequestAction(confirmDialog.item.id, confirmDialog.type)}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ═══════════════════════════════════════════════
           MODAL: Confirm Accept/Reject Return
         ═══════════════════════════════════════════════ */}
      <Dialog open={returnConfirmDialog.open} onOpenChange={(v) => { if (!v) setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' }); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-purple-600" />
              {returnConfirmDialog.type === 'accept' ? 'Accept' : 'Reject'} Return
            </DialogTitle>
            <DialogDescription>
              {returnConfirmDialog.type === 'accept'
                ? 'Accepting will deduct the amount from the sub-admin\'s imprest balance and record a REFUND ledger entry.'
                : 'This will reject the return request. The sub-admin\'s balance will not change.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {returnConfirmDialog.item && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-sm space-y-1">
                <div><span className="text-purple-500">Sub-Admin: </span><span className="font-medium">{returnConfirmDialog.item.sub_admin_name}</span></div>
                <div><span className="text-purple-500">Amount: </span><span className="font-semibold text-lg">{formatCurrency(returnConfirmDialog.item.amount)}</span></div>
                <div><span className="text-purple-500">Reason: </span><span>{returnConfirmDialog.item.reason || '—'}</span></div>
                <div><span className="text-purple-500">Payment Mode: </span><span>{returnConfirmDialog.item.payment_mode || 'CASH'}</span></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Remark (optional)</Label>
              <Textarea
                value={returnConfirmDialog.remark}
                onChange={(e) => setReturnConfirmDialog(c => ({ ...c, remark: e.target.value }))}
                placeholder="Add a remark..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className={returnConfirmDialog.type === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={returnConfirmDialog.type === 'reject' ? 'destructive' : 'default'}
              onClick={() => handleReturnAction(returnConfirmDialog.item.id, returnConfirmDialog.type)}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {returnConfirmDialog.type === 'accept' ? 'Accept Return' : 'Reject Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImprestManagement;
