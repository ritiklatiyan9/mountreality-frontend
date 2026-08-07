import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import UserAvatar from '../components/UserAvatar';
import CreditDebitTabs from '../components/CreditDebitTabs';
import {
  EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips,
} from '../components/EntryModal';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  IndianRupee,
  User,
  Plus,
  AlertCircle,
  Printer,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Wallet,
  Landmark,
  MapPin,
  Settings2,
  PenLine,
  MoreHorizontal,
  Ruler,
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { printCashReceipt } from '../lib/cashReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn, CUSTOMER_SIGN_CSS } from '../lib/receiptSignature';
import { toast } from 'sonner';
import ChequeStatusControl from '../components/ChequeStatusControl';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import { Checkbox } from '../components/ui/checkbox';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import React from 'react';

// ── Small presentational helpers (module-level so they never re-mount) ──
const initialsOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((w) => w[0].toUpperCase()).join('') : '—';
};

const paymentStatusCls = (status) =>
  status === 'approved'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'rejected'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

// Meta chip with initials avatar + truncation + tooltip for the header band.
const MetaChip = ({ label, value, icon: Icon, tint = 'bg-indigo-100 text-indigo-700' }) => {
  if (!value) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex min-w-0 max-w-[200px] items-center gap-1.5 rounded-full bg-slate-50 py-1 pl-1 pr-2.5 ring-1 ring-slate-200">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${tint}`}>
            {Icon ? <Icon className="h-3 w-3" /> : initialsOf(value)}
          </span>
          <span className="truncate text-[11px] font-medium text-slate-600">
            {label && <span className="text-slate-400">{label} </span>}
            {value}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{label ? `${label}: ${value}` : value}</TooltipContent>
    </Tooltip>
  );
};

