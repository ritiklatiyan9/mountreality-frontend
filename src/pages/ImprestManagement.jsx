import { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import UserAvatar from '../components/UserAvatar';
import CreditDebitTabs from '../components/CreditDebitTabs';
import { EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount } from '../components/EntryModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { EmptyState, SkeletonBlock } from '../components/dashboard/primitives';
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
import { Tabs, TabsContent } from '../components/ui/tabs';
import { EmptyBlock, PageHeader, PageTabs, SectionHead, StatusDot } from '../components/ui/page';
import {
  Plus, AlertCircle, Search, Loader2, Check, X, RefreshCw,
  Send, Eye, Clock, CheckCircle2, XCircle, Banknote, Settings2, Undo2,
  UsersRound, ArrowLeftRight, ReceiptText,
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

const getExpenseData = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const WORKSPACE_VIEWS = [
  { id: 'overview', label: 'Balances' },
  { id: 'review', label: 'Approvals' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'requests', label: 'Requests' },
  { id: 'returns', label: 'Returns' },
];

const STATUS_CONFIG = {
  PENDING_RECEIPT: { label: 'Pending Receipt', icon: Clock, tone: 'attention' },
  RECEIVED: { label: 'Received', icon: CheckCircle2, tone: 'positive' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, tone: 'negative' },
  PENDING: { label: 'Pending', icon: Clock, tone: 'attention' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, tone: 'positive' },
  REJECTED: { label: 'Rejected', icon: XCircle, tone: 'negative' },
  ACCEPTED: { label: 'Accepted', icon: CheckCircle2, tone: 'positive' },
};

const STATUS_TONES = {
  PENDING_RECEIPT: 'attention', RECEIVED: 'positive', CANCELLED: 'negative',
  PENDING: 'attention', APPROVED: 'positive', REJECTED: 'negative', ACCEPTED: 'positive',
};

const ImprestManagement = () => {
  const { currentSite, isAdmin } = useAuth();

  // ── State ──
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

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

  const reviewQueue = useMemo(() => ([
    ...expenseRequests
      .filter((request) => request.status === 'PENDING')
      .map((request) => ({ ...request, queueType: 'request', queueDate: request.created_at })),
    ...returns
      .filter((returnRecord) => returnRecord.status === 'PENDING')
      .map((returnRecord) => ({ ...returnRecord, queueType: 'return', queueDate: returnRecord.created_at })),
    ...allocations
      .filter((allocation) => allocation.status === 'PENDING_RECEIPT')
      .map((allocation) => ({ ...allocation, queueType: 'receipt', queueDate: allocation.created_at })),
  ]).sort((a, b) => new Date(a.queueDate) - new Date(b.queueDate)), [allocations, expenseRequests, returns]);

  const metrics = useMemo(() => ([
    { label: 'Available balance', value: formatCurrency(stats.totalAllocated), hint: `${balances.length} accounts` },
    { label: 'Overdraft', value: formatCurrency(stats.totalOverdraft), hint: 'Balances below zero' },
    { label: 'Pending items', value: reviewQueue.length.toLocaleString('en-IN'), hint: 'Needs your review', tab: 'review' },
  ]), [balances.length, reviewQueue.length, stats.totalAllocated, stats.totalOverdraft]);

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
    if (!deferredSearchQuery) return balances;
    const q = deferredSearchQuery.toLowerCase();
    return balances.filter(b => b.name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q));
  }, [balances, deferredSearchQuery]);

  const filteredAllocations = useMemo(() => {
    if (!deferredSearchQuery) return allocations;
    const q = deferredSearchQuery.toLowerCase();
    return allocations.filter(a =>
      a.sub_admin_name?.toLowerCase().includes(q) || a.remark?.toLowerCase().includes(q)
    );
  }, [allocations, deferredSearchQuery]);

  const filteredRequests = useMemo(() => {
    if (!deferredSearchQuery) return expenseRequests;
    const q = deferredSearchQuery.toLowerCase();
    return expenseRequests.filter((request) => `${request.sub_admin_name || ''} ${request.reason || ''} ${request.assigned_admin_name || ''}`.toLowerCase().includes(q));
  }, [expenseRequests, deferredSearchQuery]);

  const filteredReturns = useMemo(() => {
    if (!deferredSearchQuery) return returns;
    const q = deferredSearchQuery.toLowerCase();
    return returns.filter((returnRecord) => `${returnRecord.sub_admin_name || ''} ${returnRecord.reason || ''} ${returnRecord.payment_mode || ''}`.toLowerCase().includes(q));
  }, [returns, deferredSearchQuery]);

  const filteredReviewQueue = useMemo(() => {
    if (!deferredSearchQuery) return reviewQueue;
    const q = deferredSearchQuery.toLowerCase();
    return reviewQueue.filter((item) => `${item.sub_admin_name || ''} ${item.reason || ''} ${item.remark || ''} ${item.admin_name || ''}`.toLowerCase().includes(q));
  }, [deferredSearchQuery, reviewQueue]);

  const StatusMark = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    return <StatusDot tone={STATUS_TONES[status] || 'neutral'}>{cfg.label}</StatusDot>;
  };

  // No site picked yet — avoid loading indefinitely or showing cross-site data.
  if (!currentSite?.id) {
    return (
      <div className="mx-auto max-w-lg rounded-[28px] border border-dashed border-mr-line bg-mr-surface-2 py-6">
        <EmptyState
          icon={Banknote}
          title="Select a site to continue"
          description="Pick a site from the sidebar to manage imprest allocations, requests and returns for that site."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <PageHeader
        title="Imprest Management"
        description={`Balances, allocations, requests and returns · ${currentSite?.name || 'Selected Site'}`}
        actions={(
          <>
            <Button variant="outline" size="icon" onClick={loadData} title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => setAllocateModal(true)}><Plus className="mr-2 h-4 w-4" />Allocate imprest</Button>
          </>
        )}
      />
      <PageTabs items={WORKSPACE_VIEWS} value={activeTab} onChange={setActiveTab} label="Imprest Management sections" />

      {/* ── Message ── */}
      {message.text && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'error' ? 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink' : 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {activeTab === 'overview' && (
        <section className="grid gap-y-4 border-y border-mr-line py-4 sm:grid-cols-3" aria-label="Imprest summary">
          {metrics.map((metric, index) => {
            const content = <><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{metric.label}</p><p className="mt-1 truncate text-[19px] font-semibold tracking-[-0.02em] text-mr-text tabular-nums">{metric.value}</p><p className="mt-1 text-[12px] text-mr-muted">{metric.hint}</p></>;
            return metric.tab ? <button key={metric.label} type="button" onClick={() => setActiveTab(metric.tab)} className={`${index ? 'border-l border-mr-line pl-5' : ''} min-w-0 text-left transition-colors hover:text-mr-blue`}>{content}</button> : <div key={metric.label} className={index ? 'min-w-0 border-l border-mr-line pl-5' : 'min-w-0'}>{content}</div>;
          })}
        </section>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="overview" className="mt-0">
          <section>
            <SectionHead title="Sub-admin balances" meta={`${balances.length} accounts`} actions={<div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setAdjustModal(true)}><Settings2 className="mr-1.5 h-3.5 w-3.5" />Adjust</Button><div className="relative w-[250px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input placeholder="Search balances…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" /></div></div>} />
            {!filteredBalances.length ? <EmptyBlock icon={UsersRound} title="No sub-admins found" description="Try changing the search or add a sub-admin to begin allocating imprest." tall /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Sub-admin</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead>Last activity</TableHead><TableHead className="w-28" /></TableRow></TableHeader><TableBody>{filteredBalances.map((balance) => <TableRow key={balance.user_id}><TableCell className="font-medium">{balance.name}</TableCell><TableCell className="text-mr-muted">{balance.email}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${Number(balance.balance) < 0 ? 'text-mr-coral-ink' : 'text-mr-lime-ink'}`}>{formatCurrency(balance.balance)}</TableCell><TableCell className="text-right tabular-nums text-mr-muted">{balance.total_transactions}</TableCell><TableCell className="text-mr-muted">{balance.last_transaction_at ? fmtDate(balance.last_transaction_at) : '—'}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => { setAllocForm((form) => ({ ...form, sub_admin_id: String(balance.user_id) })); setAllocateModal(true); }}><Plus className="mr-1 h-3.5 w-3.5" />Allocate</Button></TableCell></TableRow>)}</TableBody></Table></div>}
          </section>
        </TabsContent>

        <TabsContent value="review" className="mt-0">
          <section>
            <SectionHead title="Review queue" meta={`${reviewQueue.length} pending`} description="Oldest items appear first, so no approval or confirmation is missed." actions={<div className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input placeholder="Search the review queue…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" /></div>} />
            {!filteredReviewQueue.length ? <EmptyBlock icon={CheckCircle2} title={reviewQueue.length ? 'No matching queue items' : 'Your queue is clear'} description={reviewQueue.length ? 'Try a different search.' : 'New fund requests, returns and receipt confirmations will appear here.'} tall /> : <div className="divide-y divide-mr-line">{filteredReviewQueue.map((item) => { const isRequest = item.queueType === 'request'; const isReturn = item.queueType === 'return'; const Icon = isRequest ? ReceiptText : isReturn ? Undo2 : ArrowLeftRight; const title = isRequest ? 'Fund request' : isReturn ? 'Return request' : 'Receipt confirmation'; return <article key={`${item.queueType}-${item.id}`} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-surface-2 text-mr-muted"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-medium text-mr-text">{title} · {item.sub_admin_name || 'Sub-admin'}</p><StatusMark status={isRequest || isReturn ? item.status : 'PENDING_RECEIPT'} /></div><p className="mt-0.5 truncate text-[12px] text-mr-muted">{isRequest || isReturn ? item.reason || 'No reason provided' : `Sent by ${item.admin_name || 'Admin'} · awaiting recipient confirmation`} · {fmtDate(item.created_at)}</p></div></div><div className="flex items-center gap-2 self-end lg:self-auto"><span className="mr-1 text-[14px] font-semibold tabular-nums text-mr-text">{formatCurrency(item.amount)}</span>{isRequest && <><Button variant="outline" size="sm" onClick={() => setDetailModal({ open: true, request: item })}><Eye className="mr-1.5 h-3.5 w-3.5" />Details</Button><Button size="sm" onClick={() => setConfirmDialog({ open: true, type: 'approve', item })}><Check className="mr-1.5 h-3.5 w-3.5" />Approve</Button></>}{isReturn && <Button size="sm" onClick={() => setReturnConfirmDialog({ open: true, type: 'accept', item, remark: '' })}><Check className="mr-1.5 h-3.5 w-3.5" />Accept</Button>}{!isRequest && !isReturn && <Button variant="outline" size="sm" onClick={() => setActiveTab('allocations')}>Open allocations</Button>}</div></article>; })}</div>}
          </section>
        </TabsContent>

        <TabsContent value="allocations" className="mt-0">
          <section>
            <SectionHead title="Allocations" meta={`${allocations.length} records`} description="Every imprest issue, its recipient, confirmation and ownership." actions={<div className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input placeholder="Search recipient or remark…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" /></div>} />
            {!filteredAllocations.length ? <EmptyBlock icon={ArrowLeftRight} title="No allocations found" description="Allocated imprest will appear here." tall /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Sub-admin</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Remark</TableHead><TableHead>Assigned to</TableHead><TableHead>Status</TableHead><TableHead>Receipt confirmed</TableHead><TableHead>Created by</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>{filteredAllocations.map((allocation) => <TableRow key={allocation.id}><TableCell className="text-mr-muted">{fmtDate(allocation.created_at)}</TableCell><TableCell className="font-medium">{allocation.sub_admin_name}</TableCell><TableCell className="text-right font-semibold tabular-nums text-mr-lime-ink">{formatCurrency(allocation.amount)}</TableCell><TableCell className="max-w-[240px] truncate text-mr-muted">{allocation.remark || '—'}</TableCell><TableCell>{allocation.assigned_admin_name || 'Auto-assigned'}</TableCell><TableCell><StatusMark status={allocation.status} /></TableCell><TableCell className="text-mr-muted">{allocation.confirmed_at ? fmtDate(allocation.confirmed_at) : '—'}</TableCell><TableCell><UserAvatar name={allocation.admin_name} label="Created by" /></TableCell><TableCell>{allocation.status === 'PENDING_RECEIPT' && <Button variant="ghost" size="sm" onClick={() => handleCancelAllocation(allocation.id)} className="text-mr-coral-ink hover:bg-mr-coral-soft hover:text-mr-coral-ink"><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
          </section>
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <section>
            <SectionHead title="Fund requests" meta={`${expenseRequests.length} records`} description="Requests that would place a sub-admin balance into overdraft." actions={<div className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input placeholder="Search request or sub-admin…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" /></div>} />
            {!filteredRequests.length ? <EmptyBlock icon={Send} title="No fund requests found" description="Sub-admin imprest requests will appear here." tall /> : <div className="divide-y divide-mr-line">{filteredRequests.map((request) => { const data = getExpenseData(request.expense_data); const isPending = request.status === 'PENDING'; return <article key={request.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-medium text-mr-text">{request.sub_admin_name || 'Sub-admin'}</p><StatusMark status={request.status} /></div><p className="mt-0.5 text-[12px] text-mr-muted">{request.site_name || currentSite?.name} · {fmtDate(request.created_at)}{request.assigned_admin_name ? ` · Assigned to ${request.assigned_admin_name}` : ''}</p>{(request.reason || data.remark) && <p className="mt-2 text-[13px] text-mr-text">{request.reason || data.remark}</p>}</div><div className="flex items-center gap-2 self-end lg:self-auto"><span className="mr-1 text-[14px] font-semibold tabular-nums text-mr-text">{formatCurrency(request.amount)}</span>{isPending && <><Button variant="outline" size="sm" onClick={() => setDetailModal({ open: true, request })}><Eye className="mr-1.5 h-3.5 w-3.5" />Details</Button><Button size="sm" onClick={() => setConfirmDialog({ open: true, type: 'approve', item: request })}><Check className="mr-1.5 h-3.5 w-3.5" />Approve</Button><Button variant="destructive" size="sm" onClick={() => setConfirmDialog({ open: true, type: 'reject', item: request })}><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button></>}</div></article>; })}</div>}
          </section>
        </TabsContent>

        <TabsContent value="returns" className="mt-0">
          <section>
            <SectionHead title="Returns" meta={`${returns.length} records`} description="Returned imprest awaiting acceptance or previous review decisions." actions={<div className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" /><Input placeholder="Search return or sub-admin…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" /></div>} />
            {!filteredReturns.length ? <EmptyBlock icon={Undo2} title="No returns found" description="Sub-admin return requests will appear here." tall /> : <div className="divide-y divide-mr-line">{filteredReturns.map((returnItem) => { const isPending = returnItem.status === 'PENDING'; return <article key={returnItem.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-medium text-mr-text">{returnItem.sub_admin_name || 'Sub-admin'}</p><StatusMark status={returnItem.status} /></div><p className="mt-0.5 text-[12px] text-mr-muted">{fmtDate(returnItem.created_at)}{returnItem.payment_mode ? ` · ${returnItem.payment_mode}` : ''}</p>{returnItem.reason && <p className="mt-2 text-[13px] text-mr-text">{returnItem.reason}</p>}{!isPending && returnItem.review_remark && <p className="mt-1 text-[12px] text-mr-muted">Review note: {returnItem.review_remark}</p>}</div><div className="flex items-center gap-2 self-end lg:self-auto"><span className="mr-1 text-[14px] font-semibold tabular-nums text-mr-text">{formatCurrency(returnItem.amount)}</span>{isPending && <><Button size="sm" onClick={() => setReturnConfirmDialog({ open: true, type: 'accept', item: returnItem, remark: '' })}><Check className="mr-1.5 h-3.5 w-3.5" />Accept</Button><Button variant="destructive" size="sm" onClick={() => setReturnConfirmDialog({ open: true, type: 'reject', item: returnItem, remark: '' })}><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button></>}</div></article>; })}</div>}
          </section>
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
            const data = getExpenseData(r.expense_data);
            return (
              <div className="space-y-3 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-mr-faint">Sub-Admin:</span> <span className="font-medium">{r.sub_admin_name}</span></div>
                  <div><span className="text-mr-faint">Site:</span> <span className="font-medium">{r.site_name}</span></div>
                  <div><span className="text-mr-faint">Amount:</span> <span className="font-semibold text-mr-text">{formatCurrency(r.amount)}</span></div>
                  <div><span className="text-mr-faint">Date:</span> <span>{fmtDate(data?.date)}</span></div>
                  <div><span className="text-mr-faint">Category:</span> <span>{data?.category || '—'}</span></div>
                  <div><span className="text-mr-faint">Payment Mode:</span> <span>{data?.payment_mode || '—'}</span></div>
                  <div><span className="text-mr-faint">To:</span> <span>{data?.to_entity || '—'}</span></div>
                  <div><span className="text-mr-faint">From:</span> <span>{data?.from_entity || '—'}</span></div>
                </div>
                <Separator />
                <div><span className="text-mr-faint">Reason:</span> <span>{r.reason || '—'}</span></div>
                <div><span className="text-mr-faint">Remark:</span> <span>{data?.remark || '—'}</span></div>
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
                <span className="text-mr-faint">Amount: </span>
                <span className="font-semibold">{formatCurrency(confirmDialog.item.amount)}</span>
                <span className="text-mr-faint ml-3">by </span>
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
