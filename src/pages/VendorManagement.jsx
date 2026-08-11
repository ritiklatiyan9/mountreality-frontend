import { writePrintDocument } from '../lib/safePrint';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import VoucherUpload from '../components/VoucherUpload';
import UserAvatar from '../components/UserAvatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import VendorCell from '../components/inventory/VendorCell';
import ProcurementTimeline from '../components/inventory/ProcurementTimeline';
import VendorModuleTabs from '../components/inventory/VendorModuleTabs';
import { PageHeader, EmptyBlock, PRIMARY_BTN } from '../components/ui/page';
import { FinancialMetric, SkeletonBlock, EmptyState, StatusPill } from '../components/dashboard/primitives';
import BankAccountSelect from '../components/BankAccountSelect';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  AlertCircle,
  Check,
  IndianRupee,
  Plus,
  Store,
  Wallet,
  Loader2,
  Eye,
  UploadCloud,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Pencil,
  Trash2,
  X,
  MoreHorizontal,
  Search,
  UserPlus,
} from 'lucide-react';

const PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs', 'imps', 'other'];

const CASH_MODES = ['cash'];

const MODE_CHIP_COLORS = {
  cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bank: 'bg-blue-50 text-blue-700 border-blue-200',
  upi: 'bg-green-50 text-green-700 border-green-200',
  cheque: 'bg-teal-50 text-teal-700 border-teal-200',
  neft: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  rtgs: 'bg-sky-50 text-sky-700 border-sky-200',
  imps: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
};
const PAGE_LIMIT = 15;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const emptyCommitmentForm = {
  vendor_member_id: '',
  vendor_name: '',
  head_id: '',
  head_name: '',
  work_title: '',
  start_date: todayISO(),
  due_date: '',
  note: '',
  inventory_items: [{ item_name: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '', discount_amount: '' }],
};

const emptyInvItem = { item_name: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '', discount_amount: '' };

const calcItemAmounts = (item) => {
  const qty = parseFloat(item.qty_ordered) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const discPct = parseFloat(item.discount_pct) || 0;
  const discAmt = parseFloat(item.discount_amount) || 0;
  const discTotal = discPct > 0 ? gross * discPct / 100 : discAmt;
  return { gross: Math.round(gross * 100) / 100, net: Math.round((gross - discTotal) * 100) / 100 };
};

const emptyPaymentForm = {
  commitment_id: '',
  payment_date: todayISO(),
  amount: '',
  payment_mode: 'cash',
  bank_account_id: '',
  reference_no: '',
  note: '',
  voucher_url: '',
  assigned_admin_id: null,
};

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const statusTone = (status) => {
  if (status === 'closed') return 'positive';
  if (status === 'cancelled' || status === 'over-paid') return 'negative';
  return 'attention';
};

const VendorManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('vendors', 'write');
  const canUpdate = canManage && hasPermission('vendors', 'update');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId = currentSite?.id;

  const selection = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [vendorUsers, setVendorUsers] = useState([]);
  const [heads, setHeads] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [summary, setSummary] = useState({
    total_contracts: 0,
    total_contract_amount: 0,
    total_paid_amount: 0,
    total_remaining_amount: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });

  // Filter states (applied immediately via API)
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || 'all');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const searchTimeout = useRef(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [headDialogOpen, setHeadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [editForm, setEditForm] = useState({ vendor_name: '', head_id: '', head_name: '', work_title: '', start_date: '', due_date: '', note: '', contract_amount: '', status: 'open' });

  const [commitmentForm, setCommitmentForm] = useState({ ...emptyCommitmentForm });
  const [paymentForm, setPaymentForm] = useState({ ...emptyPaymentForm });
  const [headName, setHeadName] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCommitment, setSelectedCommitment] = useState(null);

  // Vendor dropdown: controlled open state (so the Register button can close it),
  // an in-dropdown search filter, and the Register-Vendor dialog + its form.
  const [vendorSelectOpen, setVendorSelectOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [registerVendorOpen, setRegisterVendorOpen] = useState(false);
  const [vendorRegForm, setVendorRegForm] = useState({ full_name: '', phone: '', business_name: '', service_type: '' });
  
  const displayCommitments = sortOrder === 'asc' ? [...commitments].reverse() : commitments;
  const visibleIds = displayCommitments.map((c) => c.id);

  // Debounce query input
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    setCategoryFilter(searchParams.get('category') || 'all');
  }, [searchParams]);

  const loadCommitments = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog: never let the loader hang past 15s if a request stalls.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const params = {
        site_id: siteId,
        page: currentPage,
        limit: PAGE_LIMIT,
      };
      if (debouncedQuery) params.search = debouncedQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.head_id = categoryFilter;

      const res = await api.get('/vendors/commitments', { params });
      setCommitments(res.data.commitments || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
      setSummary(res.data.summary || {});
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load commitments' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId, currentPage, debouncedQuery, statusFilter, categoryFilter]);

  // Background refresh — does NOT toggle the page-wide loader, used after
  // create / update / delete so the dialog can close instantly.
  const refreshCommitments = useCallback(async () => {
    if (!siteId) return;
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedQuery) params.search = debouncedQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.head_id = categoryFilter;
      const res = await api.get('/vendors/commitments', { params });
      setCommitments(res.data.commitments || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
      setSummary(res.data.summary || {});
    } catch { /* swallow — keep current data */ }
  }, [siteId, currentPage, debouncedQuery, statusFilter, categoryFilter]);

  const loadStaticData = useCallback(async () => {
    if (!siteId) return;
    try {
      const [usersRes, headsRes, approversRes] = await Promise.all([
        api.get('/vendors/users', { params: { site_id: siteId } }),
        api.get('/vendors/heads', { params: { site_id: siteId } }),
        api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
      ]);
      setVendorUsers(usersRes.data.vendors || []);
      setHeads(headsRes.data.heads || []);
      setApprovers(approversRes.data.approvers || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load page data' });
    }
  }, [siteId]);

  useEffect(() => {
    loadStaticData();
  }, [loadStaticData]);

  useEffect(() => {
    loadCommitments();
  }, [loadCommitments]);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const openCommitmentDialog = () => {
    setCommitmentForm({ ...emptyCommitmentForm, start_date: todayISO(), inventory_items: [{ ...emptyInvItem }] });
    setCommitmentDialogOpen(true);
  };

  const openEditDialog = (c) => {
    setEditingCommitment(c);
    setEditForm({
      vendor_name: c.vendor_name || '',
      head_id: String(c.head_id || ''),
      head_name: c.head_name || '',
      work_title: c.work_title || '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      due_date: c.due_date ? c.due_date.split('T')[0] : '',
      note: c.note || '',
      contract_amount: c.contract_amount || '',
      status: c.status || 'open',
    });
    setEditDialogOpen(true);
  };

  const handleEditCommitment = async () => {
    if (!editingCommitment || !siteId) return;
    setSubmitting(true);
    try {
      const head = heads.find((h) => String(h.id) === editForm.head_id);
      const { data } = await api.put(`/vendors/commitments/${editingCommitment.id}`, {
        site_id: siteId,
        vendor_name: editForm.vendor_name,
        head_id: editForm.head_id || null,
        head_name: head?.name || editForm.head_name,
        work_title: editForm.work_title,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        note: editForm.note,
        contract_amount: parseFloat(editForm.contract_amount) || 0,
        status: editForm.status,
      });
      // Optimistic in-place update so the dialog can close immediately.
      const updated = data?.commitment;
      if (updated) {
        setCommitments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      }
      setMessage({ type: 'success', text: 'Commitment updated' });
      setEditDialogOpen(false);
      refreshCommitments(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update commitment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCommitment = async (c) => {
    if (!window.confirm(`Delete commitment for "${c.vendor_name}"? This will also delete all its payments.`)) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = commitments;
    setCommitments((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await api.delete(`/vendors/commitments/${c.id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Commitment deleted' });
      refreshCommitments();
    } catch (err) {
      setCommitments(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const { data } = await api.post('/vendors/commitments/bulk-delete', { ids, site_id: siteId });
      setCommitments((prev) => prev.filter((c) => !(data?.deleted || ids).includes(c.id)));
      selection.clear();
      toast.success(data?.message || 'Commitments deleted');
      refreshCommitments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkPrint = () => {
    const selectedRows = commitments.filter((c) => selection.isSelected(c.id));
    if (selectedRows.length === 0) return;
    const rowsHtml = selectedRows.map((c) => `
      <tr>
        <td>${c.vendor_name || ''}</td>
        <td>${c.head_name || ''}<br/><span style="color:#64748b;font-size:11px;">${c.work_title || ''}</span></td>
        <td style="text-align:right;">₹${money(c.contract_amount)}</td>
        <td style="text-align:right;">₹${money(c.paid_amount)}</td>
        <td style="text-align:right;">₹${money(c.remaining_amount)}</td>
        <td style="text-align:center;text-transform:uppercase;">${c.status || ''}</td>
        <td>${c.created_by_name || ''}</td>
      </tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    writePrintDocument(win, `
      <html>
        <head>
          <title>Vendor Commitments — ${currentSite?.name || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            p { font-size: 12px; color: #64748b; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          </style>
        </head>
        <body>
          <h1>Vendor Commitments</h1>
          <p>${currentSite?.name || ''} — ${selectedRows.length} selected commitment${selectedRows.length === 1 ? '' : 's'}</p>
          <table>
            <thead>
              <tr>
                <th>Vendor</th><th>Category / Work</th><th style="text-align:right;">Contract</th>
                <th style="text-align:right;">Paid</th><th style="text-align:right;">Remaining</th>
                <th style="text-align:center;">Status</th><th>Created By</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const openPaymentDialog = (commitment) => {
    setPaymentForm({
      ...emptyPaymentForm,
      commitment_id: String(commitment.id),
      payment_date: todayISO(),
      amount: commitment.remaining_amount > 0 ? String(commitment.remaining_amount) : '',
    });
    setPaymentDialogOpen(true);
  };

  const onVendorMemberChange = (memberId) => {
    if (memberId === '_manual') {
      setCommitmentForm((prev) => ({ ...prev, vendor_member_id: '', vendor_name: '' }));
      return;
    }
    const vendor = vendorUsers.find((v) => String(v.id) === memberId);
    setCommitmentForm((prev) => ({
      ...prev,
      vendor_member_id: memberId,
      vendor_name: vendor?.full_name || '',
    }));
  };

  const onHeadChange = (headId) => {
    if (headId === '_manual') {
      setCommitmentForm((prev) => ({ ...prev, head_id: '', head_name: '' }));
      return;
    }
    const head = heads.find((h) => String(h.id) === headId);
    setCommitmentForm((prev) => ({
      ...prev,
      head_id: headId,
      head_name: head?.name || '',
    }));
  };

  const handleCreateHead = async () => {
    if (!siteId) return;
    if (!headName.trim()) {
      setMessage({ type: 'error', text: 'Head name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/vendors/heads', { site_id: siteId, name: headName.trim() });
      // Optimistic add — close dialog immediately.
      if (data?.head) setHeads((prev) => [...prev, data.head]);
      setMessage({ type: 'success', text: 'Vendor head created' });
      setHeadName('');
      setHeadDialogOpen(false);
      loadStaticData(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create head' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterVendor = async () => {
    if (!siteId) return;
    const fullName = vendorRegForm.full_name.trim();
    if (!fullName) {
      setMessage({ type: 'error', text: 'Vendor name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/vendors/users', {
        site_id: siteId,
        full_name: fullName,
        phone: vendorRegForm.phone.trim() || null,
        business_name: vendorRegForm.business_name.trim() || null,
        service_type: vendorRegForm.service_type.trim() || null,
      });
      const newVendor = data?.vendor;
      // Optimistic add + keep the dropdown list alphabetically sorted.
      if (newVendor) {
        setVendorUsers((prev) => {
          const next = [...prev.filter((v) => v.id !== newVendor.id), newVendor];
          next.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
          return next;
        });
        // Auto-select the freshly registered vendor on the commitment form.
        setCommitmentForm((p) => ({ ...p, vendor_member_id: String(newVendor.id), vendor_name: newVendor.full_name }));
      }
      setMessage({ type: 'success', text: 'Vendor registered' });
      setRegisterVendorOpen(false);
      setVendorRegForm({ full_name: '', phone: '', business_name: '', service_type: '' });
      loadStaticData(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to register vendor' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCommitment = async () => {
    if (!siteId) return;
    setSubmitting(true);
    try {
      const validItems = commitmentForm.inventory_items
        .filter((it) => it.item_name.trim() && parseFloat(it.qty_ordered) > 0)
        .map((it) => ({ ...it, item_category: commitmentForm.head_name || '' }));
      const totalNet = validItems.reduce((s, it) => s + calcItemAmounts(it).net, 0);
      if (totalNet <= 0) {
        setMessage({ type: 'error', text: 'Add at least one item with qty and rate' });
        setSubmitting(false);
        return;
      }
      await api.post('/vendors/commitments', {
        site_id: siteId,
        vendor_member_id: commitmentForm.vendor_member_id,
        vendor_name: commitmentForm.vendor_name,
        head_id: commitmentForm.head_id,
        head_name: commitmentForm.head_name,
        work_title: commitmentForm.work_title,
        start_date: commitmentForm.start_date || todayISO(),
        due_date: commitmentForm.due_date,
        note: commitmentForm.note,
        contract_amount: totalNet,
        inventory_items: validItems,
      });
      setMessage({ type: 'success', text: 'Vendor commitment created' });
      setCommitmentDialogOpen(false);
      // Refresh in background — the new commitment needs its computed paid /
      // remaining columns from the server, so we re-fetch instead of splicing.
      refreshCommitments();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create commitment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!siteId || !paymentForm.commitment_id) return;
    if (!CASH_MODES.includes(paymentForm.payment_mode) && !paymentForm.bank_account_id) {
      setMessage({ type: 'error', text: 'Select the bank account used for this transaction' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/vendors/commitments/${paymentForm.commitment_id}/payments`, {
        site_id: siteId,
        payment_date: paymentForm.payment_date || todayISO(),
        amount: parseFloat(paymentForm.amount) || 0,
        payment_mode: paymentForm.payment_mode,
        bank_account_id: paymentForm.bank_account_id || null,
        reference_no: paymentForm.reference_no,
        cheque_no: paymentForm.payment_mode === 'cheque' ? (paymentForm.reference_no || null) : null,
        note: paymentForm.note,
        voucher_url: paymentForm.voucher_url,
        assigned_admin_id: paymentForm.assigned_admin_id,
      });
      // Optimistic update — bump paid_amount on the commitment locally so the
      // table reflects the new total without waiting for a refetch.
      const paidDelta = parseFloat(paymentForm.amount) || 0;
      const targetId = parseInt(paymentForm.commitment_id);
      if (paidDelta > 0) {
        setCommitments((prev) => prev.map((c) => {
          if (c.id !== targetId) return c;
          const newPaid = (parseFloat(c.paid_amount) || 0) + paidDelta;
          const remaining = (parseFloat(c.contract_amount) || 0) - newPaid;
          return { ...c, paid_amount: newPaid, remaining_amount: remaining, payment_count: (c.payment_count || 0) + 1 };
        }));
      }
      setMessage({ type: 'success', text: 'Payment recorded successfully' });
      setPaymentDialogOpen(false);
      refreshCommitments(); // reconcile in background
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add payment' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentSite) {
    return <EmptyBlock icon={Store} title="Select a site to manage vendor commitments" tall />;
  }

  const { page, totalPages, total } = pagination;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem = Math.min(page * PAGE_LIMIT, total);

  const contractAmt = parseFloat(summary.total_contract_amount) || 0;
  const paidAmt = parseFloat(summary.total_paid_amount) || 0;
  const paidPct = contractAmt > 0 ? Math.min(100, (paidAmt / contractAmt) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-16">
      <PageHeader
        title="Vendors"
        description={`Supplier commitments, procurement and outstanding obligations · ${currentSite.name}`}
        actions={
          <>
            <BulkActionsBar
              count={selection.count}
              onClear={selection.clear}
              onEdit={canUpdate ? () => { const row = commitments.find((c) => selection.isSelected(c.id)); if (row) openEditDialog(row); } : undefined}
              onDelete={canDelete ? handleBulkDelete : undefined}
              onPrint={handleBulkPrint}
              entityLabel="commitment"
              deleting={bulkDeleting}
            />
            {canWrite && (
              <button type="button" className={PRIMARY_BTN} onClick={openCommitmentDialog}>
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Add commitment
              </button>
            )}
          </>
        }
      />

      <VendorModuleTabs active="commitments" className="mt-6" />

      {message.text && (
        <div className={`mt-5 flex items-center gap-2 rounded-control border p-3 text-[13px] ${message.type === 'success' ? 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink' : 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} /> : <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Financial control strip */}
      <dl className="mt-6 grid grid-cols-2 divide-x divide-mr-line border-b border-mr-line sm:grid-cols-4">
        <FinancialMetric label="Commitments" value={summary.total_contracts || 0} accent="blue" />
        <FinancialMetric label="Committed value" value={contractAmt} accent="blue" />
        <FinancialMetric label="Paid" value={paidAmt} accent="lime" hint={`${Math.round(paidPct)}% of committed`} />
        <FinancialMetric label="Outstanding" value={summary.total_remaining_amount} accent="amber" />
      </dl>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} />
          <Input
            placeholder="Search vendor, work, category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-control border-mr-line bg-mr-surface pl-8 pr-8 text-sm shadow-none focus-visible:border-mr-blue focus-visible:ring-2 focus-visible:ring-mr-blue/20"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mr-faint hover:text-mr-text">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-34 rounded-control border-mr-line bg-mr-surface text-sm shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-44 rounded-control border-mr-line bg-mr-surface text-sm font-medium shadow-none">
            <div className="flex items-center gap-1.5 truncate">
              <Store className="w-3 h-3 shrink-0 text-mr-faint" />
              <SelectValue placeholder="All Categories" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {heads.map((h) => (
              <SelectItem key={h.id} value={String(h.id)} className="text-[11px] font-medium">{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {total > 0 && (
          <span className="ml-auto text-xs text-mr-muted">
            {startItem}–{endItem} of {total} commitments
          </span>
        )}
      </div>

      {/* Commitments Table */}
      <section className="mt-5 border-t border-mr-line">
          {loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
            </div>
          ) : commitments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No vendor commitments found"
              description="Add the first commitment with a contract amount and start recording payments."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-mr-line bg-mr-surface-2/60">
                    <TableHead className="w-8" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={
                          selection.isAllSelected(visibleIds)
                            ? true
                            : selection.count > 0 && visibleIds.some((id) => selection.isSelected(id))
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={() => selection.toggleAll(visibleIds)}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1 text-[11px] uppercase tracking-wider font-semibold -ml-1">
                        Vendor <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Category / Work</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Contract</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Paid</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Remaining</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Created By</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCommitments.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer border-mr-line transition-colors duration-150 hover:bg-mr-surface-2/70"
                      onClick={() => navigate(`/vendors/${c.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selection.isSelected(c.id)}
                          onCheckedChange={() => selection.toggle(c.id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell>
                        <VendorCell name={c.vendor_name} photo={c.vendor_member_photo} secondary={c.vendor_member_name || 'Manual vendor'} />
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-semibold text-mr-text">{c.head_name}</p>
                        <p className="text-xs text-mr-muted">{c.work_title}</p>
                        <p className="text-[11px] text-mr-faint mt-0.5">
                          {c.payment_count ?? 0} payments
                          {(parseInt(c.inventory_item_count) || 0) > 0 && (
                            <span className="ml-1.5 text-mr-blue">· {c.inventory_item_count} items</span>
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-mr-text">₹{money(c.contract_amount)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-mr-lime-ink">₹{money(c.paid_amount)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-mr-coral-ink">
                        {parseFloat(c.remaining_amount) < 0 ? (
                          <span className="rounded bg-mr-coral-soft px-1 text-mr-coral-ink">Overpaid: ₹{money(Math.abs(c.remaining_amount))}</span>
                        ) : (
                          `₹${money(c.remaining_amount)}`
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <StatusPill tone={statusTone(parseFloat(c.remaining_amount) < 0 ? 'over-paid' : c.status)}>
                          {parseFloat(c.remaining_amount) < 0 ? 'over-paid' : c.status}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        <UserAvatar name={c.created_by_name} label="Created by" />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-mr-faint" aria-label={`Actions for ${c.vendor_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-[11px] text-mr-faint">Vendor actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedCommitment(c)}><Eye /> Quick view</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/vendors/${c.id}`)}><Eye /> Open full detail</DropdownMenuItem>
                            {canUpdate && <DropdownMenuItem onClick={() => openEditDialog(c)}><Pencil /> Edit commitment</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => openPaymentDialog(c)}><IndianRupee /> Record payment</DropdownMenuItem>
                            {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-mr-coral-ink focus:text-mr-coral-ink" onClick={() => handleDeleteCommitment(c)}><Trash2 /> Delete commitment</DropdownMenuItem></>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>      
          )}
        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-mr-line px-4 py-3">
            <span className="text-xs text-mr-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page number buttons (show up to 5 pages around current) */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className="text-xs text-slate-400 px-1">…</span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </Button>
                  )
                )}

              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Edit Commitment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Commitment</DialogTitle>
            <DialogDescription className="text-sm">Update commitment details. Inventory items can be managed from the detail page.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Vendor Name</Label>
              <Input value={editForm.vendor_name} onChange={(e) => setEditForm((p) => ({ ...p, vendor_name: e.target.value.toUpperCase() }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={editForm.head_id || '_none'} onValueChange={(v) => {
                const h = heads.find((x) => String(x.id) === v);
                setEditForm((p) => ({ ...p, head_id: v === '_none' ? '' : v, head_name: h?.name || p.head_name }));
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {heads.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Work Title</Label>
              <Input value={editForm.work_title} onChange={(e) => setEditForm((p) => ({ ...p, work_title: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contract Amount (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input type="number" min="0" step="0.01" value={editForm.contract_amount} onChange={(e) => setEditForm((p) => ({ ...p, contract_amount: e.target.value }))} className="pl-7 h-9 tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Due Date</Label>
              <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Input value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} className="h-9" placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleEditCommitment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={headDialogOpen} onOpenChange={setHeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Category</DialogTitle>
            <DialogDescription className="text-sm">Create custom work/payment category like CIVIL WORK, MATERIAL, CONTRACTOR LABOUR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category Name</Label>
            <Input value={headName} onChange={(e) => setHeadName(e.target.value.toUpperCase())} placeholder="CIVIL WORK" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setHeadDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateHead} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Vendor Dialog */}
      <Dialog open={registerVendorOpen} onOpenChange={setRegisterVendorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> Register Vendor</DialogTitle>
            <DialogDescription className="text-sm">Add a new vendor to this site. It becomes available in the vendor dropdown.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vendor Name *</Label>
              <Input value={vendorRegForm.full_name} onChange={(e) => setVendorRegForm((p) => ({ ...p, full_name: e.target.value.toUpperCase() }))} placeholder="VENDOR NAME" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={vendorRegForm.phone} onChange={(e) => setVendorRegForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Business Name</Label>
                <Input value={vendorRegForm.business_name} onChange={(e) => setVendorRegForm((p) => ({ ...p, business_name: e.target.value.toUpperCase() }))} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Service Type</Label>
              <Input value={vendorRegForm.service_type} onChange={(e) => setVendorRegForm((p) => ({ ...p, service_type: e.target.value }))} placeholder="e.g. CEMENT SUPPLIER (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setRegisterVendorOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleRegisterVendor} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
              Register Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Commitment Dialog */}
      <Dialog open={commitmentDialogOpen} onOpenChange={setCommitmentDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="px-5 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-base">Create Vendor Commitment</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">Add items below — contract amount auto-calculates from total.</DialogDescription>
            </DialogHeader>
          </div>

          {/* Vendor / Category / Title — compact strip */}
          <div className="px-5 pb-3 grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Vendor *</Label>
              {commitmentForm.vendor_member_id === '' && commitmentForm.vendor_name === '' ? (
                <Select
                  value=""
                  onValueChange={onVendorMemberChange}
                  open={vendorSelectOpen}
                  onOpenChange={(o) => { setVendorSelectOpen(o); if (!o) setVendorSearch(''); }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select or type manual" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Top row: search (half) + register (half). stopPropagation keeps
                        Radix's typeahead/selection from hijacking the input + button. */}
                    <div
                      className="sticky top-0 z-10 flex items-center gap-1.5 bg-popover p-1.5 border-b border-slate-100"
                      onPointerDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="relative w-1/2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <Input
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          placeholder="Search vendor"
                          className="h-7 text-xs pl-6"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 w-1/2 text-xs"
                        onClick={() => { setVendorSelectOpen(false); setRegisterVendorOpen(true); }}
                      >
                        <UserPlus className="w-3 h-3 mr-1" /> Register
                      </Button>
                    </div>
                    {(() => {
                      const q = vendorSearch.trim().toLowerCase();
                      const filtered = q
                        ? vendorUsers.filter((v) =>
                            (v.full_name || '').toLowerCase().includes(q) ||
                            (v.business_name || '').toLowerCase().includes(q))
                        : vendorUsers;
                      if (filtered.length === 0) {
                        return <div className="px-2 py-3 text-center text-xs text-slate-400">No vendors match</div>;
                      }
                      return filtered.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.full_name}{v.business_name ? ` · ${v.business_name}` : ''}
                        </SelectItem>
                      ));
                    })()}
                    <SelectItem value="_manual">✎ Type manually</SelectItem>
                  </SelectContent>
                </Select>
              ) : commitmentForm.vendor_member_id ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 truncate">
                    {commitmentForm.vendor_name}
                  </div>
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, vendor_member_id: '', vendor_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input value={commitmentForm.vendor_name} onChange={(e) => setCommitmentForm((p) => ({ ...p, vendor_name: e.target.value.toUpperCase() }))} placeholder="VENDOR NAME" className="h-8 text-xs" autoFocus />
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, vendor_member_id: '', vendor_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Category *</Label>
              {commitmentForm.head_id === '' && commitmentForm.head_name === '' ? (
                <Select value="" onValueChange={onHeadChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select or type new" />
                  </SelectTrigger>
                  <SelectContent>
                    {heads.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                    <SelectItem value="_manual">✎ Type new category</SelectItem>
                  </SelectContent>
                </Select>
              ) : commitmentForm.head_id ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 truncate">
                    {commitmentForm.head_name}
                  </div>
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, head_id: '', head_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input value={commitmentForm.head_name} onChange={(e) => setCommitmentForm((p) => ({ ...p, head_name: e.target.value.toUpperCase() }))} placeholder="NEW CATEGORY" className="h-8 text-xs" autoFocus />
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, head_id: '', head_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Start Date</Label>
              <Input type="date" value={commitmentForm.start_date} onChange={(e) => setCommitmentForm((p) => ({ ...p, start_date: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Work Title *</Label>
              <Input value={commitmentForm.work_title} onChange={(e) => setCommitmentForm((p) => ({ ...p, work_title: e.target.value }))} placeholder="Cement supply for Block A" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Note</Label>
              <Input value={commitmentForm.note} onChange={(e) => setCommitmentForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" className="h-8 text-xs" />
            </div>
          </div>

          {/* ── Items Table ─────────────────────── */}
          <div className="border-t border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold px-3 py-2 w-8">#</th>
                    <th className="text-left font-semibold px-2 py-2">Item Name *</th>
                    <th className="text-right font-semibold px-2 py-2 w-20">Qty *</th>
                    <th className="text-left font-semibold px-2 py-2 w-16">Unit</th>
                    <th className="text-right font-semibold px-2 py-2 w-24">Rate ₹ *</th>
                    <th className="text-right font-semibold px-2 py-2 w-16">Disc%</th>
                    <th className="text-right font-semibold px-2 py-2 w-28">Net ₹</th>
                    <th className="text-center font-semibold px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commitmentForm.inventory_items.map((item, idx) => {
                    const amounts = calcItemAmounts(item);
                    const updateItem = (field, value) => {
                      setCommitmentForm((prev) => {
                        const items = [...prev.inventory_items];
                        items[idx] = { ...items[idx], [field]: value };
                        if (field === 'discount_pct' && parseFloat(value)) items[idx].discount_amount = '';
                        if (field === 'discount_amount' && parseFloat(value)) items[idx].discount_pct = '';
                        return { ...prev, inventory_items: items };
                      });
                    };
                    const removeItem = () => {
                      setCommitmentForm((prev) => ({
                        ...prev,
                        inventory_items: prev.inventory_items.length <= 1
                          ? [{ ...emptyInvItem }]
                          : prev.inventory_items.filter((_, i) => i !== idx),
                      }));
                    };

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <Input value={item.item_name} onChange={(e) => updateItem('item_name', e.target.value)} placeholder="Cement, Bricks, Sand..." className="h-7 text-xs border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" value={item.qty_ordered} onChange={(e) => updateItem('qty_ordered', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input value={item.unit} onChange={(e) => updateItem('unit', e.target.value)} className="h-7 text-xs border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" step="0.01" value={item.rate} onChange={(e) => updateItem('rate', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" step="0.01" value={item.discount_pct} onChange={(e) => updateItem('discount_pct', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-800 tabular-nums">
                          {amounts.net > 0 ? `₹${money(amounts.net)}` : '—'}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <button type="button" onClick={removeItem} className="text-slate-300 hover:text-red-500 transition-colors p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add row + Total strip */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                onClick={() => setCommitmentForm((prev) => ({
                  ...prev,
                  inventory_items: [...prev.inventory_items, { ...emptyInvItem }],
                }))}
              >
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
              {(() => {
                const totalGross = commitmentForm.inventory_items.reduce((s, it) => s + calcItemAmounts(it).gross, 0);
                const totalNet = commitmentForm.inventory_items.reduce((s, it) => s + calcItemAmounts(it).net, 0);
                const totalDisc = totalGross - totalNet;
                return (
                  <div className="flex items-center gap-4 text-xs">
                    {totalDisc > 0 && <span className="text-orange-500">Disc: -₹{money(totalDisc)}</span>}
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                      <span className="text-slate-600 font-medium">Contract Amount</span>
                      <span className="text-lg font-bold text-emerald-700 tabular-nums">₹{money(totalNet)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="px-5 pb-4 pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCommitmentDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateCommitment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create Commitment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Add Vendor Payment</DialogTitle>
            <DialogDescription className="text-sm">Record payment made to vendor. Remaining amount updates automatically.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="50000"
                    className="pl-9 text-lg h-11 font-bold tabular-nums border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700"
                  />
                </div>
                {paymentForm.amount && (
                  <p className="text-[10px] font-medium text-emerald-500">
                    ₹{(parseFloat(paymentForm.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} will be deducted
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            {/* Payment Mode chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Mode</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m} type="button"
                    onClick={() => setPaymentForm((prev) => ({ ...prev, payment_mode: m, reference_no: CASH_MODES.includes(m) ? '' : prev.reference_no }))}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${paymentForm.payment_mode === m
                      ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                      : MODE_CHIP_COLORS[m] || 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <BankAccountSelect
              value={paymentForm.bank_account_id}
              onChange={(bankAccountId) => setPaymentForm((form) => ({ ...form, bank_account_id: bankAccountId }))}
              paymentMode={paymentForm.payment_mode}
            />

            {/* Bank-only: Reference No */}
            {!CASH_MODES.includes(paymentForm.payment_mode) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / UTR / Cheque No</Label>
                <Input
                  value={paymentForm.reference_no}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference_no: e.target.value.toUpperCase() }))}
                  placeholder="UTR / CHQ / TXN NO"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea
                rows={2}
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Payment milestone or remark"
                className="resize-none"
              />
            </div>

            {approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign To Admin</Label>
                <Select
                  value={paymentForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setPaymentForm((prev) => ({ ...prev, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select approver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Auto-assign —</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <VoucherUpload
              value={paymentForm.voucher_url || null}
              onChange={(url) => setPaymentForm((prev) => ({ ...prev, voucher_url: url || '' }))}
            />
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleAddPayment} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5">
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5 mr-1.5" />}
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedCommitment} onOpenChange={(open) => !open && setSelectedCommitment(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="shrink-0 border-b border-slate-100 px-6 py-5 text-left">
            <div className="pr-6"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Commitment overview</p><div className="mt-3"><VendorCell name={selectedCommitment?.vendor_name} photo={selectedCommitment?.vendor_member_photo} secondary={selectedCommitment?.vendor_member_name || 'Manual vendor'} /></div><SheetTitle className="sr-only">{selectedCommitment?.vendor_name || 'Vendor commitment'}</SheetTitle><SheetDescription className="mt-3">{selectedCommitment?.work_title || 'Vendor commitment'} · {selectedCommitment?.head_name || 'Uncategorised'}</SheetDescription></div>
          </SheetHeader>
          {selectedCommitment && <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div className="flex items-center justify-between border-b border-mr-line pb-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Outstanding</p><p className="mt-1 text-xl font-semibold tabular-nums text-mr-text">₹{money(selectedCommitment.remaining_amount)}</p></div><StatusPill tone={statusTone(selectedCommitment.status)}>{selectedCommitment.status}</StatusPill></div>
            <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Commitment flow</h3><ProcurementTimeline vertical stages={[{ label: 'Commitment created', status: 'complete', detail: selectedCommitment.start_date ? `Starts ${selectedCommitment.start_date.split('T')[0]}` : 'Vendor obligation recorded' }, { label: 'Purchase items', status: Number(selectedCommitment.inventory_item_count) > 0 ? 'complete' : 'pending', detail: `${selectedCommitment.inventory_item_count || 0} linked items` }, { label: 'Payments', status: Number(selectedCommitment.paid_amount) > 0 && Number(selectedCommitment.remaining_amount) > 0 ? 'current' : (Number(selectedCommitment.remaining_amount) <= 0 ? 'complete' : 'pending'), detail: `₹${money(selectedCommitment.paid_amount)} paid` }, { label: 'Close', status: selectedCommitment.status === 'closed' ? 'complete' : 'pending', detail: selectedCommitment.status === 'closed' ? 'Closed' : 'Requires final reconciliation' }]} /></section>
            <section className="border-t border-slate-100 pt-5"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Financial summary</h3><div className="grid grid-cols-3 gap-4 text-sm"><div><p className="text-[11px] text-slate-400">Contract</p><p className="mt-1 font-semibold">₹{money(selectedCommitment.contract_amount)}</p></div><div><p className="text-[11px] text-slate-400">Paid</p><p className="mt-1 font-semibold text-emerald-700">₹{money(selectedCommitment.paid_amount)}</p></div><div><p className="text-[11px] text-slate-400">Items</p><p className="mt-1 font-semibold">{selectedCommitment.inventory_item_count || 0}</p></div></div></section>
            {selectedCommitment.note && <p className="border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600">{selectedCommitment.note}</p>}
          </div>}
          <SheetFooter className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 sm:justify-between"><Button variant="ghost" size="sm" onClick={() => selectedCommitment && navigate(`/vendors/${selectedCommitment.id}`)}>Open full detail</Button>{selectedCommitment && canWrite && <Button size="sm" onClick={() => { openPaymentDialog(selectedCommitment); setSelectedCommitment(null); }}><IndianRupee className="mr-1.5 h-4 w-4" /> Record payment</Button>}</SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default VendorManagement;
