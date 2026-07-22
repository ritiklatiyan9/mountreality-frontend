import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
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
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '../components/ui/pagination';
import {
  EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips,
} from '../components/EntryModal';
import {
  Plus, AlertCircle, Check, Search, Loader2, IndianRupee, Wallet,
  ArrowUpRight, ArrowDownRight, RefreshCw, Send, Clock, CheckCircle2,
  XCircle, AlertTriangle, Banknote, History, Undo2, Settings,
} from 'lucide-react';

// ── Constants ──
const PAYMENT_MODE_OPTIONS = [
  'CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST',
];

const CATEGORY_OPTIONS = [
  'CONSTRUCTION', 'MATERIAL', 'LABOUR', 'TRANSPORT', 'OFFICE', 'SALARY',
  'BROKERAGE', 'LEGAL', 'MAINTENANCE', 'UTILITIES', 'MISC',
  'CEMENT', 'SAND', 'STEEL', 'BRICKS', 'PLUMBING', 'ELECTRICAL',
  'PAINTING', 'FLOORING', 'TILES', 'WOOD', 'HARDWARE', 'CARPENTRY',
  'WELDING', 'FABRICATION', 'GLASS', 'ALUMINIUM', 'ROOFING',
  'ADVANCE', 'DEPOSIT', 'REFUND', 'LOAN', 'EMI', 'INTEREST',
  'COMMISSION', 'MARKETING', 'PETROL', 'DIESEL', 'FOOD', 'STATIONERY',
  'MACHINERY', 'EQUIPMENT', 'VEHICLE', 'FURNITURE', 'MISCELLANEOUS',
];

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

const getAssignedAdminLabel = (entry, approversArray) => {
  if (entry?.assigned_admin_name) return entry.assigned_admin_name;
  const assignedId = entry?.assigned_admin_id;
  if (!assignedId) return null;
  const approver = approversArray.find((a) => String(a.id) === String(assignedId));
  return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
};

const TYPE_CONFIG = {
  ALLOCATION: { label: 'Allocation', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ArrowUpRight },
  EXPENSE: { label: 'Expense', className: 'bg-red-50 text-red-700 border-red-200', icon: ArrowDownRight },
  ADJUSTMENT: { label: 'Adjustment', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: RefreshCw },
  REFUND: { label: 'Refund', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: ArrowUpRight },
};