const PlotCommissionDetail = () => {
  const { plotId, id } = useParams();
  const [searchParams] = useSearchParams();
  const siteIdParam = searchParams.get('site_id');
  const navigate = useNavigate();
  const { currentSite, canManage, hasPermission, isAdmin, user } = useAuth();
  const canWrite = canManage && hasPermission('commissions', 'write');
  const canUpdate = canManage && hasPermission('commissions', 'update');
  const canDelete = canManage && hasPermission('commissions', 'delete');
  const siteId = siteIdParam || currentSite?.id;
  // If accessed via old route /plot-commission/:id (commission id), we need to resolve plot_id
  const [resolvedPlotId, setResolvedPlotId] = useState(plotId || null);

  // State
  const [data, setData] = useState(null); // { plot, agents, totals, is_resale }
  const [signEntry, setSignEntry] = useState(null); // { payment, agent }
  const [loading, setLoading] = useState(true);
  const [approvers, setApprovers] = useState([]);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentCommissionId, setPaymentCommissionId] = useState(null); // which agent commission to pay
  const [paymentAction, setPaymentAction] = useState('pay'); // pay | get
  const [submitLoading, setSubmitLoading] = useState(false);
  const [overpayConfirmOpen, setOverpayConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'CASH',
    bank_name: '',
    transaction_id: '',
    cheque_no: '',
    remarks: '',
    voucher_url: null,
    assigned_admin_id: null,
  });

  // Edit payment state
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({});
  const [editPaymentLoading, setEditPaymentLoading] = useState(false);

  // Delete payment state
  const [deletePaymentId, setDeletePaymentId] = useState(null);
  const [deletePaymentLoading, setDeletePaymentLoading] = useState(false);

  // Bulk ledger row selection (Ledger tab)
  const ledgerSelection = useRowSelection();
  const [bulkDeletePaymentsLoading, setBulkDeletePaymentsLoading] = useState(false);

  // Edit commission state
  const [editCommission, setEditCommission] = useState(null);
  const [editCommissionForm, setEditCommissionForm] = useState({ total_commission: '', remarks: '' });
  const [editCommissionLoading, setEditCommissionLoading] = useState(false);

  // Delete commission state
  const [deleteCommissionId, setDeleteCommissionId] = useState(null);
  const [deleteCommissionLoading, setDeleteCommissionLoading] = useState(false);

  // Assign new agent state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [assignFormData, setAssignFormData] = useState({ total_commission: '', remarks: '' });

  // Expanded agent sections
  const [expandedAgents, setExpandedAgents] = useState({});

  // Manage-timeline dialog (edit/delete any commission across all sales)
  const [manageOpen, setManageOpen] = useState(false);

  // Agent slide-over sheet (full per-agent ledger). Stores a commission_id;
  // the agent object is resolved from `derived.agentDirectory` so optimistic
  // updates stay live while the sheet is open.
  const [agentSheetId, setAgentSheetId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Watchdog so the page-level spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      let pid = resolvedPlotId;
      // If accessed via old route /plot-commission/:id, resolve the plot_id
      if (!pid && id) {
        const commRes = await api.get(`/plot-commission/${id}`);
        pid = commRes.data.master?.plot_id;
        if (!pid) throw new Error('Could not resolve plot ID');
        setResolvedPlotId(pid);
      }
      if (!pid) throw new Error('No plot ID');
      const res = await api.get(`/plot-commission/plot/${pid}?site_id=${siteId}`);
      clearTimeout(watchdog);
      setData(res.data);
      // Auto-expand all agents
      const expanded = {};
      (res.data.agents || []).forEach(a => { expanded[a.commission_id] = true; });
      (res.data.timeline || []).forEach(t => (t.agents_detail || []).forEach(a => { if (a.commission_id != null) expanded[a.commission_id] = true; }));
      setExpandedAgents(expanded);
    } catch (error) {
      console.error('Failed to fetch plot commission detail:', error);
      toast.error('Failed to load commission details');
      navigate('/plot-commission');
    } finally {
      setLoading(false);
    }
  }, [resolvedPlotId, id, siteId, navigate]);

  // Background refresh — does NOT toggle the page-wide loader. Used after
  // every create / update / delete so dialogs can close instantly while the
  // page reconciles with the server.
  const refreshData = useCallback(async () => {
    try {
      const pid = resolvedPlotId;
      if (!pid) return;
      const res = await api.get(`/plot-commission/plot/${pid}?site_id=${siteId}`);
      setData(res.data);
    } catch { /* keep current data */ }
  }, [resolvedPlotId, siteId]);

  // Keep the resolved plot id in sync with the URL param. Without this, tapping
  // a different booking (same route, new :plotId) reused the stale state and the
  // page kept showing the previous plot's data.
  useEffect(() => {
    if (plotId) setResolvedPlotId(plotId);
  }, [plotId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const url = siteId ? `/admin/approvers?site_id=${siteId}` : '/admin/approvers';
    api.get(url)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [siteId]);

  // Click outside to close agent search dropdown
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isReceiveAmount = (amount) => (parseFloat(amount) || 0) < 0;
  const formatSignedAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return `${num < 0 ? '+' : '-'}₹${formatCurrency(Math.abs(num))}`;
  };

  const toggleAgent = (commissionId) => {
    setExpandedAgents(prev => ({ ...prev, [commissionId]: !prev[commissionId] }));
  };

  // ── Payment Handlers ──
  const openPaymentDialog = (commissionId, action = 'pay') => {
    setPaymentCommissionId(commissionId);
    setPaymentAction(action === 'get' ? 'get' : 'pay');
    setOverpayConfirmOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_mode: 'CASH',
      bank_name: '',
      transaction_id: '',
      cheque_no: '',
      remarks: '',
      voucher_url: null,
      assigned_admin_id: null,
    });
    setPaymentDialogOpen(true);
  };

  // Look an agent up across the current booking's agents AND every previous
  // booking in the timeline — so Pay / Get Money works for old agents too.
  const findAnyAgent = (commissionId) => {
    const current = data?.agents?.find(a => a.commission_id === commissionId);
    if (current) return current;
    for (const t of data?.timeline || []) {
      const found = (t.agents_detail || []).find(a => a.commission_id === commissionId);
      if (found) return found;
    }
    return null;
  };

  const getAgentBalance = (commissionId) => {
    const agent = findAnyAgent(commissionId);
    return agent ? (parseFloat(agent.balance) || 0) : 0;
  };

  const getAgentPaidAll = (commissionId) => {
    const agent = findAnyAgent(commissionId);
    return agent ? (parseFloat(agent.total_paid_all) || 0) : 0;
  };

  const handlePaymentSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      return toast.error('Please enter a valid amount');
    }
    const amountInput = Math.abs(parseFloat(formData.amount));
    const balance = getAgentBalance(paymentCommissionId);
    const paidAll = getAgentPaidAll(paymentCommissionId);

    if (paymentAction === 'pay' && amountInput > balance && !overpayConfirmOpen) {
      setOverpayConfirmOpen(true);
      return;
    }
    if (paymentAction === 'get' && amountInput > paidAll && !overpayConfirmOpen) {
      setOverpayConfirmOpen(true);
      return;
    }
    if (formData.payment_mode === 'BANK' && !formData.bank_name) {
      return toast.error('Bank name is required for BANK payments');
    }

    const signedAmount = paymentAction === 'get' ? -amountInput : amountInput;

    // ── Optimistic UI: splice a temp row into the right agent's payments
    //    array and adjust the agent + plot totals BEFORE the network call.
    //    On failure we restore the snapshot.
    const snapshotData = data;
    const tempId = -Date.now();
    const optimisticPayment = {
      id: tempId,
      plot_commission_id: paymentCommissionId,
      date: formData.date,
      amount: signedAmount,
      payment_mode: formData.payment_mode,
      bank_name: formData.bank_name || null,
      transaction_id: formData.transaction_id || null,
      cheque_no: formData.cheque_no || null,
      remarks: formData.remarks || null,
      voucher_url: formData.voucher_url || null,
      assigned_admin_id: formData.assigned_admin_id || null,
      status: 'pending',
      cheque_status: formData.payment_mode === 'CHEQUE' ? 'PENDING' : null,
      created_at: new Date().toISOString(),
      created_by: user?.id || null,
      created_by_name: user?.full_name || user?.name || null,
    };

    if (data) {
      const nextAgents = data.agents.map((a) => {
        if (a.commission_id !== paymentCommissionId) return a;
        const newPayments = [optimisticPayment, ...(a.payments || [])];
        // Pending entries adjust total_paid_all + balance, not approved-only
        // total_paid (matches server semantics in findAllCommissionsByPlotId).
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) + signedAmount;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return {
          ...a,
          payments: newPayments,
          payment_count: newPayments.length,
          total_paid_all: nextTotalPaidAll,
          balance: nextBalance,
        };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }

    setPaymentDialogOpen(false);
    setOverpayConfirmOpen(false);

    try {
      setSubmitLoading(true);
      await api.post('/plot-commission/payment', {
        master_id: paymentCommissionId,
        ...formData,
        amount: signedAmount,
      });
      toast.success(paymentAction === 'get' ? 'Money received entry recorded' : 'Payment recorded');
      // Reconcile with server (gets canonical id, verifyUrl, fresh status).
      refreshData();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err.response?.data?.message || 'Failed to record payment');
      setData(snapshotData); // rollback
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditPayment = (p) => {
    setEditingPayment(p);
    setEditPaymentForm({
      date: p.date ? p.date.substring(0, 10) : '',
      amount: Math.abs(parseFloat(p.amount) || 0),
      is_receive_entry: isReceiveAmount(p.amount),
      payment_mode: p.payment_mode || 'BANK',
      bank_name: p.bank_name || '',
      transaction_id: p.transaction_id || '',
      cheque_no: p.cheque_no || '',
      remarks: p.remarks || '',
      voucher_url: p.voucher_url || null,
      assigned_admin_id: p.assigned_admin_id || null,
    });
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!editPaymentForm.amount || isNaN(parseFloat(editPaymentForm.amount))) {
      return toast.error('Please enter a valid amount');
    }
    const amountInput = Math.abs(parseFloat(editPaymentForm.amount));
    const signedAmount = editPaymentForm.is_receive_entry ? -amountInput : amountInput;

    // Optimistic in-place update of the payment row + adjust agent totals
    // by the delta (new amount - old amount).
    const snapshotData = data;
    const targetId = editingPayment.id;
    if (data) {
      const nextAgents = data.agents.map((a) => {
        const idx = (a.payments || []).findIndex((p) => p.id === targetId);
        if (idx === -1) return a;
        const oldAmount = parseFloat(a.payments[idx].amount) || 0;
        const delta = signedAmount - oldAmount;
        const newPayments = a.payments.slice();
        newPayments[idx] = {
          ...newPayments[idx],
          ...editPaymentForm,
          amount: signedAmount,
        };
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) + delta;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return { ...a, payments: newPayments, total_paid_all: nextTotalPaidAll, balance: nextBalance };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }
    setEditingPayment(null);

    try {
      setEditPaymentLoading(true);
      await api.put(`/plot-commission/payment/${targetId}`, {
        ...editPaymentForm,
        amount: signedAmount,
      });
      toast.success('Payment updated');
      refreshData(); // reconcile (status flag, approved-only totals)
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update payment');
      setData(snapshotData); // rollback
    } finally {
      setEditPaymentLoading(false);
    }
  };

  const handleDeletePayment = async () => {
    const targetId = deletePaymentId;
    // Optimistic removal — strip the payment from whichever agent owns it.
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.map((a) => {
        const removed = (a.payments || []).find((p) => p.id === targetId);
        if (!removed) return a;
        const removedAmt = parseFloat(removed.amount) || 0;
        const newPayments = a.payments.filter((p) => p.id !== targetId);
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) - removedAmt;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return {
          ...a,
          payments: newPayments,
          payment_count: newPayments.length,
          total_paid_all: nextTotalPaidAll,
          balance: nextBalance,
        };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }
    setDeletePaymentId(null);

    try {
      setDeletePaymentLoading(true);
      await api.delete(`/plot-commission/payment/${targetId}`);
      toast.success('Payment deleted');
      refreshData();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete payment');
      setData(snapshotData); // rollback
    } finally {
      setDeletePaymentLoading(false);
    }
  };

  // Bulk delete ledger rows (payments). No optimistic removal — the endpoint
  // may skip rows (message says so), so we just refetch on success.
  const handleBulkDeletePayments = async () => {
    const ids = [...ledgerSelection.selected];
    if (!ids.length) return;
    try {
      setBulkDeletePaymentsLoading(true);
      const res = await api.post('/plot-commission/payment/bulk-delete', { ids });
      toast.success(res.data?.message || 'Payments deleted');
      ledgerSelection.clear();
      refreshData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete payments');
    } finally {
      setBulkDeletePaymentsLoading(false);
    }
  };

  // ── Edit/Delete Commission Handlers ──
  const handleEditCommissionSubmit = async (e) => {
    e.preventDefault();
    if (!editCommissionForm.total_commission || parseFloat(editCommissionForm.total_commission) <= 0) {
      return toast.error('Please enter a valid commission amount');
    }
    const targetId = editCommission.commission_id;
    const newCommission = parseFloat(editCommissionForm.total_commission);

    // Optimistic update of the agent's total_commission + balance.
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.map((a) =>
        a.commission_id === targetId
          ? {
              ...a,
              total_commission: newCommission,
              remarks: editCommissionForm.remarks || null,
              balance: newCommission - (parseFloat(a.total_paid_all) || 0),
            }
          : a
      );
      // Plot-level totals: recompute fixed plot commission if needed.
      setData({ ...data, agents: nextAgents });
    }
    setEditCommission(null);

    try {
      setEditCommissionLoading(true);
      await api.put(`/plot-commission/${targetId}`, editCommissionForm);
      toast.success('Commission updated');
      refreshData();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update');
      setData(snapshotData); // rollback
    } finally {
      setEditCommissionLoading(false);
    }
  };

  const handleDeleteCommission = async () => {
    const targetId = deleteCommissionId;
    // Optimistic removal of the agent (and their payments).
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.filter((a) => a.commission_id !== targetId);
      setData({ ...data, agents: nextAgents });
    }
    setDeleteCommissionId(null);

    try {
      setDeleteCommissionLoading(true);
      await api.delete(`/plot-commission/${targetId}`);
      toast.success('Commission deleted');
      refreshData();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete');
      setData(snapshotData); // rollback
    } finally {
      setDeleteCommissionLoading(false);
    }
  };

  // ── Assign New Agent Handlers ──
  const searchClients = useCallback(async (query) => {
    if (!siteId || !query || query.length < 1) {
      setClientResults([]);
      return;
    }
    try {
      setClientLoading(true);
      const res = await api.get(`/members/search?site_id=${siteId}&q=${encodeURIComponent(query)}`);
      setClientResults(res.data.members || []);
    } catch {
      setClientResults([]);
    } finally {
      setClientLoading(false);
    }
  }, [siteId]);

  const handleClientQueryChange = (e) => {
    const val = e.target.value;
    setClientQuery(val);
    setShowDropdown(true);
    if (selectedClient) {
      setSelectedClient(null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(val), 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientQuery(client.full_name);
    setShowDropdown(false);
    setClientResults([]);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    inputRef.current?.focus();
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return toast.error('Please select an agent');
    if (!assignFormData.total_commission || parseFloat(assignFormData.total_commission) <= 0) {
      return toast.error('Please enter a valid commission amount');
    }
    // Close dialog first — server returns the canonical commission and we
    // use refreshData to bring it into the list.
    const agent = selectedClient;
    const totalComm = parseFloat(assignFormData.total_commission);
    const memo = assignFormData.remarks;

    setAssignDialogOpen(false);
    setSelectedClient(null);
    setClientQuery('');
    setAssignFormData({ total_commission: '', remarks: '' });

    try {
      setAssignLoading(true);
      await api.post('/plot-commission/create', {
        site_id: siteId,
        plot_id: resolvedPlotId,
        agent_id: agent.id,
        total_commission: totalComm,
        remarks: memo,
      });
      toast.success('New agent assigned');
      refreshData();
    } catch (err) {
      console.error('Assign error:', err);
      toast.error(err.response?.data?.message || 'Failed to assign agent');
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Print Statement ──
  const printStatement = () => {
    if (!data) return;
    const { plot, agents, totals } = data;
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

    const agentSections = agents.map(agent => `
      <div style="margin-bottom:6mm; page-break-inside:avoid;">
        <h3 style="font-size:12px; margin-bottom:3mm; border-bottom:1px solid #cbd5e1; padding-bottom:2mm;">
          Agent: ${agent.agent_name} ${agent.agent_phone ? `(${agent.agent_phone})` : ''} — Commission: ₹${fmtINR(agent.total_commission)}
          <span style="float:right; font-size:10px; color:${agent.status === 'Completed' ? '#059669' : '#b45309'}">${agent.status}</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Cheque</th>
              <th style="text-align:right">Amount</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${agent.payments.length > 0 ? agent.payments.map(p => `
              <tr>
                <td>${p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</td>
                <td>${p.payment_mode || '—'}</td>
                <td>${p.cheque_no || '—'}</td>
                <td style="text-align:right">${parseFloat(p.amount) < 0 ? '+' : '-'}₹${fmtINR(Math.abs(p.amount || 0))}</td>
                <td>${p.status || '—'}</td>
                <td>${p.remarks || '—'}</td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No payments recorded</td></tr>'}
          </tbody>
        </table>
        <div style="text-align:right; margin-top:2mm; font-size:10px; font-weight:700;">
          Paid: ₹${fmtINR(agent.total_paid)} | Pending: ₹${fmtINR(agent.balance)}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Commission Statement - Plot ${plot.plot_no}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 10mm; }
    .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 6mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 20px; color: #0f172a; }
    .header p { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .plot-info { display: flex; gap: 5mm; margin-bottom: 6mm; }
    .plot-info div { flex:1; border:1px solid #e2e8f0; padding:3mm; border-radius:2mm; }
    .plot-info .label { font-size:8px; text-transform:uppercase; color:#94a3b8; font-weight:700; }
    .plot-info .value { font-size:12px; font-weight:600; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 2mm; text-align: left; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; font-size: 8px; }
    td { padding: 2mm; border: 1px solid #e2e8f0; }
    .grand-total { margin-top:6mm; padding:4mm; background:#f8fafc; border:2px solid #0f172a; border-radius:2mm; text-align:center; font-weight:700; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Commission Statement — Plot ${plot.plot_no}</h1>
    <p>${plot.site_name || ''} | ${plot.buyer_name || 'N/A'}</p>
  </div>
  <div class="plot-info">
    <div><span class="label">Plot Size</span><br/><span class="value">${plot.plot_size || 'N/A'}</span></div>
    <div><span class="label">Plot Rate</span><br/><span class="value">${plot.plot_rate ? '₹' + fmtINR(plot.plot_rate) : 'N/A'}</span></div>
    <div><span class="label">Total Commission</span><br/><span class="value">₹${fmtINR(totals.total_commission)}</span></div>
    <div><span class="label">Total Paid</span><br/><span class="value" style="color:#059669">₹${fmtINR(totals.total_paid)}</span></div>
    <div><span class="label">Pending</span><br/><span class="value" style="color:#dc2626">₹${fmtINR(totals.balance)}</span></div>
  </div>
  ${agentSections}
  <div class="grand-total">
    GRAND TOTAL — Commission: ₹${fmtINR(totals.total_commission)} | Paid: ₹${fmtINR(totals.total_paid)} | Pending: ₹${fmtINR(totals.balance)}
  </div>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print()" style="padding:10px 40px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer;">PRINT</button>
  </div>
</body>
</html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  // ── Print Receipt (farmer-style two-copy layout) ──
  const handlePrintReceipt = async (payment, agent) => {
    if (!data) return;
    const { plot } = data;
    const amt = parseFloat(payment.amount) || 0;
    const absAmt = Math.abs(amt);
    const isReceiveEntry = amt < 0;
    const amountColor = isReceiveEntry ? '#059669' : '#dc2626';
    const siteName = (currentSite?.name || plot.site_name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (payment.payment_mode || '').toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';
    const docTitle = isReceiveEntry ? 'Commission Money Receive Receipt' : 'Commission Payment Receipt';

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if (isCash) {
      printCashReceipt({
        siteName, siteAddr,
        docTitle: isReceiveEntry ? 'Cash Receipt' : 'Cash Payment Voucher',
        voucherNo: `CMN-${payment.id}`, dateStr: payDate, printedAt,
        partyLabel: isReceiveEntry ? 'Received From (Agent)' : 'Paid To (Agent)',
        partyName: (agent?.full_name || agent?.name || '').toUpperCase(),
        plotNo: plot?.plot_no || '',
        amount: absAmt, amountColor,
        rows: [
          { label: 'Entry Type', value: isReceiveEntry ? 'MONEY RECEIVED' : 'PAYMENT OUT' },
          { label: 'Remarks', value: payment.remarks || '' },
        ],
        signerName,
        customerSigLabel: isReceiveEntry ? 'Agent Signature' : 'Receiver Signature',
        row: payment,
      });
      return;
    }

    let qrDataUrl = null;
    if (payment.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(payment.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch { qrDataUrl = null; }
    }
    const qrSection = qrDataUrl
      ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
      : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'COMMISSION SETTLEMENT DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> CMN-${payment.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${isReceiveEntry ? 'Received From (Agent)' : 'Paid To (Agent)'}</div><div class="c">:</div><div class="v">${(agent?.agent_name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Plot No</div><div class="c">:</div><div class="v">${(plot?.plot_no || '—').toString().toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Buyer</div><div class="c">:</div><div class="v">${(plot?.buyer_name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(payment.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Commission ${isReceiveEntry ? 'Receipt' : 'Payment'} Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${payment.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Entry Type</th><td>${isReceiveEntry ? 'MONEY RECEIVED' : 'PAYMENT OUT'}</td></tr>
            <tr><th>Payment Mode</th><td>${(payment.payment_mode || '—').toUpperCase()}</td></tr>
            ${payment.cheque_no ? `<tr><th>Cheque No</th><td>${payment.cheque_no}</td></tr>` : ''}
            ${payment.bank_name ? `<tr><th>Bank</th><td>${payment.bank_name.toUpperCase()}</td></tr>` : ''}
            ${payment.transaction_id ? `<tr><th>Transaction ID</th><td>${payment.transaction_id}</td></tr>` : ''}
            ${payment.remarks ? `<tr><th>Remarks</th><td>${payment.remarks}</td></tr>` : ''}
            <tr><th>Amount</th><td style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box">${customerSigImg(payment)}<div class="sig-line">${isReceiveEntry ? 'Agent Signature' : 'Receiver Signature'}</div></div>
            <div class="sig-box">${authoritySigHtml(payment, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>COMMISSION RECEIPT - ${payment.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    ${CUSTOMER_SIGN_CSS}
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Agent Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=750');
    w.document.write(html);
    w.document.close();
  };

  // ── Derived rollups (memoized so heavy list math only reruns when data
  //    changes, not on every dialog/keystroke re-render) ──
  const derived = useMemo(() => {
    if (!data) return null;
    const { plot, agents, totals, grand, timeline } = data;

    // ── Plot-wide rollup across every booking/resale of this plot ──
    // `grand` is supplied by the API (sum of commission / given / pending over
    // ALL bookings of this plot_no). When a plot has only one booking it equals
    // the current-booking totals. We surface these as the headline numbers so a
    // resold plot answers "how much have I given on this plot in total?".
    const hasHistory = (timeline?.length || 0) > 1;
    const plotWide = grand || {
      total_commission: totals.total_commission,
      total_paid: totals.total_paid,
      total_paid_all: totals.total_paid_all ?? totals.total_paid,
      balance: totals.balance,
    };
    const plotWideGiven = parseFloat(plotWide.total_paid_all ?? plotWide.total_paid) || 0;
    const plotWideCommission = parseFloat(plotWide.total_commission) || 0;
    const plotWidePending = parseFloat(plotWide.balance ?? (plotWideCommission - plotWideGiven));
    const plotWidePct = plotWideCommission > 0
      ? Math.min(Math.round((plotWideGiven / plotWideCommission) * 100), 100)
      : 0;
    const plotWideOverpaid = plotWideGiven > plotWideCommission + 0.5;

    // Agents from OTHER bookings of this plot (previous/next resale cycles) so
    // the page shows old + current agents together. The currently-viewed
    // booking's agents are rendered with full ledgers above; these are compact.
    const viewedPlotId = parseInt(resolvedPlotId) || plot.plot_id;
    const latestBookingPlotId = hasHistory ? timeline[timeline.length - 1].plot_id : viewedPlotId;
    // Previous bookings of this plot_no (resale history), each with its buyer,
    // agents and their (read-only) payment ledgers — rendered as a vertical
    // booking timeline below the current booking.
    // The CURRENT OWNER = the most recent sale (latest booking). The page
    // headlines this owner + agent regardless of which plot_id was opened.
    const latestBooking = timeline.length ? timeline[timeline.length - 1] : null;
    const currentAgents = (latestBooking?.agents_detail?.length ? latestBooking.agents_detail : agents) || [];
    const currentBuyerName = latestBooking?.buyer_name || plot.buyer_name;
    const currentAgentNames = currentAgents.map((a) => a.agent_name).filter(Boolean).join(', ');
    const currentBookingCommission = parseFloat(latestBooking?.total_commission ?? totals.total_commission) || 0;
    const currentBookingGiven = parseFloat(latestBooking?.total_paid_all ?? totals.total_paid) || 0;
    const currentBookingPending = parseFloat(latestBooking?.balance ?? totals.balance) || 0;
    const currentBookingPct = currentBookingCommission > 0
      ? Math.min(Math.round((currentBookingGiven / currentBookingCommission) * 100), 100) : 0;
    const currentBookingOverpaid = currentBookingGiven > currentBookingCommission + 0.5;
    const viewedIsLatest = viewedPlotId === latestBookingPlotId;

    // Earlier owners = every sale except the latest, newest-first.
    const previousBookings = timeline.filter((t) => t.plot_id !== latestBookingPlotId).reverse();

    // Money actually given to each agent (by name) across every sale — powers
    // the per-agent breakdown on the "Total Given" analytics card.
    const m = new Map();
    for (const b of timeline) for (const a of (b.agents_detail || [])) {
      m.set(a.agent_name, (m.get(a.agent_name) || 0) + (parseFloat(a.total_paid_all) || 0));
    }
    const givenByAgent = [...m.entries()].map(([name, given]) => ({ name, given }));

    // Every sale of this plot (with its agents) for the Manage Timeline dialog.
    const manageBookings = (timeline && timeline.length)
      ? timeline
      : [{ plot_id: viewedPlotId, buyer_name: plot.buyer_name, agents_detail: agents }];

    // Gross money movement across every sale — powers the KPI strip split of
    // "Paid Out" (positive entries) vs "Received Back" (negative entries).
    let grossPaidOut = 0;
    let receivedBack = 0;
    for (const b of manageBookings) for (const a of (b.agents_detail || [])) for (const p of (a.payments || [])) {
      const amt = parseFloat(p.amount) || 0;
      if (amt < 0) receivedBack += -amt; else grossPaidOut += amt;
    }

    // Flat unified ledger of the current booking (newest first) — one row per
    // payment, tagged with its agent so receipts / edit / delete keep working.
    const ledgerRows = [];
    for (const a of currentAgents) for (const p of (a.payments || [])) ledgerRows.push({ p, agent: a });
    ledgerRows.sort((x, y) =>
      (new Date(y.p.date || 0) - new Date(x.p.date || 0)) || ((y.p.id || 0) - (x.p.id || 0)));

    // commission_id → { agent, isCurrent, buyerName } across every sale, so the
    // agent slide-over sheet can resolve any agent (current or historical).
    const agentDirectory = new Map();
    for (const b of previousBookings) for (const a of (b.agents_detail || [])) {
      agentDirectory.set(a.commission_id, { agent: a, isCurrent: false, buyerName: b.buyer_name });
    }
    for (const a of currentAgents) {
      agentDirectory.set(a.commission_id, { agent: a, isCurrent: true, buyerName: currentBuyerName });
    }

    return {
      hasHistory, plotWideGiven, plotWideCommission, plotWidePending, plotWidePct, plotWideOverpaid,
      viewedPlotId, currentAgents, currentBuyerName, currentAgentNames,
      currentBookingCommission, currentBookingGiven, currentBookingPending, currentBookingPct,
      currentBookingOverpaid, viewedIsLatest, previousBookings, givenByAgent, manageBookings,
      grossPaidOut, receivedBack, ledgerRows, agentDirectory,
    };
  }, [data, resolvedPlotId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        {/* Header band skeleton */}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <Skeleton className="h-4 w-44" />
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2.5">
              <Skeleton className="h-8 w-52" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-7 w-32 rounded-full" />
                <Skeleton className="h-7 w-36 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-40 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </div>
        {/* KPI strip skeleton */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-7 w-28" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-11 w-full max-w-xs rounded-xl" />
        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Skeleton className="h-4 w-56" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !derived) return null;

  const { plot, is_resale, timeline } = data;
  const {
    hasHistory, plotWideGiven, plotWideCommission, plotWidePending, plotWidePct, plotWideOverpaid,
    viewedPlotId, currentAgents, currentBuyerName, currentAgentNames,
    currentBookingCommission, currentBookingGiven, currentBookingPending, currentBookingPct,
    currentBookingOverpaid, viewedIsLatest, previousBookings, manageBookings,
    grossPaidOut, receivedBack, ledgerRows, agentDirectory,
  } = derived;

  const sheetEntry = agentSheetId != null ? agentDirectory.get(agentSheetId) : null;
  const sheetAgent = sheetEntry?.agent || null;

  // ── Bulk ledger-row actions (Ledger tab) ──
  const visibleLedgerIds = ledgerRows.map(({ p }) => p.id);

  const handleBulkEditPayment = () => {
    const id = [...ledgerSelection.selected][0];
    const row = ledgerRows.find(({ p }) => p.id === id);
    if (row) handleEditPayment(row.p);
  };

  // Combined single-window print adapted from handlePrintReceipt — one A4
  // office+agent pair per selected payment, all in one document/window so
  // popup blockers can't eat anything after the first.
  // ponytail: always uses the general A4 layout (the non-cash branch below),
  // even for CASH entries — the A5 cash-receipt template opens its own
  // window per call and can't be folded into one combined document.
  const handleBulkPrintReceipts = async () => {
    const rows = ledgerRows.filter(({ p }) => ledgerSelection.isSelected(p.id));
    if (!rows.length || !data) return;
    const { plot } = data;
    const siteName = (currentSite?.name || plot.site_name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const signerName = user?.full_name || user?.name || '';

    const documents = await Promise.all(rows.map(async ({ p: payment, agent }) => {
      const amt = parseFloat(payment.amount) || 0;
      const absAmt = Math.abs(amt);
      const isReceiveEntry = amt < 0;
      const amountColor = isReceiveEntry ? '#059669' : '#dc2626';
      const payDate = payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const docTitle = isReceiveEntry ? 'Commission Money Receive Receipt' : 'Commission Payment Receipt';
      const isCash = (payment.payment_mode || '').toUpperCase() === 'CASH';

      let qrDataUrl = null;
      if (payment.verifyUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(payment.verifyUrl, {
            width: 640, margin: 2, errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch { qrDataUrl = null; }
      }
      const qrSection = qrDataUrl
        ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
        : '';

      const receiptBlock = (copyLabel) => `
        <div class="receipt-copy">
          <div class="copy-label">${copyLabel}</div>
          <div class="border-frame"></div>
          <div class="watermark">${siteName}</div>
          <div class="content">
            <div class="header">
              <h1>${siteName}</h1>
              <p>${siteAddr || 'COMMISSION SETTLEMENT DIVISION'}</p>
            </div>
            <div class="doc-type"><h2>${docTitle}</h2></div>
            <div class="meta-info">
              <div class="meta-item"><b>Ref:</b> CMN-${payment.id}</div>
              <div class="meta-item"><b>Date:</b> ${payDate}</div>
            </div>
            <div class="kv-qr-wrap">
              <div class="kv-section">
                <div class="kv-row"><div class="k">${isReceiveEntry ? 'Received From (Agent)' : 'Paid To (Agent)'}</div><div class="c">:</div><div class="v">${(agent?.agent_name || '—').toUpperCase()}</div></div>
                <div class="kv-row"><div class="k">Plot No</div><div class="c">:</div><div class="v">${(plot?.plot_no || '—').toString().toUpperCase()}</div></div>
                <div class="kv-row"><div class="k">Buyer</div><div class="c">:</div><div class="v">${(plot?.buyer_name || '—').toUpperCase()}</div></div>
                <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</div></div>
                <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(payment.payment_mode || '—').toUpperCase()}</div></div>
              </div>
              ${qrSection}
            </div>
            <div class="settlement-title">Commission ${isReceiveEntry ? 'Receipt' : 'Payment'} Details:</div>
            <table class="data-table">
              <tr><th>S.No.</th><td>#${payment.id}</td></tr>
              <tr><th>Date</th><td>${payDate || '—'}</td></tr>
              <tr><th>Entry Type</th><td>${isReceiveEntry ? 'MONEY RECEIVED' : 'PAYMENT OUT'}</td></tr>
              <tr><th>Payment Mode</th><td>${(payment.payment_mode || '—').toUpperCase()}</td></tr>
              ${payment.cheque_no ? `<tr><th>Cheque No</th><td>${payment.cheque_no}</td></tr>` : ''}
              ${payment.bank_name ? `<tr><th>Bank</th><td>${payment.bank_name.toUpperCase()}</td></tr>` : ''}
              ${payment.transaction_id ? `<tr><th>Transaction ID</th><td>${payment.transaction_id}</td></tr>` : ''}
              ${payment.remarks ? `<tr><th>Remarks</th><td>${payment.remarks}</td></tr>` : ''}
              <tr><th>Amount</th><td style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</td></tr>
            </table>
            ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
            <div class="footer">
              <div class="sig-box">${customerSigImg(payment)}<div class="sig-line">${isReceiveEntry ? 'Agent Signature' : 'Receiver Signature'}</div></div>
              <div class="sig-box">${authoritySigHtml(payment, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
            </div>
            <div class="print-meta">Printed on: <b>${printedAt}</b></div>
          </div>
        </div>
      `;

      return `<div class="document">${receiptBlock('Office Copy')}<hr class="scissor-line" />${receiptBlock('Agent Copy')}</div>`;
    }));

    const html = `<!DOCTYPE html>
<html><head>
  <title>COMMISSION RECEIPTS - ${rows.length} selected</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    ${CUSTOMER_SIGN_CSS}
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  ${documents.join('')}
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=750');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      {/* ── Header band ── */}
      <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-4 sm:p-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/plot-commission')}
            className="-ml-2 h-8 rounded-lg px-2 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Plot Commissions
          </Button>

          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Plot {plot.plot_no}</h1>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase ${
                    plotWidePct >= 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    plotWidePct > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {plotWidePct >= 100 ? 'SETTLED' : plotWidePct > 0 ? 'IN PROGRESS' : 'PENDING'}
                </Badge>
                {is_resale && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    <RefreshCw className="mr-1 h-3 w-3" /> RESALE
                  </Badge>
                )}
              </div>
              <TooltipProvider delayDuration={150}>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <MetaChip label="Owner" value={currentBuyerName} tint="bg-indigo-100 text-indigo-700" />
                  <MetaChip label="Agent" value={currentAgentNames} tint="bg-cyan-100 text-cyan-700" />
                  <MetaChip value={plot.site_name} icon={MapPin} tint="bg-slate-200 text-slate-600" />
                  <MetaChip value={plot.plot_size} icon={Ruler} tint="bg-slate-200 text-slate-600" />
                </div>
              </TooltipProvider>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canWrite && currentAgents.length === 1 && (
                <Button
                  size="sm"
                  onClick={() => openPaymentDialog(currentAgents[0].commission_id, 'pay')}
                  className="h-9 bg-indigo-600 text-xs shadow-sm hover:bg-indigo-700"
                >
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" /> Record Payment
                </Button>
              )}
              {canWrite && currentAgents.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-9 bg-indigo-600 text-xs shadow-sm hover:bg-indigo-700">
                      <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" /> Record Payment
                      <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Pay commission to</DropdownMenuLabel>
                    {currentAgents.map((a) => (
                      <DropdownMenuItem key={a.commission_id} onClick={() => openPaymentDialog(a.commission_id, 'pay')} className="text-xs">
                        <span className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[9px] font-bold text-cyan-700">{initialsOf(a.agent_name)}</span>
                        <span className="min-w-0 flex-1 truncate">{a.agent_name}</span>
                        <span className="ml-2 tabular-nums text-slate-400">₹{formatCurrency(a.balance)} due</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canWrite && currentAgents.length === 0 && (
                <Button
                  size="sm"
                  onClick={() => setAssignDialogOpen(true)}
                  className="h-9 bg-indigo-600 text-xs shadow-sm hover:bg-indigo-700"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Assign Agent
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800" title="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={printStatement} className="text-xs">
                    <Printer className="mr-2 h-3.5 w-3.5 text-slate-400" /> Print Statement
                  </DropdownMenuItem>
                  {(canUpdate || canDelete) && (
                    <DropdownMenuItem onClick={() => setManageOpen(true)} className="text-xs">
                      <Settings2 className="mr-2 h-3.5 w-3.5 text-slate-400" /> Manage Timeline
                    </DropdownMenuItem>
                  )}
                  {canWrite && (
                    <DropdownMenuItem onClick={() => setAssignDialogOpen(true)} className="text-xs">
                      <Plus className="mr-2 h-3.5 w-3.5 text-slate-400" /> Assign New Agent
                    </DropdownMenuItem>
                  )}
                  {canWrite && currentAgents.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Get money back</DropdownMenuLabel>
                      {currentAgents.map((a) => (
                        <DropdownMenuItem
                          key={a.commission_id}
                          disabled={(parseFloat(a.total_paid_all) || 0) <= 0}
                          onClick={() => openPaymentDialog(a.commission_id, 'get')}
                          className="text-xs"
                        >
                          <ArrowDownLeft className="mr-2 h-3.5 w-3.5 text-cyan-500" />
                          <span className="min-w-0 flex-1 truncate">{a.agent_name}</span>
                          <span className="ml-2 tabular-nums text-slate-400">₹{formatCurrency(a.total_paid_all)} given</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {hasHistory && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50/80 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-100">
              <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>This plot was sold <strong>{timeline.length} times</strong> (resold). Each sale keeps its own commission ledger — the <strong>same agent can be settled on one sale and still owed on another</strong>. KPIs below cover the whole plot.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── KPI strip (plot-wide, across every booking/resale) ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Commission</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Landmark className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">₹{formatCurrency(plotWideCommission)}</p>
            <p className="mt-1 text-[11px] text-slate-400">{hasHistory ? 'Decided for plot · same across resales' : 'Decided for this plot'}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid Out</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">₹{formatCurrency(grossPaidOut)}</p>
            <p className="mt-1 text-[11px] text-slate-400">Gross payouts · net given ₹{formatCurrency(plotWideGiven)}</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Received Back</p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                <ArrowDownLeft className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-cyan-700">₹{formatCurrency(receivedBack)}</p>
            <p className="mt-1 text-[11px] text-slate-400">Money recovered from agents</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{plotWideOverpaid ? 'Excess Given' : 'Balance'}</p>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${plotWideOverpaid ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                <Wallet className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${plotWideOverpaid ? 'text-red-600' : plotWidePending <= 0.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
              ₹{formatCurrency(Math.abs(plotWidePending))}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">{plotWideOverpaid ? 'Paid beyond commission' : plotWidePending <= 0.5 ? 'Fully settled' : 'Still to pay out'} · {plotWidePct}% done</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs: Ledger / Bookings / Agents ── */}
      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:w-auto">
          <TabsTrigger value="ledger" className="group rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Ledger
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{ledgerRows.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="group rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Bookings
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{previousBookings.length + 1}</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="group rounded-lg px-4 py-2 text-xs font-semibold text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            Agents
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">{agentDirectory.size}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Ledger tab: unified transaction table for the current booking ── */}
        <TabsContent value="ledger" className="mt-0">
          <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Transaction Ledger</h2>
              <Badge variant="outline" className="border-slate-200 px-1.5 py-0 text-[10px] tabular-nums text-slate-500">{ledgerRows.length} entries</Badge>
              <BulkActionsBar
                count={ledgerSelection.count}
                onClear={ledgerSelection.clear}
                onEdit={canUpdate ? handleBulkEditPayment : undefined}
                onDelete={canDelete ? handleBulkDeletePayments : undefined}
                onPrint={handleBulkPrintReceipts}
                entityLabel="payment"
                deleting={bulkDeletePaymentsLoading}
              />
              <span className="ml-auto text-[10px] text-slate-400">Current booking · PAY = payout · GET = recovery</span>
            </div>
            {ledgerRows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                  <IndianRupee className="h-6 w-6 text-slate-300" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">No transactions yet</p>
                  <p className="mt-1 max-w-sm text-xs text-slate-400">
                    {currentAgents.length === 0
                      ? 'Assign a commission agent to this plot to start the ledger.'
                      : 'Record the first payout to start this booking’s commission ledger.'}
                  </p>
                </div>
                {canWrite && currentAgents.length === 0 && (
                  <Button size="sm" onClick={() => setAssignDialogOpen(true)} className="bg-indigo-600 text-xs hover:bg-indigo-700">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Assign Agent
                  </Button>
                )}
                {canWrite && currentAgents.length === 1 && (
                  <Button size="sm" onClick={() => openPaymentDialog(currentAgents[0].commission_id, 'pay')} className="bg-indigo-600 text-xs hover:bg-indigo-700">
                    <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> Record Payment
                  </Button>
                )}
                {canWrite && currentAgents.length > 1 && (
                  <p className="text-[11px] text-slate-400">Use <strong>Record Payment</strong> above and pick an agent.</p>
                )}
              </div>
            ) : (
              <div className="[&>div]:max-h-[560px]">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-slate-50">
                    <TableRow className="hover:bg-slate-50">
                      <TableHead className="h-9 w-9 text-[11px] uppercase tracking-wider text-slate-500">
                        <Checkbox
                          checked={ledgerSelection.isAllSelected(visibleLedgerIds) ? true : (ledgerSelection.count > 0 && visibleLedgerIds.some((id) => ledgerSelection.isSelected(id))) ? 'indeterminate' : false}
                          onCheckedChange={() => ledgerSelection.toggleAll(visibleLedgerIds)}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Date</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Agent</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Type</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Cheque</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Voucher</TableHead>
                      <TableHead className="h-9 text-right text-[11px] uppercase tracking-wider text-slate-500">Amount</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Assigned</TableHead>
                      <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">By</TableHead>
                      <TableHead className="h-9 text-center text-[11px] uppercase tracking-wider text-slate-500">Status</TableHead>
                      <TableHead className="h-9 w-10 text-[11px] uppercase tracking-wider text-slate-500" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerRows.map(({ p, agent }) => {
                      const receiveEntry = isReceiveAmount(p.amount);
                      return (
                        <TableRow key={p.id} className={`${receiveEntry ? 'bg-cyan-50/40' : 'even:bg-slate-50/50'} hover:bg-slate-100/60`}>
                          <TableCell className="py-2.5">
                            <Checkbox
                              checked={ledgerSelection.isSelected(p.id)}
                              onCheckedChange={() => ledgerSelection.toggle(p.id)}
                              aria-label={`Select payment ${p.id}`}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2.5 font-semibold text-slate-700">{formatDate(p.date)}</TableCell>
                          <TableCell className="py-2.5">
                            <span className="flex min-w-0 max-w-[160px] items-center gap-1.5" title={agent.agent_name}>
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[9px] font-bold text-cyan-700">{initialsOf(agent.agent_name)}</span>
                              <span className="truncate font-medium text-slate-700">{agent.agent_name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant={p.payment_mode === 'CASH' ? 'secondary' : 'outline'} className="text-[10px]">{p.payment_mode}</Badge>
                                <Badge variant="outline" className={`text-[10px] ${receiveEntry ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                  {receiveEntry ? 'GET' : 'PAY'}
                                </Badge>
                              </div>
                              {p.cheque_status && <ChequeStatusControl chequeStatus={p.cheque_status} source="plot_commission_payment" entryId={p.id} isAdmin={isAdmin} onStatusChange={fetchData} />}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 font-mono text-[11px] text-slate-500">{p.cheque_no || '—'}</TableCell>
                          <TableCell className="py-2.5"><VoucherThumbnail url={p.voucher_url} /></TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold tabular-nums ${receiveEntry ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-800'}`}>
                              {receiveEntry ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                              {formatSignedAmount(p.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {p.assigned_admin_id ? (
                              <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700">
                                {getAssignedAdminLabel(p) || '—'}
                              </span>
                            ) : (
                              <span className="text-[10px] italic text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5"><UserAvatar name={p.created_by_name} label="Created by" size="xs" /></TableCell>
                          <TableCell className="py-2.5 text-center">
                            <Badge variant="outline" className={`text-[9px] uppercase ${paymentStatusCls(p.status)}`}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Entry actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handlePrintReceipt(p, agent)} className="text-xs">
                                  <Printer className="mr-2 h-3.5 w-3.5 text-slate-400" /> Print Receipt
                                </DropdownMenuItem>
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => setSignEntry({ payment: p, agent })} className="text-xs">
                                    <PenLine className={`mr-2 h-3.5 w-3.5 ${p.customer_signature_url ? 'text-emerald-500' : 'text-slate-400'}`} />
                                    {p.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}
                                  </DropdownMenuItem>
                                )}
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => handleEditPayment(p)} className="text-xs">
                                    <Edit2 className="mr-2 h-3.5 w-3.5 text-slate-400" /> Edit Entry
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeletePaymentId(p.id)} className="text-xs text-red-600 focus:text-red-600">
                                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Entry
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Bookings tab: current booking feature card + resale history ── */}
        <TabsContent value="bookings" className="mt-0 space-y-4">
          {/* Current booking */}
          <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm ring-1 ring-emerald-200">
            <div className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Badge variant="outline" className="border-emerald-200 bg-emerald-100 px-1.5 py-0 text-[9px] text-emerald-700">CURRENT OWNER</Badge>
                {viewedIsLatest && (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[9px] text-blue-700">VIEWING</Badge>
                )}
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Buyer</p>
                  <p className="truncate text-sm font-bold text-slate-900" title={currentBuyerName || undefined}>{currentBuyerName || '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Agent</p>
                  <p className="truncate text-sm font-bold text-slate-900" title={currentAgentNames || undefined}>{currentAgentNames || '—'}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-slate-600">Commission <strong className="tabular-nums text-slate-800">₹{formatCurrency(currentBookingCommission)}</strong></span>
                  <span className="text-slate-600">Given <strong className="tabular-nums text-emerald-700">₹{formatCurrency(currentBookingGiven)}</strong></span>
                  <span className="text-slate-600">Pending <strong className={`tabular-nums ${currentBookingPending > 0.5 ? 'text-amber-700' : 'text-emerald-700'}`}>₹{formatCurrency(Math.abs(currentBookingPending))}</strong></span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Progress
                  value={Math.min(currentBookingPct, 100)}
                  className={`h-2 flex-1 bg-emerald-100 ${currentBookingOverpaid ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500'}`}
                />
                <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{currentBookingPct}% settled</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {currentAgents.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-4 text-xs text-slate-400">
                  <User className="h-4 w-4 shrink-0" /> No commission agents assigned to this booking yet.
                </div>
              )}
              {currentAgents.map((agent) => {
                const isCompleted = agent.status === 'Completed';
                const isPartial = agent.status === 'Partial';
                const pct = agent.total_commission > 0 ? Math.min(Math.round((agent.total_paid / parseFloat(agent.total_commission)) * 100), 100) : 0;
                const overpaidBy = -(parseFloat(agent.balance) || 0);
                return (
                  <div key={agent.commission_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      isCompleted ? 'bg-emerald-500 text-white' : isPartial ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {initialsOf(agent.agent_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-slate-900" title={agent.agent_name}>{agent.agent_name}</span>
                        {agent.agent_phone && <span className="hidden text-[10px] text-slate-400 sm:inline">{agent.agent_phone}</span>}
                        {plot.buyer_name && agent.agent_name &&
                          plot.buyer_name.trim().toLowerCase() === agent.agent_name.trim().toLowerCase() && (
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 px-1 py-0 text-[8px] uppercase text-indigo-600">also buyer</Badge>
                        )}
                        <Badge variant="outline" className={`text-[9px] font-semibold uppercase ${
                          isCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          isPartial ? 'border-amber-200 bg-amber-50 text-amber-700' :
                          'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="tabular-nums">₹{formatCurrency(agent.total_commission)}</span>
                        <div className="flex max-w-[120px] flex-1 items-center gap-1.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 tabular-nums text-slate-400">{pct}%</span>
                        </div>
                        {agent.total_paid > 0 ? (
                          <span className="font-medium tabular-nums text-emerald-600">₹{formatCurrency(agent.total_paid)} paid</span>
                        ) : (
                          <span className="italic text-slate-400">No payment yet</span>
                        )}
                        {agent.balance > 0.5 && <span className="tabular-nums text-amber-600">₹{formatCurrency(agent.balance)} due</span>}
                        {overpaidBy > 0.5 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 font-semibold tabular-nums text-red-600">
                            <AlertCircle className="h-3 w-3" /> Overpaid ₹{formatCurrency(overpaidBy)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {canWrite && (
                        <Button
                          size="sm"
                          className={`h-7 px-2.5 text-xs shadow-sm ${isCompleted ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                          onClick={() => openPaymentDialog(agent.commission_id, 'pay')}
                          title={isCompleted ? 'Already settled — paying more will be recorded as overpaid' : 'Record a payout'}
                        >
                          <ArrowUpRight className="mr-1 h-3 w-3" /> {isCompleted ? 'Pay More' : 'Pay'}
                        </Button>
                      )}
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-cyan-200 px-2.5 text-xs text-cyan-700 hover:bg-cyan-50"
                          disabled={(parseFloat(agent.total_paid_all) || 0) <= 0}
                          onClick={() => openPaymentDialog(agent.commission_id, 'get')}
                        >
                          <ArrowDownLeft className="mr-1 h-3 w-3" /> Get Money
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                        onClick={() => setAgentSheetId(agent.commission_id)}
                      >
                        Ledger <ChevronDown className="ml-1 h-3 w-3 -rotate-90" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Previous bookings (resale history) */}
          {previousBookings.map((booking) => {
            const bSettled = booking.total_commission > 0 && booking.total_paid_all >= booking.total_commission - 0.5;
            const bPct = booking.total_commission > 0 ? Math.min(Math.round((booking.total_paid_all / booking.total_commission) * 100), 100) : 0;
            const bAgentNames = (booking.agents_detail || []).map((a) => a.agent_name).filter(Boolean).join(', ');
            return (
              <Card key={booking.plot_id} className="overflow-hidden rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
                <div className="h-1 bg-slate-100">
                  <div className={`h-full transition-all ${bSettled ? 'bg-emerald-500' : booking.total_paid_all > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${bPct}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <Badge variant="outline" className="border-slate-300 bg-slate-100 px-1.5 py-0 text-[9px] text-slate-600">PREVIOUS OWNER</Badge>
                  {booking.plot_id === viewedPlotId && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[9px] text-blue-700">VIEWING</Badge>
                  )}
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Buyer</p>
                    <p className="truncate text-sm font-bold text-slate-900" title={booking.buyer_name || undefined}>{booking.buyer_name || '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Agent</p>
                    <p className="truncate text-sm font-bold text-slate-900" title={bAgentNames || undefined}>{bAgentNames || '—'}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Booked</p>
                    <p className="text-xs font-medium text-slate-600">{formatDate(booking.first_created)}</p>
                  </div>
                  <Badge variant="outline" className={`px-1.5 py-0 text-[9px] uppercase ${bSettled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : booking.total_paid_all > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    {bSettled ? 'Settled' : booking.total_paid_all > 0 ? 'Partial' : 'Pending'}
                  </Badge>
                  <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-slate-600">Commission <strong className="tabular-nums text-slate-800">₹{formatCurrency(booking.total_commission)}</strong></span>
                    <span className="text-slate-600">Given <strong className="tabular-nums text-emerald-700">₹{formatCurrency(booking.total_paid_all)}</strong></span>
                    <span className="text-slate-600">Pending <strong className={`tabular-nums ${booking.balance > 0.5 ? 'text-amber-700' : 'text-emerald-700'}`}>₹{formatCurrency(Math.abs(booking.balance))}</strong></span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800" onClick={() => navigate(`/plot-commission/plot/${booking.plot_id}?site_id=${siteId}`)} title="Open this booking's full ledger">
                      <Search className="mr-1 h-3 w-3" /> Open
                    </Button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {(booking.agents_detail || []).length === 0 && (
                    <div className="flex items-center gap-2 px-4 py-3 text-[11px] text-slate-400">
                      <User className="h-3.5 w-3.5 shrink-0" /> No commission agents on this sale.
                    </div>
                  )}
                  {(booking.agents_detail || []).map((a) => {
                    const aPct = a.total_commission > 0 ? Math.min(Math.round((a.total_paid_all / a.total_commission) * 100), 100) : 0;
                    const aSettled = a.status === 'Completed' || (a.total_commission > 0 && a.total_paid_all >= a.total_commission - 0.5);
                    const aOver = -(parseFloat(a.balance) || 0);
                    const aExpanded = expandedAgents[a.commission_id];
                    return (
                      <div key={a.commission_id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${aSettled ? 'bg-emerald-500 text-white' : a.total_paid_all > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {initialsOf(a.agent_name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-slate-800" title={a.agent_name}>{a.agent_name}</span>
                              {a.agent_phone && <span className="text-[10px] text-slate-400">{a.agent_phone}</span>}
                              {booking.buyer_name && a.agent_name &&
                                booking.buyer_name.trim().toLowerCase() === a.agent_name.trim().toLowerCase() && (
                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 px-1 py-0 text-[8px] uppercase text-indigo-600">also buyer</Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span className="tabular-nums">₹{formatCurrency(a.total_commission)}</span>
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                  <div className={`h-full rounded-full ${aSettled ? 'bg-emerald-500' : a.total_paid_all > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ width: `${aPct}%` }} />
                                </div>
                                <span className="tabular-nums text-slate-400">{aPct}%</span>
                              </div>
                              <span className="tabular-nums text-emerald-600">₹{formatCurrency(a.total_paid_all)} given</span>
                              {a.balance > 0.5 && <span className="tabular-nums text-amber-600">₹{formatCurrency(a.balance)} due</span>}
                              {aOver > 0.5 && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 font-semibold tabular-nums text-red-600">
                                  <AlertCircle className="h-3 w-3" /> Overpaid ₹{formatCurrency(aOver)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {canWrite && (
                              <Button
                                size="sm"
                                className={`h-7 px-2.5 text-xs shadow-sm ${aSettled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                onClick={() => openPaymentDialog(a.commission_id, 'pay')}
                                title={aSettled ? 'Already settled — paying more will be recorded as overpaid' : 'Record a payout'}
                              >
                                <ArrowUpRight className="mr-1 h-3 w-3" /> {aSettled ? 'Pay More' : 'Pay'}
                              </Button>
                            )}
                            {canWrite && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-cyan-200 px-2.5 text-xs text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                                disabled={(parseFloat(a.total_paid_all) || 0) <= 0}
                                onClick={() => openPaymentDialog(a.commission_id, 'get')}
                              >
                                <ArrowDownLeft className="mr-1 h-3 w-3" /> Get
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              onClick={() => toggleAgent(a.commission_id)}
                              title={aExpanded ? 'Hide payments' : 'Show payments'}
                            >
                              {aExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        {aExpanded && ((a.payments || []).length > 0 ? (
                          <div className="mt-2 space-y-1.5 sm:ml-11">
                            {a.payments.map((p) => {
                              const recv = isReceiveAmount(p.amount);
                              return (
                                <div key={p.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[11px]">
                                  <span className="font-medium text-slate-600">{formatDate(p.date)}</span>
                                  <Badge variant={p.payment_mode === 'CASH' ? 'secondary' : 'outline'} className="text-[9px]">{p.payment_mode}</Badge>
                                  <Badge variant="outline" className={`text-[9px] ${recv ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{recv ? 'GET' : 'PAY'}</Badge>
                                  <span className={`font-semibold tabular-nums ${recv ? 'text-cyan-700' : 'text-slate-800'}`}>{formatSignedAmount(p.amount)}</span>
                                  {p.cheque_no && <span className="font-mono text-slate-400">Chq {p.cheque_no}</span>}
                                  <Badge variant="outline" className={`text-[9px] uppercase ${paymentStatusCls(p.status)}`}>{p.status}</Badge>
                                  <Button variant="ghost" size="sm" className="ml-auto h-6 px-1.5 text-[10px] text-slate-500 hover:text-emerald-700" onClick={() => handlePrintReceipt(p, a)}>
                                    <Printer className="mr-1 h-3 w-3" /> Receipt
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] italic text-slate-400 sm:ml-11">No payments recorded</p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── Agents tab: summary cards → slide-over sheet with full ledger ── */}
        <TabsContent value="agents" className="mt-0 space-y-4">
          {currentAgents.length === 0 ? (
            <Card className="rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                  <User className="h-6 w-6 text-slate-300" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-700">No agents on the current booking</p>
                  <p className="mt-1 text-xs text-slate-400">Assign a commission agent to start paying out.</p>
                </div>
                {canWrite && (
                  <Button size="sm" onClick={() => setAssignDialogOpen(true)} className="bg-indigo-600 text-xs hover:bg-indigo-700">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Assign Agent
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {currentAgents.map((agent) => {
                const isCompleted = agent.status === 'Completed';
                const isPartial = agent.status === 'Partial';
                const pct = agent.total_commission > 0 ? Math.min(Math.round(((parseFloat(agent.total_paid_all) || 0) / parseFloat(agent.total_commission)) * 100), 100) : 0;
                const overBy = -(parseFloat(agent.balance) || 0);
                return (
                  <Card
                    key={agent.commission_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setAgentSheetId(agent.commission_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgentSheetId(agent.commission_id); } }}
                    className="cursor-pointer rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCompleted ? 'bg-emerald-500 text-white' : isPartial ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {initialsOf(agent.agent_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900" title={agent.agent_name}>{agent.agent_name}</p>
                          <p className="text-[10px] text-slate-400">{agent.agent_phone || 'Current booking'}</p>
                        </div>
                        <Badge variant="outline" className={`shrink-0 text-[9px] font-semibold uppercase ${
                          isCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          isPartial ? 'border-amber-200 bg-amber-50 text-amber-700' :
                          'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          {agent.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 px-1 py-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Commission</p>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-slate-800">₹{formatCurrency(agent.total_commission)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50/70 px-1 py-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600/70">Given</p>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-emerald-700">₹{formatCurrency(agent.total_paid_all)}</p>
                        </div>
                        <div className={`rounded-lg px-1 py-1.5 ${overBy > 0.5 ? 'bg-red-50' : 'bg-amber-50/70'}`}>
                          <p className={`text-[9px] font-semibold uppercase tracking-wider ${overBy > 0.5 ? 'text-red-500/80' : 'text-amber-600/70'}`}>{overBy > 0.5 ? 'Overpaid' : 'Due'}</p>
                          <p className={`mt-0.5 text-xs font-bold tabular-nums ${overBy > 0.5 ? 'text-red-600' : 'text-amber-700'}`}>₹{formatCurrency(Math.abs(agent.balance))}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Progress value={pct} className={`h-1.5 flex-1 bg-slate-100 ${overBy > 0.5 ? '[&>div]:bg-red-500' : isCompleted ? '[&>div]:bg-emerald-500' : '[&>div]:bg-amber-400'}`} />
                        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{pct}%</span>
                      </div>
                      <p className="mt-2.5 text-[10px] font-medium text-indigo-500">View full ledger ({agent.payments?.length || 0} entries)</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {hasHistory && previousBookings.some((b) => (b.agents_detail || []).length > 0) && (
            <>
              <div className="flex items-center gap-2 px-1 pt-1">
                <Separator className="flex-1" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Agents on earlier sales</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {previousBookings.map((b) => (b.agents_detail || []).map((agent) => {
                  const settled = agent.status === 'Completed' || (agent.total_commission > 0 && agent.total_paid_all >= agent.total_commission - 0.5);
                  return (
                    <Card
                      key={agent.commission_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setAgentSheetId(agent.commission_id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgentSheetId(agent.commission_id); } }}
                      className="cursor-pointer rounded-xl border-0 bg-white/70 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${settled ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {initialsOf(agent.agent_name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800" title={agent.agent_name}>{agent.agent_name}</p>
                            <p className="truncate text-[10px] text-slate-400">Sale to {b.buyer_name || '—'}</p>
                          </div>
                          <Badge variant="outline" className={`shrink-0 text-[9px] uppercase ${settled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                            {settled ? 'Settled' : agent.status || 'Pending'}
                          </Badge>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="tabular-nums">₹{formatCurrency(agent.total_commission)} commission</span>
                          <span className="tabular-nums text-emerald-600">₹{formatCurrency(agent.total_paid_all)} given</span>
                        </div>
                        <p className="mt-2 text-[10px] font-medium text-indigo-500">View full ledger ({agent.payments?.length || 0} entries)</p>
                      </CardContent>
                    </Card>
                  );
                }))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Agent slide-over sheet: full per-agent ledger + stats ── */}
      <Sheet open={!!sheetAgent} onOpenChange={(o) => { if (!o) setAgentSheetId(null); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          {sheetAgent && (
            <>
              <SheetHeader className="space-y-0 border-b border-slate-100 bg-slate-50/70 p-5 text-left">
                <div className="flex items-start gap-3 pr-8">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    sheetAgent.status === 'Completed' ? 'bg-emerald-500 text-white' :
                    sheetAgent.status === 'Partial' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {initialsOf(sheetAgent.agent_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-base font-bold text-slate-900" title={sheetAgent.agent_name}>{sheetAgent.agent_name}</SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs text-slate-500">
                      {sheetEntry.isCurrent ? 'Current booking' : 'Earlier sale'}
                      {sheetEntry.buyerName ? ` · Buyer ${sheetEntry.buyerName}` : ''}
                      {sheetAgent.agent_phone ? ` · ${sheetAgent.agent_phone}` : ''}
                    </SheetDescription>
                  </div>
                  <Badge variant="outline" className={`mt-0.5 shrink-0 text-[9px] font-semibold uppercase ${
                    sheetAgent.status === 'Completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    sheetAgent.status === 'Partial' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                    'border-slate-200 bg-slate-50 text-slate-600'
                  }`}>
                    {sheetAgent.status || 'Pending'}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="border-b border-slate-100 p-5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Commission</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">₹{formatCurrency(sheetAgent.total_commission)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600/80">Given (All)</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">₹{formatCurrency(sheetAgent.total_paid_all)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Approved Paid</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-slate-700">₹{formatCurrency(sheetAgent.total_paid)}</p>
                  </div>
                  {(() => {
                    const over = -(parseFloat(sheetAgent.balance) || 0);
                    return (
                      <div className={`rounded-xl p-3 ring-1 ${over > 0.5 ? 'bg-red-50 ring-red-100' : 'bg-amber-50/70 ring-amber-100'}`}>
                        <p className={`text-[9px] font-semibold uppercase tracking-wider ${over > 0.5 ? 'text-red-500/80' : 'text-amber-600/80'}`}>{over > 0.5 ? 'Overpaid' : 'Due'}</p>
                        <p className={`mt-1 text-lg font-bold tabular-nums ${over > 0.5 ? 'text-red-600' : 'text-amber-700'}`}>₹{formatCurrency(Math.abs(sheetAgent.balance))}</p>
                      </div>
                    );
                  })()}
                </div>
                {sheetAgent.remarks && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] italic text-slate-500 ring-1 ring-slate-100">{sheetAgent.remarks}</p>
                )}
                {canWrite && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 flex-1 bg-emerald-600 text-xs shadow-sm hover:bg-emerald-700"
                      onClick={() => { setAgentSheetId(null); openPaymentDialog(sheetAgent.commission_id, 'pay'); }}
                    >
                      <ArrowUpRight className="mr-1 h-3.5 w-3.5" /> {sheetAgent.status === 'Completed' ? 'Pay More' : 'Pay'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 border-cyan-200 text-xs text-cyan-700 hover:bg-cyan-50"
                      disabled={(parseFloat(sheetAgent.total_paid_all) || 0) <= 0}
                      onClick={() => { setAgentSheetId(null); openPaymentDialog(sheetAgent.commission_id, 'get'); }}
                    >
                      <ArrowDownLeft className="mr-1 h-3.5 w-3.5" /> Get Money
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-5 pb-2 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Ledger</h3>
                <Badge variant="outline" className="border-slate-200 px-1.5 py-0 text-[10px] tabular-nums text-slate-500">{sheetAgent.payments?.length || 0}</Badge>
              </div>
              <ScrollArea className="min-h-0 flex-1 px-5 pb-5">
                {(sheetAgent.payments || []).length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                      <IndianRupee className="h-4 w-4 text-slate-300" />
                    </span>
                    <p className="text-xs text-slate-400">No payments recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sheetAgent.payments.map((p) => {
                      const recv = isReceiveAmount(p.amount);
                      return (
                        <div key={p.id} className={`rounded-xl border p-3 ${recv ? 'border-cyan-100 bg-cyan-50/40' : 'border-slate-100 bg-white'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold tabular-nums ${recv ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-800'}`}>
                                {recv ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                                {formatSignedAmount(p.amount)}
                              </span>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant={p.payment_mode === 'CASH' ? 'secondary' : 'outline'} className="text-[9px]">{p.payment_mode}</Badge>
                                <Badge variant="outline" className={`text-[9px] ${recv ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{recv ? 'GET' : 'PAY'}</Badge>
                                <span className="text-[10px] font-medium text-slate-500">{formatDate(p.date)}</span>
                                {p.cheque_no && <span className="font-mono text-[10px] text-slate-400">Chq {p.cheque_no}</span>}
                              </div>
                            </div>
                            <Badge variant="outline" className={`shrink-0 text-[9px] uppercase ${paymentStatusCls(p.status)}`}>{p.status}</Badge>
                          </div>
                          {p.remarks && <p className="mt-1.5 text-[10px] italic text-slate-400">{p.remarks}</p>}
                          <div className="mt-2 flex items-center gap-1.5">
                            <VoucherThumbnail url={p.voucher_url} />
                            <div className="flex-1" />
                            <Button variant="outline" size="sm" className="h-7 border-slate-200 px-2 text-[11px] text-slate-600 hover:text-emerald-700" onClick={() => handlePrintReceipt(p, sheetAgent)}>
                              <Printer className="mr-1 h-3 w-3" /> Receipt
                            </Button>
                            {sheetEntry.isCurrent && canUpdate && (
                              <Button
                                variant="outline" size="sm"
                                className={`h-7 w-7 border-slate-200 p-0 ${p.customer_signature_url ? 'text-emerald-500' : 'text-slate-500 hover:text-violet-600'}`}
                                title={p.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}
                                onClick={() => { setAgentSheetId(null); setSignEntry({ payment: p, agent: sheetAgent }); }}
                              >
                                <PenLine className="h-3 w-3" />
                              </Button>
                            )}
                            {sheetEntry.isCurrent && canUpdate && (
                              <Button variant="outline" size="sm" className="h-7 w-7 border-slate-200 p-0 text-blue-600 hover:bg-blue-50" title="Edit entry" onClick={() => { setAgentSheetId(null); handleEditPayment(p); }}>
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                            {sheetEntry.isCurrent && canDelete && (
                              <Button variant="outline" size="sm" className="h-7 w-7 border-slate-200 p-0 text-red-600 hover:bg-red-50" title="Delete entry" onClick={() => { setAgentSheetId(null); setDeletePaymentId(p.id); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Record Payment Dialog ── */}
      <SignaturePad
        open={!!signEntry}
        onOpenChange={(o) => { if (!o) setSignEntry(null); }}
        onSave={async ({ customer, authority }) => {
          const { payment, agent } = signEntry;
          const sigPatch = { customer_signature_url: customer };
          if (authority) sigPatch.authority_signature_url = authority;
          await api.put(`/signatures/commission_payment/${payment.id}`, sigPatch);
          setSignEntry(null);
          fetchData();
          handlePrintReceipt({ ...payment, ...sigPatch }, agent);
        }}
        askAuthority={!nameSignOn()}
        signeeLabel={signEntry ? `Commission Payment #${signEntry.payment.id} · ₹${parseFloat(signEntry.payment.amount || 0).toLocaleString('en-IN')}` : ''}
      />

      <EntryDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        title="Record Payment"
        description={paymentAction === 'get'
          ? `Log money received back for Plot ${plot.plot_no}. This will reduce net paid amount.`
          : `Log a new payout installment for Plot ${plot.plot_no}.`}
        footer={
          <EntryFooter
            onCancel={() => setPaymentDialogOpen(false)}
            onSubmit={handlePaymentSubmit}
            submitting={submitLoading}
            disabled={!formData.amount}
            submitLabel={paymentAction === 'get' ? 'Save Money Received' : 'Save Payment'}
            submitClassName={paymentAction === 'get' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
          />
        }
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <CreditDebitTabs
            value={paymentAction === 'get' ? 'credit' : 'debit'}
            onChange={(v) => setPaymentAction(v === 'credit' ? 'get' : 'pay')}
            disabled={submitLoading}
            debitHint="Pay out commission"
            creditHint="Money received back"
          />
          <EntryRow>
            <EntryField label="Date">
              <Input type="date" value={formData.date} onChange={(e) => setFormData(v => ({ ...v, date: e.target.value }))} />
            </EntryField>
            <EntryField label="Payment Mode">
              <EntryModeChips
                value={formData.payment_mode}
                modes={['CASH', 'BANK', 'CHEQUE']}
                disabled={submitLoading}
                onChange={(m) => setFormData(v => ({
                  ...v,
                  payment_mode: m,
                  ...(m === 'CASH'
                    ? { bank_name: '', transaction_id: '', cheque_no: '' }
                    : m === 'BANK'
                      ? { cheque_no: '' }
                      : { bank_name: '', transaction_id: '' }),
                }))}
              />
            </EntryField>
          </EntryRow>
          <EntryAmount
            direction={paymentAction === 'get' ? 'credit' : 'debit'}
            label={paymentAction === 'get'
              ? `Amount (Max recoverable: ₹${formatCurrency(getAgentPaidAll(paymentCommissionId))})`
              : `Amount (Max due: ₹${formatCurrency(getAgentBalance(paymentCommissionId))})`}
            inputProps={{
              step: '0.01',
              placeholder: paymentAction === 'get' ? 'Enter received amount' : 'Enter payout amount',
              value: formData.amount,
              onChange: (e) => setFormData(v => ({ ...v, amount: e.target.value })),
              disabled: submitLoading,
            }}
          />
          {formData.payment_mode === 'CHEQUE' && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cheque Details</p>
              <EntryField label="Cheque Number">
                <Input placeholder="Enter cheque number" value={formData.cheque_no} onChange={(e) => setFormData(v => ({ ...v, cheque_no: e.target.value }))} disabled={submitLoading} />
              </EntryField>
            </div>
          )}
          {formData.payment_mode === 'BANK' && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bank Details</p>
              <EntryRow>
                <EntryField label="Bank Name">
                  <Input placeholder="e.g. ICICI" value={formData.bank_name} onChange={(e) => setFormData(v => ({ ...v, bank_name: e.target.value }))} disabled={submitLoading} />
                </EntryField>
                <EntryField label="Transaction ID">
                  <Input placeholder="TRN-00000" value={formData.transaction_id} onChange={(e) => setFormData(v => ({ ...v, transaction_id: e.target.value }))} disabled={submitLoading} />
                </EntryField>
              </EntryRow>
            </div>
          )}
          {approvers.length > 0 && (
            <EntryField label="Send To Admin For Approval">
              <Select value={formData.assigned_admin_id?.toString() || '_none'} onValueChange={(val) => setFormData(v => ({ ...v, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}>
                <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                  {approvers.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntryField>
          )}
          <EntryField label="Remarks">
            <Textarea placeholder="Optional context..." value={formData.remarks} onChange={(e) => setFormData(v => ({ ...v, remarks: e.target.value }))} className="min-h-[80px]" disabled={submitLoading} />
          </EntryField>
          <EntryField label="Transaction Proof (Image)">
            <div className="rounded-md border p-2">
              <VoucherUpload value={formData.voucher_url} onChange={(url) => setFormData(v => ({ ...v, voucher_url: url }))} disabled={submitLoading} />
            </div>
          </EntryField>
        </form>
      </EntryDialog>

      {/* ── Overpayment Confirmation ── */}
      <Dialog open={overpayConfirmOpen} onOpenChange={setOverpayConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </span>
              {paymentAction === 'get' ? 'High Recovery Warning' : 'Overpayment Warning'}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600">
              {paymentAction === 'get'
                ? `This amount exceeds total recorded payouts (₹${formatCurrency(getAgentPaidAll(paymentCommissionId))}). Confirm only if this adjustment is intentional.`
                : "You're paying more than this agent's remaining commission. This payment will be recorded and the agent marked as overpaid."}
            </DialogDescription>
          </DialogHeader>
          {paymentAction === 'pay' && (() => {
            const amt = Math.abs(parseFloat(formData.amount) || 0);
            const ag = findAnyAgent(paymentCommissionId);
            const commission = parseFloat(ag?.total_commission) || 0;
            const alreadyGiven = getAgentPaidAll(paymentCommissionId);
            const overpaidAmt = (alreadyGiven + amt) - commission;
            return (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-slate-600">Commission</span><span className="font-semibold text-slate-800 tabular-nums">₹{formatCurrency(commission)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Already given</span><span className="font-semibold text-slate-800 tabular-nums">₹{formatCurrency(alreadyGiven)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">This payment</span><span className="font-semibold text-slate-800 tabular-nums">+₹{formatCurrency(amt)}</span></div>
                <div className="mt-1 flex justify-between border-t border-red-200 pt-1.5">
                  <span className="font-semibold text-red-700">Overpaid by</span>
                  <span className="font-bold text-red-700 tabular-nums">₹{formatCurrency(overpaidAmt)}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOverpayConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setOverpayConfirmOpen(false); handlePaymentSubmit(new Event('submit')); }}>
              {paymentAction === 'get' ? 'Confirm High Recovery' : 'Confirm Overpayment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Payment Dialog ── */}
      <EntryDialog
        open={!!editingPayment}
        onOpenChange={(open) => { if (!open) setEditingPayment(null); }}
        title="Edit Entry"
        description="Update payout or money-received details."
        footer={
          <EntryFooter
            onCancel={() => setEditingPayment(null)}
            onSubmit={handleEditPaymentSubmit}
            submitting={editPaymentLoading}
            disabled={!editPaymentForm.amount}
            submitLabel="Update Entry"
            submitClassName={editPaymentForm.is_receive_entry ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
          />
        }
      >
        <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
          <CreditDebitTabs
            value={editPaymentForm.is_receive_entry ? 'credit' : 'debit'}
            onChange={(v) => setEditPaymentForm(f => ({ ...f, is_receive_entry: v === 'credit' }))}
            disabled={editPaymentLoading}
            debitHint="Pay out commission"
            creditHint="Money received back"
          />
          <EntryRow>
            <EntryField label="Date">
              <Input type="date" value={editPaymentForm.date} onChange={(e) => setEditPaymentForm(v => ({ ...v, date: e.target.value }))} />
            </EntryField>
            <EntryField label="Payment Mode">
              <EntryModeChips
                value={editPaymentForm.payment_mode}
                modes={['CASH', 'BANK', 'CHEQUE']}
                disabled={editPaymentLoading}
                onChange={(m) => setEditPaymentForm(v => ({
                  ...v,
                  payment_mode: m,
                  ...(m === 'CASH'
                    ? { bank_name: '', transaction_id: '', cheque_no: '' }
                    : m === 'BANK'
                      ? { cheque_no: '' }
                      : { bank_name: '', transaction_id: '' }),
                }))}
              />
            </EntryField>
          </EntryRow>
          <EntryAmount
            direction={editPaymentForm.is_receive_entry ? 'credit' : 'debit'}
            label={editPaymentForm.is_receive_entry ? 'Received Amount' : 'Payout Amount'}
            inputProps={{
              step: '0.01',
              value: editPaymentForm.amount,
              onChange: (e) => setEditPaymentForm(v => ({ ...v, amount: e.target.value })),
              disabled: editPaymentLoading,
            }}
          />
          {editPaymentForm.payment_mode === 'CHEQUE' && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cheque Details</p>
              <EntryField label="Cheque Number">
                <Input placeholder="Enter cheque number" value={editPaymentForm.cheque_no} onChange={(e) => setEditPaymentForm(v => ({ ...v, cheque_no: e.target.value }))} disabled={editPaymentLoading} />
              </EntryField>
            </div>
          )}
          {editPaymentForm.payment_mode === 'BANK' && (
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bank Details</p>
              <EntryRow>
                <EntryField label="Bank Name">
                  <Input placeholder="e.g. ICICI" value={editPaymentForm.bank_name} onChange={(e) => setEditPaymentForm(v => ({ ...v, bank_name: e.target.value }))} disabled={editPaymentLoading} />
                </EntryField>
                <EntryField label="Transaction ID">
                  <Input placeholder="TRN-00000" value={editPaymentForm.transaction_id} onChange={(e) => setEditPaymentForm(v => ({ ...v, transaction_id: e.target.value }))} disabled={editPaymentLoading} />
                </EntryField>
              </EntryRow>
            </div>
          )}
          {approvers.length > 0 && (
            <EntryField label="Assigned Admin">
              <Select value={editPaymentForm.assigned_admin_id?.toString() || '_none'} onValueChange={(val) => setEditPaymentForm(v => ({ ...v, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}>
                <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">- None -</SelectItem>
                  {approvers.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntryField>
          )}
          <EntryField label="Remarks">
            <Textarea placeholder="Optional context..." value={editPaymentForm.remarks} onChange={(e) => setEditPaymentForm(v => ({ ...v, remarks: e.target.value }))} className="min-h-[80px]" disabled={editPaymentLoading} />
          </EntryField>
          <EntryField label="Transaction Proof (Image)">
            <div className="rounded-md border p-2">
              <VoucherUpload value={editPaymentForm.voucher_url} onChange={(url) => setEditPaymentForm(v => ({ ...v, voucher_url: url }))} disabled={editPaymentLoading} />
            </div>
          </EntryField>
        </form>
      </EntryDialog>

      {/* ── Delete Payment Confirmation ── */}
      <Dialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </span>
              Delete Payment
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600">
              Are you sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletePaymentId(null)} disabled={deletePaymentLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={deletePaymentLoading}>
              {deletePaymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Commission Dialog ── */}
      <Dialog open={!!editCommission} onOpenChange={(open) => !open && setEditCommission(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Commission</DialogTitle>
            <DialogDescription>Update commission for {editCommission?.agent_name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCommissionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Total Commission Value</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="number" value={editCommissionForm.total_commission} onChange={(e) => setEditCommissionForm(v => ({ ...v, total_commission: e.target.value }))} className="pl-9 h-11" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Remarks</Label>
              <Input value={editCommissionForm.remarks} onChange={(e) => setEditCommissionForm(v => ({ ...v, remarks: e.target.value }))} className="h-11" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditCommission(null)} disabled={editCommissionLoading}>Cancel</Button>
              <Button type="submit" disabled={editCommissionLoading} className="bg-slate-900 border-none">
                {editCommissionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Commission Confirmation ── */}
      <Dialog open={!!deleteCommissionId} onOpenChange={(open) => !open && setDeleteCommissionId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" /> Delete Commission
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this agent's commission and ALL associated payments.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed font-medium">
              All historical ledger data and approved vouchers for this agent will be purged.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCommissionId(null)} disabled={deleteCommissionLoading}>Cancel</Button>
            <Button onClick={handleDeleteCommission} variant="destructive" disabled={deleteCommissionLoading}>
              {deleteCommissionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign New Agent Dialog ── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign New Agent</DialogTitle>
            <DialogDescription>Assign a new commission agent to Plot {plot.plot_no}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-2" ref={dropdownRef}>
              <Label className="text-xs font-semibold text-slate-600 uppercase">Agent (Receiver) *</Label>
              <div className="relative">
                {selectedClient ? (
                  <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-slate-50">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-800 truncate flex-1">{selectedClient.full_name}</span>
                    {selectedClient.phone && <span className="text-[11px] text-slate-400">{selectedClient.phone}</span>}
                    <button type="button" onClick={handleClearClient} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      ref={inputRef}
                      placeholder="Search by name or phone..."
                      value={clientQuery}
                      onChange={handleClientQueryChange}
                      onFocus={() => { if (clientQuery) setShowDropdown(true); }}
                      className="pl-9 pr-8 h-10"
                      autoComplete="off"
                    />
                    {clientLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                  </>
                )}
                {showDropdown && clientResults.length > 0 && !selectedClient && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-white shadow-lg">
                    {clientResults.map(client => (
                      <div
                        key={client.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm flex items-center justify-between"
                        onClick={() => handleSelectClient(client)}
                      >
                        <span className="font-medium">{client.full_name}</span>
                        {client.phone && <span className="text-[11px] text-slate-400">{client.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600 uppercase">Total Commission *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="number" min="1" step="0.01" placeholder="0.00" value={assignFormData.total_commission} onChange={(e) => setAssignFormData(v => ({ ...v, total_commission: e.target.value }))} className="pl-9 h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600 uppercase">Remarks</Label>
              <Input placeholder="Optional..." value={assignFormData.remarks} onChange={(e) => setAssignFormData(v => ({ ...v, remarks: e.target.value }))} className="h-10" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assignLoading}>Cancel</Button>
              <Button type="submit" disabled={assignLoading || !selectedClient || !assignFormData.total_commission}>
                {assignLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Manage Timeline Dialog (edit / delete any commission across sales) ── */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" /> Manage Plot Commissions
            </DialogTitle>
            <DialogDescription>
              Edit the commission amount or remove an agent on any sale of Plot {plot.plot_no}. Changes apply across the whole timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {manageBookings.map((b, bi) => (
              <div key={b.plot_id ?? bi} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <Badge variant="outline" className="px-1.5 py-0 text-[9px] uppercase border-indigo-200 bg-indigo-50 text-indigo-600">Sale {bi + 1}</Badge>
                  <Badge variant="outline" className="px-1 py-0 text-[8px] uppercase border-slate-200 bg-white text-slate-500">Buyer</Badge>
                  <span className="text-sm font-semibold text-slate-800">{b.buyer_name || '—'}</span>
                  {b.plot_id === viewedPlotId
                    ? <Badge variant="outline" className="px-1.5 py-0 text-[9px] text-blue-700 border-blue-200 bg-blue-50">VIEWING</Badge>
                    : (
                      <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[11px] text-slate-500 hover:text-slate-800" onClick={() => { setManageOpen(false); navigate(`/plot-commission/plot/${b.plot_id}?site_id=${siteId}`); }}>
                        <Search className="mr-1 h-3 w-3" /> Open
                      </Button>
                    )}
                </div>
                <div className="divide-y divide-slate-100">
                  {(b.agents_detail || []).length === 0 ? (
                    <p className="px-3 py-2.5 text-[11px] italic text-slate-400">No agents on this sale.</p>
                  ) : (b.agents_detail || []).map((a) => {
                    const isBuyer = b.buyer_name && a.agent_name && b.buyer_name.trim().toLowerCase() === a.agent_name.trim().toLowerCase();
                    return (
                      <div key={a.commission_id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                        <Badge variant="outline" className="px-1 py-0 text-[8px] uppercase border-cyan-200 bg-cyan-50 text-cyan-600">Agent</Badge>
                        <span className="text-sm font-medium text-slate-800">{a.agent_name}</span>
                        {isBuyer && <Badge variant="outline" className="px-1 py-0 text-[8px] uppercase border-indigo-200 bg-indigo-50 text-indigo-600">also buyer</Badge>}
                        <span className="text-[11px] tabular-nums text-slate-500">₹{formatCurrency(a.total_commission)}</span>
                        <span className="text-[11px] tabular-nums text-emerald-600">₹{formatCurrency(a.total_paid_all)} paid</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          {canUpdate && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-slate-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                setEditCommission({ commission_id: a.commission_id, agent_name: a.agent_name, total_commission: a.total_commission, remarks: a.remarks });
                                setEditCommissionForm({ total_commission: a.total_commission, remarks: a.remarks || '' });
                                setManageOpen(false);
                              }}
                            >
                              <Edit2 className="mr-1 h-3 w-3" /> Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-xs border-slate-200 text-red-600 hover:bg-red-50"
                              onClick={() => { setDeleteCommissionId(a.commission_id); setManageOpen(false); }}
                            >
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="pt-2">
            {canWrite && (
              <Button variant="outline" onClick={() => { setManageOpen(false); setAssignDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Assign New Agent
              </Button>
            )}
            <Button onClick={() => setManageOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlotCommissionDetail;