const REQUEST_STATUS = {
  PENDING: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
  ACCEPTED: { label: 'Accepted', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ImprestDashboard = () => {
  const navigate = useNavigate();
  const { currentSite, isAdmin, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('imprest', 'write');
  const canUpdate = hasPermission('imprest', 'update');

  // ── Ledger row selection (print-only bulk action) ──
  const ledgerSelection = useRowSelection();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('ledger');

  // Data
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [approvers, setApprovers] = useState([]);

  // Modals
  const [expenseModal, setExpenseModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState({ open: false, allocation: null });
  const [zeroBalanceModal, setZeroBalanceModal] = useState(false);
  const [requestModal, setRequestModal] = useState(false);
  const [imprestRequestModal, setImprestRequestModal] = useState(false);
  const [imprestRequestForm, setImprestRequestForm] = useState({ amount: '', reason: '', assigned_admin_id: null });
  const [returnModal, setReturnModal] = useState(false);

  // Expense form
  const emptyExpense = {
    date: toLocal(new Date()), from_entity: '', to_entity: '',
    payment_mode: '', debit: '', credit: '0', remark: '',
    account_no: '', branch: '', category: '',
    assigned_admin_id: null,
  };
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [confirmationRemark, setConfirmationRemark] = useState('');
  const [requestReason, setRequestReason] = useState('');

  // Return money form
  const [returnForm, setReturnForm] = useState({ amount: '', reason: '', payment_mode: 'CASH', assigned_admin_id: null });
  const [myReturns, setMyReturns] = useState([]);

  // Peer transfer — sub-admin sends imprest to another user
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ recipient_id: '', amount: '', remark: '' });
  const [peers, setPeers] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const ledgerVisibleIds = useMemo(() => ledger.map((e) => e.id), [ledger]);

  // ── Load data ──
  const loadData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const siteParam = { site_id: siteId };
      const [balRes, ledgerRes, receiptsRes, reqRes, retRes] = await Promise.all([
        api.get('/imprest/balance', { params: siteParam }),
        api.get('/imprest/ledger', { params: { ...siteParam, page: currentPage, limit: itemsPerPage } }),
        api.get('/imprest/pending-receipts', { params: siteParam }),
        api.get('/imprest/expense-requests', { params: siteParam }),
        api.get('/imprest/returns', { params: siteParam }),
      ]);
      setBalance(parseFloat(balRes.data.balance) || 0);
      setLedger(ledgerRes.data.entries || []);

      if (ledgerRes.data.pagination) {
        setTotalItems(ledgerRes.data.pagination.totalItems);
        setTotalPages(ledgerRes.data.pagination.totalPages);
      }

      setMonthly(ledgerRes.data.monthly || []);
      setPendingReceipts(receiptsRes.data.allocations || []);
      setMyRequests(reqRes.data.requests || []);
      setMyReturns(retRes.data.returns || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load imprest data' });
    } finally {
      setLoading(false);
    }
  }, [siteId, currentPage, itemsPerPage]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ── Show receipt modal if pending ──
  useEffect(() => {
    if (canUpdate && pendingReceipts.length > 0 && !receiptModal.open) {
      setReceiptModal({ open: true, allocation: pendingReceipts[0] });
    }
  }, [pendingReceipts, receiptModal.open, canUpdate]);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/admin/approvers?site_id=${siteId}`)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [siteId]);

  useEffect(() => {
    if (!siteId || !canWrite) {
      setPeers([]);
      return;
    }
    api.get('/imprest/peers', { params: { site_id: siteId } })
      .then((res) => setPeers(res.data.peers || []))
      .catch(() => setPeers([]));
  }, [siteId, canWrite]);

  // ── Give Imprest (peer transfer) ──
  const handleGiveImprest = async () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to transfer imprest' });
      return;
    }
    if (!siteId) {
      setMessage({ type: 'error', text: 'Please select a site' });
      return;
    }
    if (!transferForm.recipient_id) {
      setMessage({ type: 'error', text: 'Recipient is required' });
      return;
    }
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) {
      setMessage({ type: 'error', text: 'Amount must be positive' });
      return;
    }
    if (amt > balance) {
      setMessage({ type: 'error', text: `Insufficient balance. You have ${formatCurrency(balance)}` });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/allocations', {
        sub_admin_id: parseInt(transferForm.recipient_id),
        amount: amt,
        remark: transferForm.remark,
        site_id: siteId,
        date: toLocal(new Date()),
      });
      setMessage({ type: 'success', text: 'Transfer created. Waiting for recipient confirmation.' });
      setTransferModal(false);
      setTransferForm({ recipient_id: '', amount: '', remark: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to send imprest' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirm Receipt ──
  const handleConfirmReceipt = async () => {
    if (!canUpdate) {
      setMessage({ type: 'error', text: 'You do not have permission to confirm receipts' });
      return;
    }
    if (!confirmationRemark.trim()) {
      setMessage({ type: 'error', text: 'Confirmation remark is required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/imprest/allocations/${receiptModal.allocation.id}/confirm`, {
        confirmation_remark: confirmationRemark,
        site_id: siteId,
      });
      setMessage({ type: 'success', text: 'Receipt confirmed successfully' });
      setReceiptModal({ open: false, allocation: null });
      setConfirmationRemark('');
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to confirm' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Create Expense from Imprest ──
  const handleCreateExpense = async () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to create imprest expenses' });
      return;
    }
    if (!siteId) {
      setMessage({ type: 'error', text: 'Please select a site' });
      return;
    }
    if (!expenseForm.debit || parseFloat(expenseForm.debit) <= 0) {
      setMessage({ type: 'error', text: 'Amount is required' });
      return;
    }

    // Check balance first
    if (balance <= 0) {
      setExpenseModal(false);
      setZeroBalanceModal(true);
      return;
    }

    if (balance < parseFloat(expenseForm.debit)) {
      setMessage({ type: 'error', text: `Insufficient balance. Available: ${formatCurrency(balance)}` });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/imprest/expense', {
        ...expenseForm,
        date: toLocal(new Date()),
        site_id: siteId,
        assigned_admin_id: expenseForm.assigned_admin_id,
      });
      setMessage({ type: 'success', text: `Expense created. Balance: ${formatCurrency(res.data.balance)}` });
      setExpenseModal(false);
      setExpenseForm(emptyExpense);
      loadData();
    } catch (err) {
      if (err.response?.data?.requires_approval) {
        setExpenseModal(false);
        setZeroBalanceModal(true);
      } else {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create expense' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Request Approval (Overdraft) ──
  const handleRequestApproval = async () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to submit expense requests' });
      return;
    }
    if (!siteId) {
      setMessage({ type: 'error', text: 'Please select a site' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/expense-requests', {
        ...expenseForm,
        date: toLocal(new Date()),
        site_id: siteId,
        amount: expenseForm.debit,
        reason: requestReason,
        assigned_admin_id: expenseForm.assigned_admin_id,
      });
      setMessage({ type: 'success', text: 'Expense request submitted for admin approval' });
      setZeroBalanceModal(false);
      setRequestModal(false);
      setExpenseForm(emptyExpense);
      setRequestReason('');
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit request' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Request Imprest (simple — no expense required) ──
  const handleImprestRequest = async () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to request imprest' });
      return;
    }
    if (!imprestRequestForm.amount || parseFloat(imprestRequestForm.amount) <= 0) {
      setMessage({ type: 'error', text: 'Amount is required' });
      return;
    }
    if (!siteId) {
      setMessage({ type: 'error', text: 'Please select a site' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/expense-requests', {
        site_id: siteId,
        amount: imprestRequestForm.amount,
        reason: imprestRequestForm.reason,
        assigned_admin_id: imprestRequestForm.assigned_admin_id,
        date: toLocal(new Date()),
        request_type: 'IMPREST',
      });
      setMessage({ type: 'success', text: 'Imprest request submitted for admin approval' });
      setImprestRequestModal(false);
      setImprestRequestForm({ amount: '', reason: '', assigned_admin_id: null });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit request' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Return Money to Admin ──
  const handleReturnMoney = async () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to return imprest funds' });
      return;
    }
    if (!returnForm.amount || parseFloat(returnForm.amount) <= 0) {
      setMessage({ type: 'error', text: 'Return amount is required' });
      return;
    }
    if (parseFloat(returnForm.amount) > balance) {
      setMessage({ type: 'error', text: `Cannot return more than your balance (${formatCurrency(balance)})` });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/returns', {
        amount: returnForm.amount,
        reason: returnForm.reason,
        payment_mode: returnForm.payment_mode,
        site_id: siteId,
        assigned_admin_id: returnForm.assigned_admin_id,
      });
      setMessage({ type: 'success', text: 'Return request submitted. Waiting for admin acceptance.' });
      setReturnModal(false);
      setReturnForm({ amount: '', reason: '', payment_mode: 'CASH', assigned_admin_id: null });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit return request' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Add Expense ──
  const handleOpenExpense = () => {
    if (!canWrite) {
      setMessage({ type: 'error', text: 'You do not have permission to create imprest expenses' });
      return;
    }
    if (balance <= 0) {
      setZeroBalanceModal(true);
    } else {
      setExpenseModal(true);
    }
  };

  // ── Print selected ledger entries ──
  // ponytail: prints from the already-loaded `ledger` page only — the list
  // is server-paginated and older pages aren't cached client-side, so
  // entries selected on a different page than the one you're on when you
  // hit Print won't show up. Add a fetch-by-ids call if cross-page print
  // turns out to matter.
  const handlePrintLedger = () => {
    const rows = ledger.filter((e) => ledgerSelection.isSelected(e.id));
    if (rows.length === 0) {
      toast.error('No entries selected to print');
      return;
    }
    const siteName = (currentSite?.name || '').toUpperCase();
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Imprest Ledger - ${currentSite?.name || ''}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1e293b; padding: 8mm; }
    h1 { font-size: 16px; margin-bottom: 2px; }
    p.sub { font-size: 11px; color: #64748b; margin-bottom: 8mm; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f1f5f9; padding: 2mm; text-align: left; border: 1px solid #cbd5e1; }
    td { padding: 2mm; border: 1px solid #e2e8f0; }
    .right { text-align: right; }
  </style>
</head>
<body>
  <h1>Imprest Ledger — ${siteName}</h1>
  <p class="sub">${rows.length} selected entr${rows.length === 1 ? 'y' : 'ies'} &middot; Generated ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Reference</th>
        <th class="right">Amount</th>
        <th class="right">Balance After</th>
        <th>Assigned To</th>
        <th>Created By</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((entry) => `
        <tr>
          <td>${fmtDate(entry.created_at)}</td>
          <td>${TYPE_CONFIG[entry.type]?.label || entry.type}</td>
          <td>${entry.reference_id ? `#${entry.reference_id}` : '—'}</td>
          <td class="right">${parseFloat(entry.amount) >= 0 ? '+' : ''}${formatCurrency(entry.amount)}</td>
          <td class="right">${formatCurrency(entry.balance_after)}</td>
          <td>${getAssignedAdminLabel(entry, approvers) || '—'}</td>
          <td>${entry.created_by_name || '—'}</td>
          <td>${entry.remarks || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup blocked — allow popups for this site to print');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const TypeBadge = ({ type }) => {
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.ADJUSTMENT;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  const RequestStatusBadge = ({ status }) => {
    const cfg = REQUEST_STATUS[status] || REQUEST_STATUS.PENDING;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  // No site picked yet — show a gentle empty state instead of loading forever
  // or silently showing stale cross-site data.
  if (!siteId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Wallet className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Select a site</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Pick a site from the sidebar to view imprest balance, ledger and requests scoped to that site.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Imprest Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentSite?.name ? (
              <>
                Petty cash &amp; expenses for <span className="font-medium text-slate-700">{currentSite.name}</span>
              </>
            ) : (
              'Manage your petty cash and expenses'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkActionsBar
            count={ledgerSelection.count}
            onClear={ledgerSelection.clear}
            onPrint={handlePrintLedger}
            entityLabel="entry"
          />
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {canWrite && (
            <Button size="sm" onClick={handleOpenExpense} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </Button>
          )}
          {canWrite && balance > 0 && (
            <Button variant="outline" size="sm" onClick={() => setReturnModal(true)} className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
              <Undo2 className="w-3.5 h-3.5" /> Return Money
            </Button>
          )}
          {canWrite && balance > 0 && (
            <Button variant="outline" size="sm" onClick={() => setTransferModal(true)} className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <ArrowUpRight className="w-3.5 h-3.5" /> Give Imprest
            </Button>
          )}
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setImprestRequestModal(true)} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Request Imprest
            </Button>
          )}
        </div>
      </div>

      {/* ── Admin Management Banner ── */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-linear-to-r from-slate-900 to-slate-700 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Admin Panel</p>
              <p className="text-[11px] text-slate-300">Manage allocations, requests &amp; returns across all sub-admins</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/imprest-management')}
            className="bg-white text-slate-900 hover:bg-slate-100 shrink-0 gap-1.5 font-semibold"
          >
            <Settings className="w-3.5 h-3.5" /> Open Management
          </Button>
        </div>
      )}

      {/* ── Message ── */}
      {message.text && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* ── Pending Receipt Banner ── */}
      {pendingReceipts.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              You have {pendingReceipts.length} pending imprest allocation(s)
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {canUpdate ? 'Please confirm receipt to update your balance' : 'Update permission is required to confirm receipt'}
            </p>
          </div>
          {canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReceiptModal({ open: true, allocation: pendingReceipts[0] })}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Confirm Now
            </Button>
          )}
        </div>
      )}

      {/* ── Balance Hero + Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main balance card */}
        <div className={`lg:col-span-1 rounded-2xl border p-5 flex flex-col justify-between min-h-35 ${
          balance < 0
            ? 'bg-linear-to-br from-red-50 to-rose-50 border-red-200'
            : balance === 0
              ? 'bg-linear-to-br from-amber-50 to-yellow-50 border-amber-200'
              : 'bg-linear-to-br from-emerald-50 to-teal-50 border-emerald-200'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Current Balance</p>
              <p className={`text-4xl font-bold tabular-nums ${balance < 0 ? 'text-red-600' : balance === 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {formatCurrency(balance)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              balance < 0 ? 'bg-red-100' : balance === 0 ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <Wallet className={`w-6 h-6 ${balance < 0 ? 'text-red-600' : balance === 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {balance < 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-medium border border-red-200">
                <AlertTriangle className="w-3 h-3" /> Overdraft
              </span>
            )}
            {balance === 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium border border-amber-200">
                <AlertCircle className="w-3 h-3" /> Zero balance
              </span>
            )}
            {myRequests.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-medium border border-violet-200">
                <Clock className="w-3 h-3" /> {myRequests.filter(r => r.status === 'PENDING').length} request(s) pending
              </span>
            )}
          </div>
        </div>

        {/* Received card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Received</p>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <ArrowUpRight className="w-4.5 h-4.5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(ledger.filter(e => parseFloat(e.amount) > 0).reduce((s, e) => s + parseFloat(e.amount), 0))}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">{ledger.filter(e => parseFloat(e.amount) > 0).length} allocation{ledger.filter(e => parseFloat(e.amount) > 0).length !== 1 ? 's' : ''}</p>
        </div>

        {/* Spent card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Spent</p>
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <ArrowDownRight className="w-4.5 h-4.5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(Math.abs(ledger.filter(e => parseFloat(e.amount) < 0).reduce((s, e) => s + parseFloat(e.amount), 0)))}
          </p>
          <p className="text-xs text-slate-400 mt-1.5">{ledger.filter(e => parseFloat(e.amount) < 0).length} expense{ledger.filter(e => parseFloat(e.amount) < 0).length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Tabs: Ledger / Monthly / Requests / Returns ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ledger" className="gap-1.5"><History className="w-3.5 h-3.5" /> Transaction History</TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5"><Banknote className="w-3.5 h-3.5" /> Monthly Summary</TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5"><Send className="w-3.5 h-3.5" /> My Requests</TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5">
            <Undo2 className="w-3.5 h-3.5" /> My Returns
            {myReturns.filter(r => r.status === 'PENDING').length > 0 && (
              <Badge className="ml-1 bg-purple-100 text-purple-700 text-[10px] px-1.5">
                {myReturns.filter(r => r.status === 'PENDING').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Ledger ── */}
        <TabsContent value="ledger" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          ledgerSelection.isAllSelected(ledgerVisibleIds)
                            ? true
                            : ledgerSelection.count > 0 && ledgerVisibleIds.some((id) => ledgerSelection.isSelected(id))
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={() => ledgerSelection.toggleAll(ledgerVisibleIds)}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-sm text-slate-400">
                        No transactions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={ledgerSelection.isSelected(entry.id)}
                            onCheckedChange={() => ledgerSelection.toggle(entry.id)}
                            aria-label="Select row"
                          />
                        </TableCell>
                        <TableCell className="text-sm">{fmtDate(entry.created_at)}</TableCell>
                        <TableCell><TypeBadge type={entry.type} /></TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {entry.reference_id ? `#${entry.reference_id}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-semibold text-sm ${parseFloat(entry.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {parseFloat(entry.amount) >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium ${parseFloat(entry.balance_after) < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {formatCurrency(entry.balance_after)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(() => {
                            const label = getAssignedAdminLabel(entry, approvers);
                            return label ? (
                              <Badge className="bg-purple-100 text-purple-700 border-purple-200">{label}</Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          <UserAvatar name={entry.created_by_name} label="Created by" />
                        </TableCell>
                        <TableCell className="text-sm text-slate-500 max-w-[250px] truncate">
                          {entry.remarks || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {totalItems > 0 && (
              <div className="p-4 border-t flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto">
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-xs text-slate-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Pagination className="w-auto mx-0 shrink-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }).map((_, i) => {
                      const p = i + 1;
                      if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={currentPage === p}
                              onClick={() => setCurrentPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (p === currentPage - 2 || p === currentPage + 2) {
                        return <PaginationItem key={`ellipsis-${p}`}><span className="text-slate-400 px-2">...</span></PaginationItem>;
                      }
                      return null;
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Monthly Summary ── */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthly.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">
                        No monthly data
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthly.map((m, idx) => {
                      const net = parseFloat(m.total_credit) - parseFloat(m.total_debit);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-sm">{MONTHS[m.month - 1]} {m.year}</TableCell>
                          <TableCell className="text-right text-sm text-emerald-600 font-medium">{formatCurrency(m.total_credit)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600 font-medium">{formatCurrency(m.total_debit)}</TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(net)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-slate-500">{m.entries}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── My Requests ── */}
        <TabsContent value="requests" className="mt-4">
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                <Send className="w-6 h-6 text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No requests yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Your imprest requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {myRequests.map((r) => {
                const cfg = REQUEST_STATUS[r.status] || REQUEST_STATUS.PENDING;
                const CfgIcon = cfg.icon;
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.className}`}>
                        <CfgIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{formatCurrency(r.amount)}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                            <CfgIcon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</span>
                          {r.site_name && <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{r.site_name}</span>}
                          {r.reason && <span className="text-[11px] text-slate-500 italic truncate max-w-50">{r.reason}</span>}
                        </div>
                        {r.review_remark && (
                          <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                            Admin: {r.review_remark}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── My Returns ── */}
        <TabsContent value="returns" className="mt-4">
          {myReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Undo2 className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No return requests</p>
                <p className="text-xs text-slate-400 mt-0.5">Your return requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {myReturns.map((r) => {
                const cfg = REQUEST_STATUS[r.status] || REQUEST_STATUS.PENDING;
                const CfgIcon = cfg.icon;
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                        <Undo2 className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-purple-700">{formatCurrency(r.amount)}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                            <CfgIcon className="w-3 h-3" /> {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className="text-[11px] text-slate-400">{fmtDate(r.created_at)}</span>
                          {r.payment_mode && <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">{r.payment_mode}</span>}
                          {r.reason && <span className="text-[11px] text-slate-500 italic truncate max-w-50">{r.reason}</span>}
                        </div>
                        {r.review_remark && (
                          <p className="text-[11px] text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                            Admin: {r.review_remark}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════
           MODAL: Receipt Confirmation
         ═══════════════════════════════════════════════ */}
      <Dialog open={canUpdate && receiptModal.open} onOpenChange={(v) => { if (!v && !submitting) setReceiptModal({ open: false, allocation: null }); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" /> Confirm Imprest Receipt
            </DialogTitle>
            <DialogDescription>
              Admin has allocated imprest funds to you. Please confirm receipt.
            </DialogDescription>
          </DialogHeader>
          {receiptModal.allocation && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-bold text-lg text-emerald-700">{formatCurrency(receiptModal.allocation.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">From:</span>
                  <span className="font-medium">{receiptModal.allocation.admin_name}</span>
                </div>
                {receiptModal.allocation.remark && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Admin Remark:</span>
                    <span className="text-slate-700">{receiptModal.allocation.remark}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Date:</span>
                  <span>{fmtDate(receiptModal.allocation.created_at)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirmation Remark *</Label>
                <Textarea
                  value={confirmationRemark}
                  onChange={(e) => setConfirmationRemark(e.target.value)}
                  placeholder="e.g. Received cash in hand"
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptModal({ open: false, allocation: null })} disabled={submitting}>
              Later
            </Button>
            <Button onClick={handleConfirmReceipt} disabled={submitting || !canUpdate} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Add Expense from Imprest
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={canWrite && expenseModal}
        onOpenChange={setExpenseModal}
        title="Add Expense from Imprest"
        description={<>Available balance: <span className="font-semibold text-emerald-600">{formatCurrency(balance)}</span></>}
        footer={(
          <EntryFooter
            onCancel={() => setExpenseModal(false)}
            onSubmit={handleCreateExpense}
            submitLabel="Create Expense"
            submitting={submitting}
            disabled={!canWrite}
          />
        )}
      >
        <EntryRow>
          <EntryField label="Date (Auto Today)">
            <Input type="date" value={toLocal(new Date())} readOnly disabled />
          </EntryField>
          <EntryField label="Payment Mode">
            <EntryModeChips
              value={expenseForm.payment_mode}
              onChange={(v) => setExpenseForm(f => ({ ...f, payment_mode: v }))}
              modes={PAYMENT_MODE_OPTIONS}
            />
          </EntryField>
        </EntryRow>
        <EntryAmount
          direction="debit"
          required
          inputProps={{
            step: '0.01',
            value: expenseForm.debit,
            onChange: (e) => setExpenseForm(f => ({ ...f, debit: e.target.value })),
            placeholder: '0.00',
          }}
        />
        <EntryRow>
          <EntryField label="Category">
            <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        </EntryRow>
        <EntryRow>
          <EntryField label="From">
            <Input
              value={expenseForm.from_entity}
              onChange={(e) => setExpenseForm(f => ({ ...f, from_entity: e.target.value }))}
              placeholder="From entity"
            />
          </EntryField>
          <EntryField label="To">
            <Input
              value={expenseForm.to_entity}
              onChange={(e) => setExpenseForm(f => ({ ...f, to_entity: e.target.value }))}
              placeholder="To entity"
            />
          </EntryField>
        </EntryRow>
        {approvers.length > 0 && (
          <EntryField label="Assign To Admin">
            <Select
              value={expenseForm.assigned_admin_id?.toString() || '_none'}
              onValueChange={(v) => setExpenseForm(f => ({ ...f, assigned_admin_id: v === '_none' ? null : parseInt(v) }))}
            >
              <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                {approvers.map((app) => (
                  <SelectItem key={app.id} value={app.id.toString()}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        )}
        <div className="rounded-lg border border-slate-200 p-3 space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bank Details</p>
          <EntryRow>
            <EntryField label="Account No.">
              <Input
                value={expenseForm.account_no}
                onChange={(e) => setExpenseForm(f => ({ ...f, account_no: e.target.value }))}
                placeholder="Optional"
              />
            </EntryField>
            <EntryField label="Branch">
              <Input
                value={expenseForm.branch}
                onChange={(e) => setExpenseForm(f => ({ ...f, branch: e.target.value }))}
                placeholder="Optional"
              />
            </EntryField>
          </EntryRow>
        </div>
        <EntryField label="Remark">
          <Textarea
            value={expenseForm.remark}
            onChange={(e) => setExpenseForm(f => ({ ...f, remark: e.target.value }))}
            placeholder="Expense description"
            className="text-sm resize-none" rows={2}
          />
        </EntryField>
      </EntryDialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Zero Balance Warning
         ═══════════════════════════════════════════════ */}
      <Dialog open={canWrite && zeroBalanceModal} onOpenChange={setZeroBalanceModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" /> Insufficient Imprest Balance
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
              <p className="text-lg font-semibold text-amber-800 mb-1">
                Your current imprest balance is {formatCurrency(balance)}
              </p>
              <p className="text-sm text-amber-600">
                Please request funds from admin before creating expenses, or request approval for this specific expense.
              </p>
            </div>
            {expenseForm.debit && parseFloat(expenseForm.debit) > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs">Reason for request (optional)</Label>
                <Textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Why is this expense needed?"
                  className="text-sm resize-none" rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setZeroBalanceModal(false); setRequestReason(''); }}>
              Cancel
            </Button>
            {expenseForm.debit && parseFloat(expenseForm.debit) > 0 && (
              <Button onClick={handleRequestApproval} disabled={submitting || !canWrite} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Request Approval
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Request Imprest (simple)
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={canWrite && imprestRequestModal}
        onOpenChange={(open) => { setImprestRequestModal(open); if (!open) setImprestRequestForm({ amount: '', reason: '', assigned_admin_id: null }); }}
        title="Request Imprest"
        description="Request money from admin to your imprest account"
        footer={(
          <EntryFooter
            onCancel={() => { setImprestRequestModal(false); setImprestRequestForm({ amount: '', reason: '', assigned_admin_id: null }); }}
            onSubmit={handleImprestRequest}
            submitLabel="Submit Request"
            submitting={submitting}
            disabled={!canWrite}
          />
        )}
      >
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <span className="text-slate-500">Current Balance: </span>
          <span className={`font-semibold ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
        </div>
        <EntryAmount
          label="Amount Requested (₹)"
          direction="credit"
          required
          inputProps={{
            step: '0.01',
            value: imprestRequestForm.amount,
            onChange: (e) => setImprestRequestForm(f => ({ ...f, amount: e.target.value })),
            placeholder: '0.00',
            autoFocus: true,
          }}
        />
        <EntryField label="Reason" required>
          <Textarea
            value={imprestRequestForm.reason}
            onChange={(e) => setImprestRequestForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Why do you need this imprest?"
            className="text-sm resize-none" rows={2}
          />
        </EntryField>
        {approvers.length > 0 && (
          <EntryField label="Notify Admin">
            <Select
              value={imprestRequestForm.assigned_admin_id ? String(imprestRequestForm.assigned_admin_id) : 'none'}
              onValueChange={(v) => setImprestRequestForm(f => ({ ...f, assigned_admin_id: v === 'none' ? null : parseInt(v) }))}
            >
              <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific admin</SelectItem>
                {approvers.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.full_name || a.name || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        )}
      </EntryDialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Request Refill
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={canWrite && requestModal}
        onOpenChange={setRequestModal}
        title="Request Imprest Refill"
        description="Submit an expense for admin approval when balance is insufficient"
        footer={(
          <EntryFooter
            onCancel={() => { setRequestModal(false); setRequestReason(''); }}
            onSubmit={handleRequestApproval}
            submitLabel="Submit Request"
            submitting={submitting}
            disabled={!canWrite}
          />
        )}
      >
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <span className="text-slate-500">Current Balance: </span>
          <span className={`font-semibold ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
        </div>
        <EntryAmount
          direction="credit"
          required
          inputProps={{
            step: '0.01',
            value: expenseForm.debit,
            onChange: (e) => setExpenseForm(f => ({ ...f, debit: e.target.value })),
            placeholder: '0.00',
          }}
        />
        <EntryRow>
          <EntryField label="Category">
            <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(c => (
                  <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        </EntryRow>
        <EntryField label="Remark">
          <Input
            value={expenseForm.remark}
            onChange={(e) => setExpenseForm(f => ({ ...f, remark: e.target.value }))}
            placeholder="What is this for?"
          />
        </EntryField>
        <EntryField label="Reason for Approval" required>
          <Textarea
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            placeholder="Why is this expense needed?"
            className="text-sm resize-none" rows={2}
          />
        </EntryField>
      </EntryDialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Return Money to Admin
         ═══════════════════════════════════════════════ */}
      <EntryDialog
        open={canWrite && returnModal}
        onOpenChange={setReturnModal}
        title="Return Money to Admin"
        description="Return unused imprest funds. Admin will need to accept the return."
        footer={(
          <EntryFooter
            onCancel={() => { setReturnModal(false); setReturnForm({ amount: '', reason: '', payment_mode: 'CASH', assigned_admin_id: null }); }}
            onSubmit={handleReturnMoney}
            submitLabel="Submit Return"
            submitting={submitting}
            disabled={!canWrite}
          />
        )}
      >
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <span className="text-slate-500">Available Balance: </span>
          <span className={`font-semibold ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
        </div>
        <EntryField label="Payment Mode">
          <EntryModeChips
            value={returnForm.payment_mode}
            onChange={(v) => setReturnForm(f => ({ ...f, payment_mode: v }))}
            modes={PAYMENT_MODE_OPTIONS}
          />
        </EntryField>
        <EntryAmount
          label="Amount to Return (₹)"
          direction="debit"
          required
          inputProps={{
            max: balance,
            step: '0.01',
            value: returnForm.amount,
            onChange: (e) => setReturnForm(f => ({ ...f, amount: e.target.value })),
            placeholder: '0.00',
          }}
        />
        <EntryField label="Reason for Return" required>
          <Textarea
            value={returnForm.reason}
            onChange={(e) => setReturnForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="e.g. Unused funds from petty cash allocation"
            className="text-sm resize-none"
            rows={2}
          />
        </EntryField>
        {approvers.length > 0 && (
          <EntryField label="Return To Admin">
            <Select
              value={returnForm.assigned_admin_id?.toString() || '_none'}
              onValueChange={(v) => setReturnForm(f => ({ ...f, assigned_admin_id: v === '_none' ? null : parseInt(v) }))}
            >
              <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">- Auto-assign -</SelectItem>
                {approvers.map((app) => (
                  <SelectItem key={app.id} value={app.id.toString()}>{app.full_name || app.name || app.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntryField>
        )}
        {returnForm.amount && parseFloat(returnForm.amount) > 0 && parseFloat(returnForm.amount) <= balance && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm border">
            <p className="text-slate-500">After return, your balance will be:</p>
            <p className="font-semibold text-lg text-slate-900">{formatCurrency(balance - parseFloat(returnForm.amount))}</p>
          </div>
        )}
      </EntryDialog>

      {/* ── Give Imprest (Peer Transfer) Modal ── */}
      <EntryDialog
        open={canWrite && transferModal}
        onOpenChange={setTransferModal}
        title="Give Imprest to a Peer"
        description="Transfer imprest to another sub-admin or admin. Funds are locked on your side immediately and released to the recipient when they confirm receipt."
        footer={(
          <EntryFooter
            onCancel={() => { setTransferModal(false); setTransferForm({ recipient_id: '', amount: '', remark: '' }); }}
            onSubmit={handleGiveImprest}
            submitLabel="Send Imprest"
            submitting={submitting}
            disabled={!canWrite || !transferForm.recipient_id || !transferForm.amount}
          />
        )}
      >
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <span className="text-slate-500">Your Available Balance: </span>
          <span className={`font-semibold ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
        </div>
        <EntryAmount
          direction="debit"
          required
          inputProps={{
            max: balance,
            step: '0.01',
            value: transferForm.amount,
            onChange: (e) => setTransferForm((f) => ({ ...f, amount: e.target.value })),
            placeholder: '0.00',
          }}
        />
        <EntryRow>
          <EntryField label="Recipient" required>
            <Select
              value={transferForm.recipient_id || ''}
              onValueChange={(v) => setTransferForm((f) => ({ ...f, recipient_id: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
              <SelectContent>
                {peers.length === 0 ? (
                  <SelectItem value="_none" disabled>No peers available</SelectItem>
                ) : (
                  peers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-sm">
                      {p.name || p.email} · <span className="text-slate-400">{p.role === 'sub_admin' ? 'Sub-Admin' : 'Admin'}</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </EntryField>
        </EntryRow>
        <EntryField label="Remark">
          <Textarea
            value={transferForm.remark}
            onChange={(e) => setTransferForm((f) => ({ ...f, remark: e.target.value }))}
            placeholder="e.g. Site material advance forwarded to peer"
            className="text-sm resize-none"
            rows={2}
          />
        </EntryField>
        {transferForm.amount && parseFloat(transferForm.amount) > 0 && parseFloat(transferForm.amount) <= balance && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm border">
            <p className="text-slate-500">Your balance after transfer:</p>
            <p className="font-semibold text-lg text-slate-900">{formatCurrency(balance - parseFloat(transferForm.amount))}</p>
            <p className="text-[11px] text-slate-400 mt-1">The recipient's balance will update only after they confirm receipt.</p>
          </div>
        )}
      </EntryDialog>
    </div>
  );
};

export default ImprestDashboard;
