import { writePrintDocument } from '../lib/safePrint';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2, Eye, X,
  IndianRupee, ArrowLeft, Lock, Unlock, MoreHorizontal,
  Printer, ArrowUp, ArrowDown, ArrowUpDown, User, Building2, ArrowUpRight, ArrowDownRight,
  BarChart3, Wallet, Landmark, TrendingUp, TrendingDown, PenLine, Download, ChevronsUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SignaturePad from '../components/SignaturePad';
import CreditDebitTabs from '../components/CreditDebitTabs';
import { EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips, EntryParticular, getParticularsForMode } from '../components/EntryModal';
import { printCashReceipt } from '../lib/cashReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn, CUSTOMER_SIGN_CSS } from '../lib/receiptSignature';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';
import { toast } from 'sonner';
import { useRowSelection } from '../hooks/useRowSelection';
import BulkActionsBar from '../components/BulkActionsBar';
import BankAccountSelect from '../components/BankAccountSelect';
import { classifyPaymentMode } from '../utils/paymentMode';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const todayISO = () => new Date().toISOString().split('T')[0];

// Keep raw signed values intact for persistence/editing, but account and show
// reversals on the opposite positive side. This preserves debit-credit net.
const accountedAmounts = (entry) => {
  const rawDebit = Number.parseFloat(entry?.debit);
  const rawCredit = Number.parseFloat(entry?.credit);
  const debit = Number.isFinite(rawDebit) ? rawDebit : 0;
  const credit = Number.isFinite(rawCredit) ? rawCredit : 0;
  return {
    debit: Math.max(debit, 0) + Math.max(-credit, 0),
    credit: Math.max(credit, 0) + Math.max(-debit, 0),
  };
};

// Single-select filter chips — "All" + options. Matches the Plot Commission list styling.
const FilterChips = ({ label, value, onChange, options }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    {label && <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">{label}:</span>}
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            active
              ? (opt.activeClass || 'bg-slate-800 text-white border-slate-800')
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {opt.label}{opt.count !== undefined ? ` (${opt.count})` : ''}
        </button>
      );
    })}
  </div>
);

const CashFlow = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { currentSite, isAdmin, canManage, hasPermission, user } = useAuth();
  const canWrite  = canManage && hasPermission('cashflow', 'write');
  const canUpdate = canManage && hasPermission('cashflow', 'update');
  const canDelete = canManage && hasPermission('cashflow', 'delete');
  const siteId = currentSite?.id;
  const location = useLocation();
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  // ── State ──
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  // List-view row selection — when non-empty, the totals row sums only the
  // selected ledgers (quick ad-hoc comparison without leaving the page).
  const [selectedLedgerIds, setSelectedLedgerIds] = useState(() => new Set());
  // Detail-view row selection — separate from selectedLedgerIds above, which
  // is the unrelated /cashflow list-view ledger-card selection.
  const entrySelection = useRowSelection();
  const clearEntrySelection = entrySelection.clear;
  const [bulkDeletingEntries, setBulkDeletingEntries] = useState(false);
  const [entries, setEntries] = useState([]);
  const [signEntry, setSignEntry] = useState(null);
  const [firms, setFirms] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [ledgerMembers, setLedgerMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFirms, setLoadingFirms] = useState(false);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // Detail-view entry filters
  const [typeFilter, setTypeFilter] = useState('all');          // all | cash | bank | cheque
  const [flowFilter, setFlowFilter] = useState('all');          // all | debit | credit
  const [statusEntryFilter, setStatusEntryFilter] = useState('all'); // all | pending | approved | rejected

  // List-view filters — persisted so they survive opening a ledger and coming back.
  const LIST_FILTERS_KEY = 'cashflow.listFilters';
  const savedListFilters = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(LIST_FILTERS_KEY)) || {}; } catch { return {}; }
  }, []);
  const [ledgerSearch, setLedgerSearch] = useState(savedListFilters.search || '');
  const [statusFilter, setStatusFilter] = useState(savedListFilters.status || 'all');   // all | active | locked
  const [balanceFilter, setBalanceFilter] = useState(savedListFilters.balance || 'all'); // all | receive | give | settled
  const [ledgerSort, setLedgerSort] = useState(savedListFilters.sort || 'name-asc');     // name-asc | name-desc | pending-desc | given-desc
  const [editingLedgerId, setEditingLedgerId] = useState(null);

  useEffect(() => {
    sessionStorage.setItem(LIST_FILTERS_KEY, JSON.stringify({
      search: ledgerSearch, status: statusFilter, balance: balanceFilter, sort: ledgerSort,
    }));
  }, [ledgerSearch, statusFilter, balanceFilter, ledgerSort]);

  const listFiltersActive = ledgerSearch || statusFilter !== 'all' || balanceFilter !== 'all' || ledgerSort !== 'name-asc';
  const clearListFilters = () => {
    setLedgerSearch(''); setStatusFilter('all'); setBalanceFilter('all'); setLedgerSort('name-asc');
  };

  // Ledger form (for creating new person ledger)
  const [ledgerForm, setLedgerForm] = useState({
    ledger_name: '',
    linked_user_id: '',
    linked_member_id: '',
  });
  const [ledgerPersonSearch, setLedgerPersonSearch] = useState('');
  const [ledgerPersonOpen, setLedgerPersonOpen] = useState(false);

  // Entry form
  const [entryForm, setEntryForm] = useState({
    date: todayISO(),
    particular: 'CASH',
    debit: '',
    credit: '',
    remarks: '',
    cash_type: 'cash',
    bank_account_id: '',
    voucher_url: '',
    is_firm_transaction: false,
    from_firm_id: '',
    to_mode: 'name',
    to_firm_id: '',
    to_name: '',
    assigned_admin_id: null,
  });
  // UI-only direction for the entry dialog; payload still uses debit/credit fields.
  const [entryDirection, setEntryDirection] = useState('credit');

  const fetchFirms = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoadingFirms(true);
      const res = await api.get(`/cashflow/firms?site_id=${siteId}`);
      setFirms(res.data.firms || []);
    } catch {
      setFirms([]);
    } finally {
      setLoadingFirms(false);
    }
  }, [siteId]);

  // ── Fetch person-wise ledgers ──
  const fetchLedgers = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/cashflow/months?site_id=${siteId}`);
      clearTimeout(watchdog);
      // Get all ledgers and filter for person-based only
      const allLedgers = res.data.months || [];
      const personLedgers = allLedgers.filter(m => m.ledger_type === 'person');
      setLedgers(personLedgers);
    } catch (err) {
      console.error('Failed to fetch ledgers:', err);
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Background refresh for ledgers (no loader toggle).
  const refreshLedgers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/cashflow/months?site_id=${siteId}`);
      const personLedgers = (res.data.months || []).filter((m) => m.ledger_type === 'person');
      setLedgers(personLedgers);
    } catch { /* keep current */ }
  }, [siteId]);

  // ── Fetch entries for selected ledger ──
  const fetchEntries = useCallback(async () => {
    if (!selectedLedger) return;
    try {
      setLoading(true);
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const entriesRes = await api.get(`/cashflow/entries?month_id=${selectedLedger.id}`);
      clearTimeout(watchdog);
      setEntries(entriesRes.data.entries || []);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLedger]);

  // Background refresh — does NOT toggle the page loader.
  const refreshEntries = useCallback(async () => {
    if (!selectedLedger) return;
    try {
      const res = await api.get(`/cashflow/entries?month_id=${selectedLedger.id}`);
      setEntries(res.data.entries || []);
    } catch { /* keep current */ }
  }, [selectedLedger]);

  useEffect(() => {
    setEntries([]);
    setSearchQuery(queryFromUrl);
    fetchLedgers();
    fetchFirms();
  }, [fetchLedgers, fetchFirms, queryFromUrl]);

  useEffect(() => {
    const q = queryFromUrl.trim().toLowerCase();
    if (!q || !ledgers.length) return;

    const exact = ledgers.find((l) => (l.ledger_name || '').toLowerCase() === q);
    const partial = ledgers.find((l) => (l.ledger_name || '').toLowerCase().includes(q));
    const matched = exact || partial;

    if (matched) {
      setSelectedLedger((prev) => (prev?.id === matched.id ? prev : matched));
    }
  }, [queryFromUrl, ledgers]);

  useEffect(() => {
    if (!ledgers.length) return;
    if (!ledgerId) {
      setSelectedLedger(null);
      return;
    }

    const matched = ledgers.find((l) => String(l.id) === String(ledgerId));
    if (matched) {
      setSelectedLedger((prev) => (prev?.id === matched.id ? prev : matched));
    }
  }, [ledgerId, ledgers]);

  useEffect(() => {
    if (!siteId) return;
    Promise.allSettled([
      api.get(`/admin/approvers?site_id=${siteId}`),
      api.get('/members', { params: { site_id: siteId } }),
    ]).then(([usersResult, membersResult]) => {
      setApprovers(usersResult.status === 'fulfilled' ? usersResult.value.data.approvers || [] : []);
      const members = membersResult.status === 'fulfilled' ? membersResult.value.data.members || [] : [];
      setLedgerMembers(members.filter((member) => member.status === 'ACTIVE'));
    });
  }, [siteId]);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  useEffect(() => {
    if (selectedLedger) fetchEntries();
  }, [selectedLedger, fetchEntries]);

  // Keep selections inside the current ledger only. Selections deliberately
  // survive filtering, but must never carry into another person's ledger.
  useEffect(() => {
    clearEntrySelection();
  }, [selectedLedger?.id, clearEntrySelection]);

  // ── Ledger form handlers ──
  const resetLedgerForm = () => {
    setLedgerForm({
      ledger_name: '',
      linked_user_id: '',
      linked_member_id: '',
    });
    setLedgerPersonSearch('');
    setLedgerPersonOpen(false);
    setEditingLedgerId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateLedger = () => {
    resetLedgerForm();
    setLedgerDialogOpen(true);
  };

  const handleOpenEditLedger = (ledger) => {
    setLedgerForm({
      ledger_name: ledger.ledger_name || '',
      linked_user_id: ledger.linked_user_id ? String(ledger.linked_user_id) : '',
      linked_member_id: ledger.linked_member_id ? String(ledger.linked_member_id) : '',
    });
    setLedgerPersonSearch('');
    setEditingLedgerId(ledger.id);
    setMessage({ type: '', text: '' });
    setLedgerDialogOpen(true);
  };

  const matchesLedgerPersonSearch = (person, source) => {
    const query = ledgerPersonSearch.trim().toLowerCase();
    if (!query) return true;
    const values = source === 'user'
      ? [person.name, person.email, person.phone, person.role]
      : [person.full_name, person.father_name, person.email, person.phone, person.member_type, person.city];
    return values.some((value) => String(value || '').toLowerCase().includes(query));
  };

  const selectLedgerPerson = (source, id) => {
    const selectedUser = source === 'user' ? approvers.find((item) => String(item.id) === String(id)) : null;
    const selectedMember = source === 'member' ? ledgerMembers.find((item) => String(item.id) === String(id)) : null;
    const selectedName = selectedUser?.name || selectedMember?.full_name;
    setLedgerForm((prev) => ({
      ...prev,
      linked_user_id: source === 'user' ? String(id) : '',
      linked_member_id: source === 'member' ? String(id) : '',
      ledger_name: selectedName ? selectedName.toUpperCase() : prev.ledger_name,
    }));
    setLedgerPersonSearch('');
    setLedgerPersonOpen(false);
  };

  const selectedLedgerPersonLabel = ledgerForm.linked_user_id
    ? approvers.find((item) => String(item.id) === ledgerForm.linked_user_id)?.name
      || ledgers.find((item) => item.id === editingLedgerId)?.linked_user_name
      || `Mapped user #${ledgerForm.linked_user_id}`
    : ledgerForm.linked_member_id
      ? ledgerMembers.find((item) => String(item.id) === ledgerForm.linked_member_id)?.full_name
        || ledgers.find((item) => item.id === editingLedgerId)?.linked_member_name
        || `Mapped client #${ledgerForm.linked_member_id}`
      : '';

  const handleDeleteLedger = async (ledger) => {
    if (!window.confirm(`Delete ledger "${ledger.ledger_name}" and all its entries? This cannot be undone.`)) return;
    const snapshot = ledgers;
    setLedgers((prev) => prev.filter((l) => l.id !== ledger.id)); // optimistic
    try {
      await api.delete(`/cashflow/months/${ledger.id}`);
      refreshLedgers();
    } catch (err) {
      setLedgers(snapshot);
      window.alert(err.response?.data?.message || 'Failed to delete ledger');
    }
  };

  const handleSubmitLedger = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!ledgerForm.ledger_name.trim()) {
      setMessage({ type: 'error', text: 'Please enter person/entity name' });
      return;
    }
    if (!ledgerForm.linked_user_id && !ledgerForm.linked_member_id) {
      setMessage({ type: 'error', text: 'Please select a User Management account or client' });
      return;
    }

    // ── Edit (rename) existing ledger ──
    if (editingLedgerId) {
      setSubmitting(true);
      const newName = ledgerForm.ledger_name.trim().toUpperCase();
      try {
        const { data } = await api.put(`/cashflow/months/${editingLedgerId}`, {
          ledger_name: newName,
          linked_user_id: ledgerForm.linked_user_id ? Number(ledgerForm.linked_user_id) : null,
          linked_member_id: ledgerForm.linked_member_id ? Number(ledgerForm.linked_member_id) : null,
        });
        setLedgers((prev) => prev.map((l) => (l.id === editingLedgerId ? { ...l, ...(data?.month || {}), ledger_name: newName } : l)));
        setSelectedLedger((prev) => (prev?.id === editingLedgerId ? { ...prev, ...(data?.month || {}), ledger_name: newName } : prev));
        setLedgerDialogOpen(false);
        resetLedgerForm();
        refreshLedgers();
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to rename ledger' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const currentDate = new Date();
      const payload = {
        site_id: siteId,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        opening_balance: 0,
        notes: '',
        ledger_type: 'person',
        ledger_name: ledgerForm.ledger_name.toUpperCase(),
        linked_user_id: ledgerForm.linked_user_id ? Number(ledgerForm.linked_user_id) : null,
        linked_member_id: ledgerForm.linked_member_id ? Number(ledgerForm.linked_member_id) : null,
      };
      const { data } = await api.post('/cashflow/months', payload);
      // Optimistic prepend — close dialog instantly; refresh in background.
      if (data?.month) {
        setLedgers((prev) => [
          {
            ...data.month,
            total_debit: 0, total_credit: 0,
            cash_given: 0, cash_received: 0,
            bank_given: 0, bank_received: 0,
            entry_count: 0,
          },
          ...prev,
        ]);
      }
      setMessage({ type: 'success', text: 'Person ledger created. You can now add entries from any date.' });
      setLedgerDialogOpen(false);
      refreshLedgers(); // reconcile with server-computed totals
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create ledger' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Entry form handlers ──
  const resetEntryForm = () => {
    setEntryForm({
      date: todayISO(),
      particular: 'CASH',
      debit: '',
      credit: '',
      remarks: '',
      cash_type: 'cash',
      bank_account_id: '',
      voucher_url: '',
      is_firm_transaction: false,
      from_firm_id: '',
      to_mode: 'name',
      to_firm_id: '',
      to_name: '',
      assigned_admin_id: null,
    });
    setEntryDirection('credit');
    setEditingEntryId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateEntry = () => {
    resetEntryForm();
    setEntryDialogOpen(true);
  };

  const handleOpenEditEntry = (e) => {
    setEntryForm({
      date: e.date ? e.date.split('T')[0] : '',
      particular: e.particular || '',
      debit: e.debit && parseFloat(e.debit) !== 0 ? String(e.debit) : '',
      credit: e.credit && parseFloat(e.credit) !== 0 ? String(e.credit) : '',
      remarks: e.remarks || '',
      cash_type: e.cash_type || 'bank',
      bank_account_id: e.bank_account_id ? String(e.bank_account_id) : '',
      voucher_url: e.voucher_url || '',
      is_firm_transaction: !!e.is_firm_transaction,
      from_firm_id: e.from_firm_id ? String(e.from_firm_id) : '',
      to_mode: e.to_firm_id ? 'firm' : 'name',
      to_firm_id: e.to_firm_id ? String(e.to_firm_id) : '',
      to_name: e.to_name || '',
      assigned_admin_id: e.assigned_admin_id || null,
    });
    // Keep the raw signed side visible when editing historical reversals.
    setEntryDirection((parseFloat(e.debit) || 0) !== 0 ? 'debit' : 'credit');
    setEditingEntryId(e.id);
    setEntryDialogOpen(true);
  };

  const handleSubmitEntry = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });

    if (entryForm.is_firm_transaction) {
      if (!entryForm.from_firm_id) {
        setMessage({ type: 'error', text: 'Please select From Firm' });
        return;
      }
      if (entryForm.to_mode === 'firm' && !entryForm.to_firm_id) {
        setMessage({ type: 'error', text: 'Please select To Firm' });
        return;
      }
      if (entryForm.to_mode === 'name' && !entryForm.to_name.trim()) {
        setMessage({ type: 'error', text: 'Please enter To Name' });
        return;
      }
    }
    if (classifyPaymentMode(entryForm.cash_type) !== 'cash' && !entryForm.bank_account_id) {
      setMessage({ type: 'error', text: 'Select the bank account used for this entry' });
      return;
    }

    const currentDate = todayISO();
    const payload = {
      cash_flow_month_id: selectedLedger.id,
      date: entryForm.date || currentDate,
      particular: entryForm.particular,
      debit: parseFloat(entryForm.debit) || 0,
      credit: parseFloat(entryForm.credit) || 0,
      remarks: entryForm.remarks,
      cash_type: entryForm.cash_type,
      bank_account_id: entryForm.bank_account_id || null,
      cheque_no: entryForm.cash_type === 'cheque' ? (entryForm.cheque_no || null) : null,
      voucher_url: entryForm.voucher_url || null,
      is_firm_transaction: entryForm.is_firm_transaction,
      from_firm_id: entryForm.is_firm_transaction && entryForm.from_firm_id ? parseInt(entryForm.from_firm_id) : null,
      to_firm_id: entryForm.is_firm_transaction && entryForm.to_mode === 'firm' && entryForm.to_firm_id ? parseInt(entryForm.to_firm_id) : null,
      to_name: entryForm.is_firm_transaction && entryForm.to_mode === 'name' ? entryForm.to_name : null,
      assigned_admin_id: entryForm.assigned_admin_id,
    };

    // ── Optimistic UI: splice the entry locally BEFORE the network call ──
    // The list and the current ledger card update instantly. Snapshot is
    // restored on failure.
    const snapshotEntries = entries;
    const snapshotLedgers = ledgers;
    const targetEntryId = editingEntryId;
    const isCreate = !targetEntryId;

    if (isCreate) {
      // Append a temp entry with a negative id; refresh will replace it.
      const tempId = -Date.now();
      const tempEntry = {
        id: tempId,
        cash_flow_month_id: selectedLedger.id,
        site_id: selectedLedger.site_id,
        ...payload,
        status: 'pending',
        cheque_status: payload.cash_type === 'cheque' ? 'PENDING' : null,
        created_at: new Date().toISOString(),
        created_by_name: user?.full_name || user?.name || null,
      };
      setEntries((prev) => [...prev, tempEntry]);
    } else {
      // In-place merge of the new payload into the existing row.
      setEntries((prev) =>
        prev.map((e) => (e.id === targetEntryId ? { ...e, ...payload } : e))
      );
    }

    // Adjust the selected-ledger summary card optimistically.
    if (selectedLedger) {
      const prevEntry = isCreate ? null : snapshotEntries.find((e) => e.id === targetEntryId);
      const nextEntry = isCreate
        ? {
            ...payload,
            status: 'pending',
            cheque_status: payload.cash_type === 'cheque' ? 'PENDING' : null,
          }
        : { ...prevEntry, ...payload };
      const oldPosted = !!prevEntry && countsTowardBalance(prevEntry);
      const newPosted = countsTowardBalance(nextEntry);
      const oldAmounts = oldPosted ? accountedAmounts(prevEntry) : { debit: 0, credit: 0 };
      const newAmounts = newPosted ? accountedAmounts(nextEntry) : { debit: 0, credit: 0 };
      const newDebit = newAmounts.debit;
      const newCredit = newAmounts.credit;
      const oldDebit = oldAmounts.debit;
      const oldCredit = oldAmounts.credit;
      const debitDelta = newDebit - oldDebit;
      const creditDelta = newCredit - oldCredit;

      setLedgers((prev) => prev.map((l) => {
        if (l.id !== selectedLedger.id) return l;
        const next = {
          ...l,
          total_debit: (parseFloat(l.total_debit) || 0) + debitDelta,
          total_credit: (parseFloat(l.total_credit) || 0) + creditDelta,
          entry_count: (parseInt(l.entry_count) || 0) + Number(newPosted) - Number(oldPosted),
        };
        // Adjust cash/bank split. On edit we have to subtract the old entry
        // from its old type then add the new amounts to the new type.
        if (oldPosted && classifyPaymentMode(prevEntry.cash_type) === 'cash') {
          next.cash_given = (parseFloat(l.cash_given) || 0) - oldDebit;
          next.cash_received = (parseFloat(l.cash_received) || 0) - oldCredit;
        } else if (oldPosted) {
          next.bank_given = (parseFloat(l.bank_given) || 0) - oldDebit;
          next.bank_received = (parseFloat(l.bank_received) || 0) - oldCredit;
        }
        if (newPosted && classifyPaymentMode(payload.cash_type) === 'cash') {
          next.cash_given = (parseFloat(next.cash_given || 0)) + newDebit;
          next.cash_received = (parseFloat(next.cash_received || 0)) + newCredit;
        } else if (newPosted) {
          next.bank_given = (parseFloat(next.bank_given || 0)) + newDebit;
          next.bank_received = (parseFloat(next.bank_received || 0)) + newCredit;
        }
        return next;
      }));
    }

    setEntryDialogOpen(false);

    setSubmitting(true);
    try {
      if (isCreate) {
        await api.post('/cashflow/entries', payload);
        setMessage({ type: 'success', text: 'Entry added' });
      } else {
        await api.put(`/cashflow/entries/${targetEntryId}`, payload);
        setMessage({ type: 'success', text: 'Entry updated' });
      }
      // Reconcile in the background — pulls server-computed verifyUrl,
      // running balance, etc. and replaces the temp negative-id row.
      refreshEntries();
      refreshLedgers();
    } catch (err) {
      setEntries(snapshotEntries);
      setLedgers(snapshotLedgers);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    // Optimistic removal — instant UI feedback. Roll back on failure.
    const snapshotEntries = entries;
    const snapshotLedgers = ledgers;
    const removed = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));

    if (removed && selectedLedger && countsTowardBalance(removed)) {
      const { debit: dDebit, credit: dCredit } = accountedAmounts(removed);
      setLedgers((prev) => prev.map((l) => {
        if (l.id !== selectedLedger.id) return l;
        const next = {
          ...l,
          total_debit: (parseFloat(l.total_debit) || 0) - dDebit,
          total_credit: (parseFloat(l.total_credit) || 0) - dCredit,
          entry_count: Math.max(0, (parseInt(l.entry_count) || 0) - 1),
        };
        if (classifyPaymentMode(removed.cash_type) === 'cash') {
          next.cash_given = (parseFloat(l.cash_given) || 0) - dDebit;
          next.cash_received = (parseFloat(l.cash_received) || 0) - dCredit;
        } else {
          next.bank_given = (parseFloat(l.bank_given) || 0) - dDebit;
          next.bank_received = (parseFloat(l.bank_received) || 0) - dCredit;
        }
        return next;
      }));
    }

    try {
      await api.delete(`/cashflow/entries/${id}`);
      refreshEntries();
      refreshLedgers();
    } catch (err) {
      setEntries(snapshotEntries);
      setLedgers(snapshotLedgers);
      console.error('Failed to delete entry:', err);
    }
  };

  const handleBulkDeleteEntries = async () => {
    const ids = Array.from(entrySelection.selected);
    if (ids.length === 0) return;
    setBulkDeletingEntries(true);
    try {
      const { data } = await api.post('/cashflow/entries/bulk-delete', { ids });
      const deletedIds = data?.deleted || [];
      setEntries((prev) => prev.filter((e) => !deletedIds.includes(e.id)));
      entrySelection.clear();
      refreshEntries();
      refreshLedgers();
      toast.success(data?.message || 'Entries deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete entries');
    } finally {
      setBulkDeletingEntries(false);
    }
  };

  // ── Calculations ──
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.particular?.toLowerCase().includes(q) ||
          e.remarks?.toLowerCase().includes(q) ||
          e.from_firm_name?.toLowerCase().includes(q) ||
          e.to_firm_name?.toLowerCase().includes(q) ||
          e.to_name?.toLowerCase().includes(q) ||
          e.cheque_no?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter((e) => classifyPaymentMode(e.cash_type) === typeFilter);
    if (flowFilter === 'debit') result = result.filter((e) => accountedAmounts(e).debit > 0);
    if (flowFilter === 'credit') result = result.filter((e) => accountedAmounts(e).credit > 0);
    if (statusEntryFilter !== 'all') result = result.filter((e) => (e.status || 'pending') === statusEntryFilter);
    result = [...result].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });
    return result;
  }, [entries, searchQuery, sortOrder, typeFilter, flowFilter, statusEntryFilter]);

  const detailFiltersActive = searchQuery || typeFilter !== 'all' || flowFilter !== 'all' || statusEntryFilter !== 'all';

  // ── Person-ledger list: search + status/balance filters + sort ──
  const filteredLedgers = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    const pendingOf = (l) => (parseFloat(l.total_debit) || 0) - (parseFloat(l.total_credit) || 0);
    const givenOf = (l) => parseFloat(l.total_debit) || 0;
    const list = ledgers.filter((l) => {
      if (q && !(l.ledger_name || '').toLowerCase().includes(q)) return false;
      if (statusFilter === 'active' && l.is_locked) return false;
      if (statusFilter === 'locked' && !l.is_locked) return false;
      const p = pendingOf(l);
      if (balanceFilter === 'receive' && !(p > 0)) return false;
      if (balanceFilter === 'give' && !(p < 0)) return false;
      if (balanceFilter === 'settled' && p !== 0) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (ledgerSort) {
        case 'name-desc':    return (b.ledger_name || '').localeCompare(a.ledger_name || '');
        case 'pending-desc': return Math.abs(pendingOf(b)) - Math.abs(pendingOf(a));
        case 'given-desc':   return givenOf(b) - givenOf(a);
        default:             return (a.ledger_name || '').localeCompare(b.ledger_name || '');
      }
    });
  }, [ledgers, ledgerSearch, statusFilter, balanceFilter, ledgerSort]);

  const ledgerCounts = useMemo(() => {
    const c = { active: 0, locked: 0, receive: 0, give: 0, settled: 0 };
    ledgers.forEach((l) => {
      if (l.is_locked) c.locked++; else c.active++;
      const p = (parseFloat(l.total_debit) || 0) - (parseFloat(l.total_credit) || 0);
      if (p > 0) c.receive++; else if (p < 0) c.give++; else c.settled++;
    });
    return c;
  }, [ledgers]);

  // Pending/rejected entries and bounced/returned cheques stay visible, but
  // only approved, non-void rows affect sums, balances and breakdowns — otherwise
  // the Total row, Pending figure and per-entry Balance all drift from what
  // the dashboard / Day Book report.
  const countsTowardBalance = (e) => {
    if (String(e?.status ?? 'approved').trim().toLowerCase() !== 'approved') return false;
    const cs = e?.cheque_status ? String(e.cheque_status).toUpperCase() : null;
    if (cs === 'BOUNCED' || cs === 'RETURNED') return false;
    return true;
  };

  const totalDebit = useMemo(
    () => entries.filter(countsTowardBalance).reduce((s, e) => s + accountedAmounts(e).debit, 0),
    [entries]
  );
  const totalCredit = useMemo(
    () => entries.filter(countsTowardBalance).reduce((s, e) => s + accountedAmounts(e).credit, 0),
    [entries]
  );
  const pending = totalDebit - totalCredit; // Amount pending from person

  const getCashType = (type) => {
    return classifyPaymentMode(type);
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const cashBreakdown = useMemo(() => {
    const counted = entries.filter(countsTowardBalance);
    const cashDebit = counted.filter(e => getCashType(e.cash_type) === 'cash').reduce((s, e) => s + accountedAmounts(e).debit, 0);
    const cashCredit = counted.filter(e => getCashType(e.cash_type) === 'cash').reduce((s, e) => s + accountedAmounts(e).credit, 0);
    const bankDebit = counted.filter(e => getCashType(e.cash_type) !== 'cash').reduce((s, e) => s + accountedAmounts(e).debit, 0);
    const bankCredit = counted.filter(e => getCashType(e.cash_type) !== 'cash').reduce((s, e) => s + accountedAmounts(e).credit, 0);

    return {
      cashDebit,
      cashCredit,
      bankDebit,
      bankCredit,
      cashEntries: counted.filter(e => getCashType(e.cash_type) === 'cash').length,
      bankEntries: counted.filter(e => getCashType(e.cash_type) !== 'cash').length,
    };
  }, [entries]);

  const modeChartData = useMemo(() => ([
    {
      name: 'Cash',
      debit: cashBreakdown.cashDebit,
      credit: cashBreakdown.cashCredit,
    },
    {
      name: 'Bank',
      debit: cashBreakdown.bankDebit,
      credit: cashBreakdown.bankCredit,
    },
  ]), [cashBreakdown]);

  const flowPieData = useMemo(() => ([
    { name: 'Given (Debit)', value: totalDebit, color: '#ef4444' },
    { name: 'Returned (Credit)', value: totalCredit, color: '#10b981' },
  ]), [totalDebit, totalCredit]);

  const trendChartData = useMemo(() => {
    const grouped = new Map();
    entries.filter(countsTowardBalance).forEach((entry) => {
      const d = (entry.date || '').toString().split('T')[0] || todayISO();
      if (!grouped.has(d)) grouped.set(d, { date: d, debit: 0, credit: 0 });
      const current = grouped.get(d);
      const amounts = accountedAmounts(entry);
      current.debit += amounts.debit;
      current.credit += amounts.credit;
    });
    return Array.from(grouped.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12)
      .map((item) => ({
        ...item,
        label: formatDate(item.date),
      }));
  }, [entries]);

  const cashPending = cashBreakdown.cashDebit - cashBreakdown.cashCredit;
  const bankPending = cashBreakdown.bankDebit - cashBreakdown.bankCredit;

  const runningTotalsById = useMemo(() => {
    let runningTotal = 0;
    const totals = new Map();
    [...entries].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return dateDiff || Number(a.id) - Number(b.id);
    }).forEach((e) => {
      if (countsTowardBalance(e)) {
        const amounts = accountedAmounts(e);
        runningTotal += amounts.debit - amounts.credit;
      }
      totals.set(e.id, runningTotal);
    });
    return totals;
  }, [entries]);

  const entriesWithRunningTotal = useMemo(
    () => filteredEntries.map((e) => ({ ...e, runningTotal: runningTotalsById.get(e.id) || 0 })),
    [filteredEntries, runningTotalsById],
  );

  // Row ids actually rendered under the current filter — what select-all scopes to.
  const visibleEntryIds = useMemo(() => entriesWithRunningTotal.map((e) => e.id), [entriesWithRunningTotal]);

  // ── Helpers ──
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const openPrintWindow = (html, title, size = 'width=1100,height=800') => {
    const printWindow = window.open('', '_blank', size);
    if (!printWindow) return;
    writePrintDocument(printWindow, html);
    printWindow.document.close();
  };

  // Plot-payment-style two-copy cash flow receipt with embedded QR + print stamp.
  const printEntryReceipt = async (entry) => {
    const { debit, credit } = accountedAmounts(entry);
    const isCredit = credit > 0;
    const amount = isCredit ? credit : debit;
    const amtColor = isCredit ? '#059669' : '#dc2626';
    const docTitle = isCredit ? 'Cash Flow Receipt' : 'Cash Flow Payment Voucher';
    const mode = getCashType(entry.cash_type).toUpperCase();
    const isCash = mode === 'CASH';
    const siteName = (currentSite?.name || 'CASH FLOW').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const signerName = user?.full_name || user?.name || '';
    const refNo = `CF-${String(entry.id).padStart(5, '0')}`;
    const partyName = isCredit
      ? entry.from_firm_name || entry.to_name || entry.to_firm_name || entry.particular || '—'
      : entry.to_firm_name || entry.to_name || entry.from_firm_name || entry.particular || '—';
    const partyLabel = isCredit ? 'Received From' : 'Paid To';

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if (isCash) {
      printCashReceipt({
        siteName, siteAddr,
        docTitle: isCredit ? 'Cash Receipt' : 'Cash Payment Voucher',
        voucherNo: refNo, dateStr: payDate, printedAt,
        partyLabel, partyName: String(partyName || '').toUpperCase(),
        amount, amountColor: amtColor,
        rows: [
          { label: 'Particular', value: entry.particular ? String(entry.particular).toUpperCase() : '' },
          { label: 'Remarks', value: entry.remarks || '' },
        ],
        signerName,
        customerSigLabel: isCredit ? 'Payer Signature' : 'Receiver Signature',
        row: entry,
      });
      return;
    }

    let qrDataUrl = null;
    if (entry.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(entry.verifyUrl, {
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
            <p>${siteAddr || (selectedLedger?.ledger_name || 'CASH FLOW LEDGER').toUpperCase()}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ${refNo}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${partyLabel}</div><div class="c">:</div><div class="v">${String(partyName).toUpperCase()}</div></div>
              ${entry.particular ? `<div class="kv-row"><div class="k">Particular</div><div class="c">:</div><div class="v">${String(entry.particular).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(amount)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${mode}</div></div>
              ${selectedLedger?.ledger_name ? `<div class="kv-row"><div class="k">Ledger Account</div><div class="c">:</div><div class="v">${String(selectedLedger.ledger_name).toUpperCase()}</div></div>` : ''}
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>${refNo}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Particular</th><td>${entry.particular ? String(entry.particular).toUpperCase() : '—'}</td></tr>
            <tr><th>Method of Settlement</th><td>${mode}</td></tr>
            ${entry.cheque_no ? `<tr><th>Instrument Particulars</th><td>${String(entry.cheque_no).toUpperCase()}</td></tr>` : ''}
            <tr><th>Debit</th><td style="color:#dc2626">RS ${fmtINR(debit)}/-</td></tr>
            <tr><th>Credit</th><td style="color:#059669">RS ${fmtINR(credit)}/-</td></tr>
            ${entry.from_firm_name ? `<tr><th>From</th><td>${String(entry.from_firm_name).toUpperCase()}</td></tr>` : ''}
            ${entry.to_firm_name || entry.to_name ? `<tr><th>To</th><td>${String(entry.to_firm_name || entry.to_name).toUpperCase()}</td></tr>` : ''}
            ${entry.created_by_name ? `<tr><th>Authenticated By</th><td>${String(entry.created_by_name).toUpperCase()}</td></tr>` : ''}
            ${entry.remarks ? `<tr><th>Remarks</th><td>${escapeHtml(entry.remarks)}</td></tr>` : ''}
            <tr><th>Status</th><td>${String(entry.status || 'pending').toUpperCase()}</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box">${customerSigImg(entry)}<div class="sig-line">${isCredit ? 'Payer Signature' : 'Receiver Signature'}</div></div>
            <div class="sig-box">${authoritySigHtml(entry, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>CASH FLOW RECEIPT - ${refNo}</title>
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
    ${receiptBlock('Party Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    openPrintWindow(html, docTitle, 'width=1000,height=750');
  };

  // Bulk print — same receipt markup/CSS as printEntryReceipt's bank/cheque
  // A4 two-copy layout, repeated once per selected entry with a page-break
  // between blocks, all in ONE window.open() (never loop window.open per row).
  // ponytail: cash-mode entries render through this A4 layout too instead of
  // the standalone A5 cash receipt, so mixed selections share one document.
  const printSelectedEntries = async () => {
    const selected = entries.filter((e) => entrySelection.isSelected(e.id));
    if (selected.length === 0) return;

    const siteName = (currentSite?.name || 'CASH FLOW').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const signerName = user?.full_name || user?.name || '';

    const docs = await Promise.all(selected.map(async (entry) => {
      const { debit, credit } = accountedAmounts(entry);
      const isCredit = credit > 0;
      const amount = isCredit ? credit : debit;
      const amtColor = isCredit ? '#059669' : '#dc2626';
      const docTitle = isCredit ? 'Cash Flow Receipt' : 'Cash Flow Payment Voucher';
      const mode = getCashType(entry.cash_type).toUpperCase();
      const payDate = entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const refNo = `CF-${String(entry.id).padStart(5, '0')}`;
      const partyName = isCredit
        ? entry.from_firm_name || entry.to_name || entry.to_firm_name || entry.particular || '—'
        : entry.to_firm_name || entry.to_name || entry.from_firm_name || entry.particular || '—';
      const partyLabel = isCredit ? 'Received From' : 'Paid To';

      let qrDataUrl = null;
      if (entry.verifyUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(entry.verifyUrl, {
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
              <p>${siteAddr || (selectedLedger?.ledger_name || 'CASH FLOW LEDGER').toUpperCase()}</p>
            </div>
            <div class="doc-type"><h2>${docTitle}</h2></div>
            <div class="meta-info">
              <div class="meta-item"><b>Ref:</b> ${refNo}</div>
              <div class="meta-item"><b>Date:</b> ${payDate}</div>
            </div>
            <div class="kv-qr-wrap">
              <div class="kv-section">
                <div class="kv-row"><div class="k">${partyLabel}</div><div class="c">:</div><div class="v">${String(partyName).toUpperCase()}</div></div>
                ${entry.particular ? `<div class="kv-row"><div class="k">Particular</div><div class="c">:</div><div class="v">${String(entry.particular).toUpperCase()}</div></div>` : ''}
                <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(amount)}/-</div></div>
                <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${mode}</div></div>
                ${selectedLedger?.ledger_name ? `<div class="kv-row"><div class="k">Ledger Account</div><div class="c">:</div><div class="v">${String(selectedLedger.ledger_name).toUpperCase()}</div></div>` : ''}
              </div>
              ${qrSection}
            </div>
            <div class="settlement-title">Payment Details:</div>
            <table class="data-table">
              <tr><th>S.No.</th><td>${refNo}</td></tr>
              <tr><th>Date</th><td>${payDate || '—'}</td></tr>
              <tr><th>Particular</th><td>${entry.particular ? String(entry.particular).toUpperCase() : '—'}</td></tr>
              <tr><th>Method of Settlement</th><td>${mode}</td></tr>
              ${entry.cheque_no ? `<tr><th>Instrument Particulars</th><td>${String(entry.cheque_no).toUpperCase()}</td></tr>` : ''}
              <tr><th>Debit</th><td style="color:#dc2626">RS ${fmtINR(debit)}/-</td></tr>
              <tr><th>Credit</th><td style="color:#059669">RS ${fmtINR(credit)}/-</td></tr>
              ${entry.from_firm_name ? `<tr><th>From</th><td>${String(entry.from_firm_name).toUpperCase()}</td></tr>` : ''}
              ${entry.to_firm_name || entry.to_name ? `<tr><th>To</th><td>${String(entry.to_firm_name || entry.to_name).toUpperCase()}</td></tr>` : ''}
              ${entry.created_by_name ? `<tr><th>Authenticated By</th><td>${String(entry.created_by_name).toUpperCase()}</td></tr>` : ''}
              ${entry.remarks ? `<tr><th>Remarks</th><td>${escapeHtml(entry.remarks)}</td></tr>` : ''}
              <tr><th>Status</th><td>${String(entry.status || 'pending').toUpperCase()}</td></tr>
            </table>
            <div class="footer">
              <div class="sig-box">${customerSigImg(entry)}<div class="sig-line">${isCredit ? 'Payer Signature' : 'Receiver Signature'}</div></div>
              <div class="sig-box">${authoritySigHtml(entry, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
            </div>
            <div class="print-meta">Printed on: <b>${printedAt}</b></div>
          </div>
        </div>
      `;

      return `
      <div class="document">
        ${receiptBlock('Office Copy')}
        <hr class="scissor-line" />
        ${receiptBlock('Party Copy')}
      </div>`;
    }));

    const html = `<!DOCTYPE html>
<html><head>
  <title>CASH FLOW RECEIPTS - ${selected.length} Entries</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; flex-direction: column; align-items: center; padding: 10mm 0; gap: 10mm; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .document:not(:last-child) { page-break-after: always; }
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
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    ${CUSTOMER_SIGN_CSS}
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; padding: 0; gap: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  ${docs.join('')}
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    openPrintWindow(html, `Cash Flow Receipts (${selected.length})`, 'width=1000,height=750');
  };

  // A statement always honours the checked rows first. When nothing is checked,
  // it prints the currently filtered ledger view so the header action stays
  // useful for the whole ledger as well.
  const printWholeLedger = () => {
    if (!selectedLedger) return;

    const selectedEntries = entries.filter((entry) => entrySelection.isSelected(entry.id));
    // A stale selection must never fall through to an all-entry statement.
    if (entrySelection.count > 0 && selectedEntries.length === 0) return;
    const isSelectedStatement = entrySelection.count > 0;
    const statementEntries = isSelectedStatement ? selectedEntries : filteredEntries;
    if (statementEntries.length === 0) return;

    const baseLedgerTitle = `${selectedLedger.ledger_name} - ${MONTH_NAMES[selectedLedger.month]} ${selectedLedger.year}`;
    const ledgerTitle = isSelectedStatement ? `${baseLedgerTitle} - Selected Statement` : baseLedgerTitle;
    const countedEntries = statementEntries.filter(countsTowardBalance);
    const statementTotalDebit = countedEntries.reduce((sum, entry) => sum + accountedAmounts(entry).debit, 0);
    const statementTotalCredit = countedEntries.reduce((sum, entry) => sum + accountedAmounts(entry).credit, 0);
    const statementPending = statementTotalDebit - statementTotalCredit;
    const statementCashBreakdown = countedEntries.reduce((summary, entry) => {
      const isCash = getCashType(entry.cash_type) === 'cash';
      const amounts = accountedAmounts(entry);
      if (isCash) {
        summary.cashDebit += amounts.debit;
        summary.cashCredit += amounts.credit;
      } else {
        // Cheques are part of the bank settlement total, matching the ledger UI.
        summary.bankDebit += amounts.debit;
        summary.bankCredit += amounts.credit;
      }
      return summary;
    }, { cashDebit: 0, cashCredit: 0, bankDebit: 0, bankCredit: 0 });
    const pCashPending = statementCashBreakdown.cashDebit - statementCashBreakdown.cashCredit;
    const pBankPending = statementCashBreakdown.bankDebit - statementCashBreakdown.bankCredit;
    const statementScope = isSelectedStatement
      ? `${statementEntries.length} selected ${statementEntries.length === 1 ? 'entry' : 'entries'}`
      : detailFiltersActive
        ? `${statementEntries.length} filtered ${statementEntries.length === 1 ? 'entry' : 'entries'}`
        : `${statementEntries.length} ledger ${statementEntries.length === 1 ? 'entry' : 'entries'}`;

    let runTotal = 0;
    const rows = statementEntries.map((entry, index) => {
      const cashType = getCashType(entry.cash_type);
      const isCash = cashType === 'cash';
      const paymentType = isCash ? 'Cash' : cashType === 'cheque' ? 'Cheque' : 'Bank';
      const { debit, credit } = accountedAmounts(entry);
      if (countsTowardBalance(entry)) {
        runTotal += debit - credit;
      }
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(entry.date))}</td>
        <td>${escapeHtml(entry.particular)}</td>
        <td>${escapeHtml(entry.from_firm_name || '—')}</td>
        <td>${escapeHtml(entry.to_firm_name || entry.to_name || '—')}</td>
        <td>${escapeHtml(paymentType)}</td>
        <td>${escapeHtml(entry.cheque_no || '—')}</td>
        <td class="num debit">${debit > 0 ? '₹' + escapeHtml(formatCurrency(debit)) : '—'}</td>
        <td class="num credit">${credit > 0 ? '₹' + escapeHtml(formatCurrency(credit)) : '—'}</td>
        <td class="num" style="font-weight:700;color:${runTotal > 0 ? '#b45309' : runTotal < 0 ? '#dc2626' : '#94a3b8'}">${runTotal < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(runTotal)))}</td>
        <td class="num">${isCash && debit > 0 ? '₹' + escapeHtml(formatCurrency(debit)) : '—'}</td>
        <td class="num">${isCash && credit > 0 ? '₹' + escapeHtml(formatCurrency(credit)) : '—'}</td>
        <td class="num">${!isCash && debit > 0 ? '₹' + escapeHtml(formatCurrency(debit)) : '—'}</td>
        <td class="num">${!isCash && credit > 0 ? '₹' + escapeHtml(formatCurrency(credit)) : '—'}</td>
        <td>${escapeHtml(entry.remarks || '—')}</td>
        <td>${escapeHtml(entry.status || 'pending')}</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(ledgerTitle)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #0f172a; background: #fff; font-size: 12px; }
    .sheet { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
    .header .title { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .sum-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .sum-card .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .sum-card .val { font-size: 18px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .analytics-card { border: 2px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
    .analytics-card.cash { border-color: #fbbf24; background: #fffbeb; }
    .analytics-card.bank { border-color: #60a5fa; background: #eff6ff; }
    .analytics-card .card-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 2px; }
    .analytics-card .card-sub { font-size: 10px; color: #94a3b8; }
    .analytics-card .card-value { font-size: 24px; font-weight: 800; margin-top: 6px; font-variant-numeric: tabular-nums; }
    .analytics-card .card-status { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .analytics-card .breakdown { display: flex; gap: 20px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .analytics-card .breakdown .item .bl { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .analytics-card .breakdown .item .bv { font-size: 13px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .amber { color: #b45309; }
    .red { color: #dc2626; }
    .green { color: #059669; }
    .muted { color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 0; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 7px; vertical-align: top; }
    th { background: #f1f5f9; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; font-size: 9px; font-weight: 700; }
    th.debit-h { color: #dc2626; }
    th.credit-h { color: #059669; }
    th.balance-h { color: #b45309; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .debit { color: #dc2626; font-weight: 600; }
    .credit { color: #059669; font-weight: 600; }
    tfoot td { background: #f1f5f9; font-weight: 800; border-top: 2px solid #334155; }
    .controls { text-align: center; margin-top: 20px; }
    .btn { padding: 10px 24px; font-size: 13px; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; }
    .btn-print { background: #0f172a; color: white; }
    .btn-close { background: #e2e8f0; color: #334155; margin-left: 8px; }
    @media print { body { padding: 0; } .controls { display: none !important; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="title">${escapeHtml(ledgerTitle)}</div>
        <div class="sub">${escapeHtml(currentSite?.name || '')} · ${escapeHtml(statementScope)} · Printed on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="sum-card"><div class="lbl">Total Given (Debit)</div><div class="val red">₹${escapeHtml(formatCurrency(statementTotalDebit))}</div></div>
      <div class="sum-card"><div class="lbl">Total Returned (Credit)</div><div class="val green">₹${escapeHtml(formatCurrency(statementTotalCredit))}</div></div>
      <div class="sum-card"><div class="lbl">Net Pending</div><div class="val ${statementPending >= 0 ? 'amber' : 'red'}">${statementPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(statementPending)))}</div><div style="font-size:10px;color:#64748b;margin-top:2px">${statementPending >= 0 ? 'To Receive' : 'To Pay'}</div></div>
      <div class="sum-card"><div class="lbl">Entries</div><div class="val">${escapeHtml(String(statementEntries.length))}</div></div>
    </div>

    <div class="analytics-row">
      <div class="analytics-card cash">
        <div class="card-title">💵 To Receive in Cash</div>
        <div class="card-sub">Cash given will return in cash</div>
        <div class="card-value ${pCashPending > 0 ? 'amber' : pCashPending < 0 ? 'red' : 'muted'}">${pCashPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pCashPending)))}</div>
        <div class="card-status ${pCashPending > 0 ? 'amber' : pCashPending < 0 ? 'red' : 'muted'}">${pCashPending > 0 ? 'He needs to pay us' : pCashPending < 0 ? 'We need to pay' : 'Settled'}</div>
        <div class="breakdown">
          <div class="item"><div class="bl">Cash Out</div><div class="bv red">₹${escapeHtml(formatCurrency(statementCashBreakdown.cashDebit))}</div></div>
          <div class="item"><div class="bl">Cash In</div><div class="bv green">₹${escapeHtml(formatCurrency(statementCashBreakdown.cashCredit))}</div></div>
        </div>
      </div>
      <div class="analytics-card bank">
        <div class="card-title">🏦 To Receive in Bank</div>
        <div class="card-sub">Bank transfer will return via bank</div>
        <div class="card-value ${pBankPending > 0 ? 'amber' : pBankPending < 0 ? 'red' : 'muted'}">${pBankPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pBankPending)))}</div>
        <div class="card-status ${pBankPending > 0 ? 'amber' : pBankPending < 0 ? 'red' : 'muted'}">${pBankPending > 0 ? 'He needs to pay us' : pBankPending < 0 ? 'We need to pay' : 'Settled'}</div>
        <div class="breakdown">
          <div class="item"><div class="bl">Bank Out</div><div class="bv red">₹${escapeHtml(formatCurrency(statementCashBreakdown.bankDebit))}</div></div>
          <div class="item"><div class="bl">Bank In</div><div class="bv green">₹${escapeHtml(formatCurrency(statementCashBreakdown.bankCredit))}</div></div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th><th>Date</th><th>Particular</th><th>From Firm</th><th>To</th><th>Type</th><th>Cheque No</th><th class="num debit-h">Debit</th><th class="num credit-h">Credit</th><th class="num balance-h">Balance</th><th class="num">Cash Out</th><th class="num">Cash In</th><th class="num">Bank Out</th><th class="num">Bank In</th><th>Remarks</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-transform:uppercase;font-size:10px">Total</td>
          <td class="num debit">₹${escapeHtml(formatCurrency(statementTotalDebit))}</td>
          <td class="num credit">₹${escapeHtml(formatCurrency(statementTotalCredit))}</td>
          <td class="num" style="color:${statementPending > 0 ? '#b45309' : statementPending < 0 ? '#dc2626' : '#94a3b8'}">${statementPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(statementPending)))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(statementCashBreakdown.cashDebit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(statementCashBreakdown.cashCredit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(statementCashBreakdown.bankDebit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(statementCashBreakdown.bankCredit))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="controls">
    <button class="btn btn-print" onclick="window.print()">Print Statement</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

    openPrintWindow(html, ledgerTitle, 'width=1400,height=900');
  };

  // Exports the same statement scope as Print Ledger: checked rows take
  // precedence, otherwise the currently filtered/sorted ledger entries.
  const downloadLedgerExcel = () => {
    if (!selectedLedger) return;

    const selectedEntries = entries.filter((entry) => entrySelection.isSelected(entry.id));
    if (entrySelection.count > 0 && selectedEntries.length === 0) return;
    const exportedEntries = entrySelection.count > 0 ? selectedEntries : filteredEntries;
    if (!exportedEntries.length) {
      toast.error('No ledger entries available to export');
      return;
    }

    const countedEntries = exportedEntries.filter(countsTowardBalance);
    const totals = countedEntries.reduce((summary, entry) => {
      const { debit, credit } = accountedAmounts(entry);
      const isCash = getCashType(entry.cash_type) === 'cash';
      summary.debit += debit;
      summary.credit += credit;
      if (isCash) {
        summary.cashDebit += debit;
        summary.cashCredit += credit;
      } else {
        summary.bankDebit += debit;
        summary.bankCredit += credit;
      }
      return summary;
    }, { debit: 0, credit: 0, cashDebit: 0, cashCredit: 0, bankDebit: 0, bankCredit: 0 });

    let runningBalance = 0;
    const dataRows = exportedEntries.map((entry, index) => {
      const { debit, credit } = accountedAmounts(entry);
      const cashType = getCashType(entry.cash_type);
      const isCash = cashType === 'cash';
      if (countsTowardBalance(entry)) runningBalance += debit - credit;
      return [
        index + 1,
        formatDate(entry.date),
        entry.particular || '',
        entry.from_firm_name || '',
        entry.to_firm_name || entry.to_name || '',
        cashType === 'cheque' ? 'Cheque' : isCash ? 'Cash' : 'Bank',
        entry.cheque_no || '',
        debit || '',
        credit || '',
        runningBalance,
        isCash && debit ? debit : '',
        isCash && credit ? credit : '',
        !isCash && debit ? debit : '',
        !isCash && credit ? credit : '',
        getAssignedAdminLabel(entry) || '',
        entry.created_by_name || '',
        entry.remarks || '',
        String(entry.status || 'pending').toUpperCase(),
      ];
    });

    const scope = entrySelection.count > 0
      ? `${exportedEntries.length} selected entries`
      : detailFiltersActive
        ? `${exportedEntries.length} filtered entries`
        : `${exportedEntries.length} ledger entries`;
    const headers = ['#', 'Date', 'Particular', 'From Firm', 'To', 'Type', 'Cheque No', 'Debit', 'Credit', 'Balance', 'Cash Out', 'Cash In', 'Bank Out', 'Bank In', 'Assigned To', 'Created By', 'Remarks', 'Status'];
    const sheetRows = [
      [`${selectedLedger.ledger_name} — Person Ledger`],
      [`${currentSite?.name || ''} · ${MONTH_NAMES[selectedLedger.month]} ${selectedLedger.year}`],
      [scope],
      [],
      headers,
      ...dataRows,
      ['TOTAL', '', '', '', '', '', '', totals.debit, totals.credit, totals.debit - totals.credit, totals.cashDebit, totals.cashCredit, totals.bankDebit, totals.bankCredit, '', '', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    ];
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 22 }, { wch: 22 }, { wch: 32 }, { wch: 14 },
    ];
    [7, 8, 9, 10, 11, 12, 13].forEach((column) => {
      for (let row = 5; row < sheetRows.length; row += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, 'Ledger Statement');
    const safeName = String(selectedLedger.ledger_name || 'ledger').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_${MONTH_NAMES[selectedLedger.month]}_${selectedLedger.year}_Ledger.xlsx`);
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view cash flow</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  LEDGER DETAIL VIEW
  // ═══════════════════════════════════════════════════
  if (selectedLedger) {
    return (
      <div className="max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => { setSelectedLedger(null); setEntries([]); setSearchQuery(''); setTypeFilter('all'); setFlowFilter('all'); setStatusEntryFilter('all'); navigate('/cashflow'); }}
              title="Back to all ledgers"
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{selectedLedger.ledger_name}</h1>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${selectedLedger.is_locked ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedLedger.is_locked ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {selectedLedger.is_locked ? 'Locked' : 'Active'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {MONTH_NAMES[selectedLedger.month]} {selectedLedger.year} · Personal Ledger · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BulkActionsBar
              count={entrySelection.count}
              onClear={entrySelection.clear}
              onEdit={canUpdate && !selectedLedger.is_locked ? () => {
                const row = entries.find((e) => entrySelection.isSelected(e.id));
                if (row) handleOpenEditEntry(row);
              } : undefined}
              onDelete={canDelete && !selectedLedger.is_locked ? handleBulkDeleteEntries : undefined}
              onPrint={printWholeLedger}
              entityLabel="entry"
              deleting={bulkDeletingEntries}
            />
            {entrySelection.count > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={printSelectedEntries}
                className="h-8 border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Receipts ({entrySelection.count})
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAnalyticsDialogOpen(true)}>
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics
            </Button>
            {canWrite && !selectedLedger.is_locked && (
              <Button size="sm" className="h-8" onClick={handleOpenCreateEntry}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Entry
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={printWholeLedger}>
                  <Printer className="w-3.5 h-3.5 mr-2" /> {entrySelection.count > 0 ? `Print Selected Statement (${entrySelection.count})` : 'Print Ledger'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={downloadLedgerExcel}
                  disabled={!filteredEntries.length && entrySelection.count === 0}
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> {entrySelection.count > 0 ? `Export Excel (${entrySelection.count})` : 'Export Excel'}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      api.put(`/cashflow/months/${selectedLedger.id}`, { is_locked: !selectedLedger.is_locked });
                      setSelectedLedger({...selectedLedger, is_locked: !selectedLedger.is_locked});
                      fetchLedgers();
                    }}>
                      {selectedLedger.is_locked ? <Unlock className="w-3.5 h-3.5 mr-2" /> : <Lock className="w-3.5 h-3.5 mr-2" />}
                      {selectedLedger.is_locked ? 'Unlock Ledger' : 'Lock Ledger'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stat strip */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <ArrowUpRight className="w-3 h-3 text-red-500" /> Debited
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">₹{formatCurrency(totalDebit)}</p>
            </div>
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <ArrowDownRight className="w-3 h-3 text-emerald-500" /> Credited
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">₹{formatCurrency(totalCredit)}</p>
            </div>
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <IndianRupee className="w-3 h-3 text-amber-500" /> Net {pending >= 0 ? 'Receivable' : 'Payable'}
              </p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${pending >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                {pending < 0 && '−'}₹{formatCurrency(Math.abs(pending))}
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <BarChart3 className="w-3 h-3 text-slate-400" /> Entries
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{entries.length}</p>
            </div>
          </div>
        </div>

        {/* Cash / Bank settlement */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Wallet className="w-3.5 h-3.5 text-orange-500" /> Cash Settlement
                </p>
                {cashPending > 0 ? <TrendingUp className="w-4 h-4 text-amber-500" /> : cashPending < 0 ? <TrendingDown className="w-4 h-4 text-red-500" /> : null}
              </div>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${
                cashPending > 0 ? 'text-amber-600' : cashPending < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>
                {cashPending < 0 && '−'}₹{formatCurrency(Math.abs(cashPending))}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${
                cashPending > 0 ? 'text-amber-600' : cashPending < 0 ? 'text-red-500' : 'text-slate-400'
              }`}>
                {cashPending > 0 ? 'He needs to pay us in cash' : cashPending < 0 ? 'We need to pay in cash' : 'Cash settled'}
              </p>
              <div className="mt-3 flex gap-5 text-xs text-slate-400">
                <span>Out <b className="font-semibold text-red-600 tabular-nums">₹{formatCurrency(cashBreakdown.cashDebit)}</b></span>
                <span>In <b className="font-semibold text-emerald-600 tabular-nums">₹{formatCurrency(cashBreakdown.cashCredit)}</b></span>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Landmark className="w-3.5 h-3.5 text-blue-500" /> Bank Settlement
                </p>
                {bankPending > 0 ? <TrendingUp className="w-4 h-4 text-amber-500" /> : bankPending < 0 ? <TrendingDown className="w-4 h-4 text-red-500" /> : null}
              </div>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${
                bankPending > 0 ? 'text-amber-600' : bankPending < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>
                {bankPending < 0 && '−'}₹{formatCurrency(Math.abs(bankPending))}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${
                bankPending > 0 ? 'text-amber-600' : bankPending < 0 ? 'text-red-500' : 'text-slate-400'
              }`}>
                {bankPending > 0 ? 'He needs to pay us via bank' : bankPending < 0 ? 'We need to pay via bank' : 'Bank settled'}
              </p>
              <div className="mt-3 flex gap-5 text-xs text-slate-400">
                <span>Out <b className="font-semibold text-red-600 tabular-nums">₹{formatCurrency(cashBreakdown.bankDebit)}</b></span>
                <span>In <b className="font-semibold text-emerald-600 tabular-nums">₹{formatCurrency(cashBreakdown.bankCredit)}</b></span>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm shadow-slate-900/[0.03] space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search particular, firm, cheque no, remarks..."
                value={searchQuery}
                onChange={(ev) => setSearchQuery(ev.target.value)}
                className="pl-9 h-9 bg-white"
              />
            </div>
            <FilterChips
              label="Type" value={typeFilter} onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'cash', label: '💵 Cash', activeClass: 'bg-orange-500 text-white border-orange-500' },
                { value: 'bank', label: '🏦 Bank', activeClass: 'bg-blue-600 text-white border-blue-600' },
                { value: 'cheque', label: '📝 Cheque', activeClass: 'bg-purple-600 text-white border-purple-600' },
              ]}
            />
            <FilterChips
              label="Flow" value={flowFilter} onChange={setFlowFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'debit', label: 'Debited', activeClass: 'bg-red-600 text-white border-red-600' },
                { value: 'credit', label: 'Credited', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
              ]}
            />
            <FilterChips
              label="Status" value={statusEntryFilter} onChange={setStatusEntryFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500' },
                { value: 'approved', label: 'Approved', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                { value: 'rejected', label: 'Rejected', activeClass: 'bg-red-600 text-white border-red-600' },
              ]}
            />
            {detailFiltersActive && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500"
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); setFlowFilter('all'); setStatusEntryFilter('all'); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
            <span className="ml-auto text-[11px] text-slate-400">{filteredEntries.length} of {entries.length}</span>
          </div>
        </div>

        {/* Entries Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] overflow-hidden">
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-sm" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="w-8 text-center sticky left-0 z-40 bg-slate-50 px-3 py-2">
                      <Checkbox
                        checked={
                          entrySelection.isAllSelected(visibleEntryIds)
                            ? true
                            : entrySelection.count > 0 && visibleEntryIds.some((id) => entrySelection.isSelected(id)) ? 'indeterminate' : false
                        }
                        onCheckedChange={() => entrySelection.toggleAll(visibleEntryIds)}
                        className="align-middle bg-white"
                        aria-label="Select all entries"
                      />
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-8 z-40 bg-slate-50 px-3 py-2 text-left">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                        Date <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-12 sticky left-32 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>#</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Particular</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40 px-3 py-2 text-left">From Firm</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40 px-3 py-2 text-left">To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-16 px-3 py-2 text-center">Type</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Cheque No</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-red-600 px-3 py-2 text-right">Debit (↑)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 px-3 py-2 text-right">Credit (↓)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 px-3 py-2 text-right">Balance</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Cash Out</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Cash In</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Bank Out</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Bank In</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Assigned To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Created By</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Remarks</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Voucher</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                {entriesWithRunningTotal.map((e, idx) => {
                  const { debit: displayDebit, credit: displayCredit } = accountedAmounts(e);
                  return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                    <td className="w-8 text-center sticky left-0 z-10 bg-white px-3 py-2">
                      <Checkbox
                        checked={entrySelection.isSelected(e.id)}
                        onCheckedChange={() => entrySelection.toggle(e.id)}
                        className="align-middle"
                        aria-label={`Select entry ${idx + 1}`}
                      />
                    </td>
                    <td className="text-xs text-slate-500 sticky left-8 z-10 bg-white px-3 py-2">{formatDate(e.date)}</td>
                    <td className="text-xs text-slate-400 sticky left-32 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{idx + 1}</td>
                    <td className="text-sm text-slate-700 px-3 py-2">{e.particular}</td>
                    <td className="px-3 py-2">
                      {e.is_firm_transaction && e.from_firm_name ? (
                        <span className="text-xs font-medium text-blue-700">{e.from_firm_name}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.is_firm_transaction ? (
                        <span className="text-xs font-medium text-emerald-700">{e.to_firm_name || e.to_name || '—'}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      <Badge variant="outline" className={`text-xs ${getCashType(e.cash_type) === 'cash' ? 'bg-orange-50 text-orange-700 border-orange-200' : getCashType(e.cash_type) === 'cheque' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {getCashType(e.cash_type) === 'cash' ? '💵 Cash' : getCashType(e.cash_type) === 'cheque' ? '📝 Cheque' : '🏦 Bank'}
                      </Badge>
                      <ChequeStatusControl
                        chequeStatus={e.cheque_status}
                        source="cash_flow_entry"
                        entryId={e.id}
                        isAdmin={isAdmin}
                        onStatusChange={fetchEntries}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono text-slate-600">{e.cheque_no || '—'}</span>
                    </td>
                    <td className="text-right px-3 py-2">
                      {displayDebit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-red-600">{formatCurrency(displayDebit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {displayCredit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-emerald-700">{formatCurrency(displayCredit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      <span className={`text-sm font-bold tabular-nums ${e.runningTotal > 0 ? 'text-amber-700' : e.runningTotal < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {e.runningTotal < 0 && '−'}₹{formatCurrency(Math.abs(e.runningTotal))}
                      </span>
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) === 'cash' && displayDebit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-orange-600">{formatCurrency(displayDebit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) === 'cash' && displayCredit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-green-700">{formatCurrency(displayCredit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) !== 'cash' && displayDebit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-blue-600">{formatCurrency(displayDebit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) !== 'cash' && displayCredit > 0 && (
                        <span className="text-sm font-medium tabular-nums text-purple-700">{formatCurrency(displayCredit)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.assigned_admin_id ? (
                        <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                          {getAssignedAdminLabel(e) || '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <UserAvatar name={e.created_by_name} label="Created by" />
                    </td>
                    <td className="text-xs text-slate-400 px-3 py-2">{e.remarks}</td>
                    <td className="text-center px-3 py-2"><ApprovalStatusBadge status={e.status} /></td>
                    <td className="text-center px-3 py-2"><VoucherThumbnail url={e.voucher_url} /></td>
                    <td className="text-right px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => printEntryReceipt(e)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600">
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => setSignEntry(e)}
                            className={`h-7 w-7 p-0 ${e.customer_signature_url ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-400 hover:text-violet-600'}`}
                            title={e.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}>
                            <PenLine className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!selectedLedger.is_locked && (canUpdate || canDelete) && (
                          <>
                            {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleOpenEditEntry(e)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>}
                            {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(e.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-50/95 backdrop-blur-sm" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                  <tr className="border-t border-slate-200">
                    <td className="sticky left-0 z-40 bg-slate-50/95 px-3 py-3"></td>
                    <td className="sticky left-8 z-40 bg-slate-50/95 px-3 py-3 text-xs font-bold text-slate-900 uppercase">Total</td>
                    <td className="sticky left-32 z-40 bg-slate-50/95 px-3 py-3" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}></td>
                    <td className="px-3 py-3" colSpan={5}></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-red-600">₹{formatCurrency(totalDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-emerald-700">₹{formatCurrency(totalCredit)}</span></td>
                    <td className="text-right px-3 py-3">
                      <span className={`text-sm font-bold tabular-nums ${pending > 0 ? 'text-amber-700' : pending < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {pending < 0 && '−'}₹{formatCurrency(Math.abs(pending))}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-orange-600">₹{formatCurrency(cashBreakdown.cashDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-green-700">₹{formatCurrency(cashBreakdown.cashCredit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-blue-600">₹{formatCurrency(cashBreakdown.bankDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-purple-700">₹{formatCurrency(cashBreakdown.bankCredit)}</span></td>
                    <td className="px-3 py-3" colSpan={6}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Entry Dialog */}
        <SignaturePad
          open={!!signEntry}
          onOpenChange={(o) => { if (!o) setSignEntry(null); }}
          onSave={async ({ customer, authority }) => {
            const entry = signEntry;
            const sigPatch = { customer_signature_url: customer };
            if (authority) sigPatch.authority_signature_url = authority;
            await api.put(`/signatures/cashflow_entry/${entry.id}`, sigPatch);
            setSignEntry(null);
            fetchEntries();
            printEntryReceipt({ ...entry, ...sigPatch });
          }}
          askAuthority={!nameSignOn()}
          signeeLabel={signEntry ? `Ledger Entry #${signEntry.id} · ₹${(accountedAmounts(signEntry).credit || accountedAmounts(signEntry).debit).toLocaleString('en-IN')}` : ''}
        />

        <EntryDialog
          open={entryDialogOpen}
          onOpenChange={(open) => { setEntryDialogOpen(open); if (!open) resetEntryForm(); }}
          title={editingEntryId ? 'Edit Entry' : 'Add Entry'}
          description={editingEntryId ? 'Update entry details.' : 'Add a new cash flow entry.'}
          footer={(
            <EntryFooter
              onCancel={() => setEntryDialogOpen(false)}
              onSubmit={() => document.getElementById('cashflow-entry-form')?.requestSubmit()}
              submitLabel={submitting ? (editingEntryId ? 'Updating...' : 'Adding...') : (editingEntryId ? 'Update' : 'Add Entry')}
              submitting={submitting}
            />
          )}
        >
          {message.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form id="cashflow-entry-form" onSubmit={handleSubmitEntry} className="space-y-4">
            <CreditDebitTabs
              value={entryDirection}
              onChange={(dir) => {
                setEntryDirection(dir);
                // Keep debit/credit mutually exclusive: move the amount to the chosen side.
                setEntryForm((prev) => (dir === 'credit'
                  ? { ...prev, credit: prev.credit || prev.debit, debit: '' }
                  : { ...prev, debit: prev.debit || prev.credit, credit: '' }));
              }}
              creditHint="Money received from person"
              debitHint="Money given to person"
            />

            <EntryRow>
              <EntryField label="Date" required>
                <Input
                  type="date"
                  value={entryForm.date}
                  onChange={(ev) => setEntryForm({ ...entryForm, date: ev.target.value })}
                  required
                />
              </EntryField>
              <EntryField label="Type" required>
                <EntryModeChips
                  value={entryForm.cash_type}
                  modes={['CASH', 'BANK', 'CHEQUE']}
                  onChange={(m) => {
                    const val = m.toLowerCase(); // maps chip back to exact stored values 'cash' | 'bank' | 'cheque'
                    setEntryForm({
                      ...entryForm,
                      cash_type: val,
                      particular: getParticularsForMode(val)[0],
                      ...(val === 'cash' ? { cheque_no: '' } : {}),
                    });
                  }}
                />
              </EntryField>
            </EntryRow>

            <BankAccountSelect
              value={entryForm.bank_account_id}
              onChange={(value) => setEntryForm((current) => ({ ...current, bank_account_id: value }))}
              paymentMode={entryForm.cash_type}
              disabled={submitting}
              required
            />

            <EntryAmount
              direction={entryDirection}
              inputProps={{
                step: '0.01',
                min: undefined, // old input had no min; keep native validation identical
                placeholder: '0.00',
                value: entryDirection === 'credit' ? entryForm.credit : entryForm.debit,
                onChange: (ev) => setEntryForm({
                  ...entryForm,
                  [entryDirection]: ev.target.value,
                  [entryDirection === 'credit' ? 'debit' : 'credit']: '',
                }),
              }}
            />

            <EntryRow>
              <EntryParticular
                mode={entryForm.cash_type}
                value={entryForm.particular}
                onChange={(v) => setEntryForm({ ...entryForm, particular: v })}
              />
              {entryForm.cash_type === 'cheque' && (
                <EntryField label="Cheque No">
                  <Input
                    placeholder="Enter cheque number"
                    value={entryForm.cheque_no || ''}
                    onChange={(ev) => setEntryForm({ ...entryForm, cheque_no: ev.target.value })}
                  />
                </EntryField>
              )}
            </EntryRow>

            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cf-firm-transaction"
                  checked={entryForm.is_firm_transaction}
                  onCheckedChange={(checked) => setEntryForm({
                    ...entryForm,
                    is_firm_transaction: Boolean(checked),
                    from_firm_id: '',
                    to_mode: 'name',
                    to_firm_id: '',
                    to_name: '',
                  })}
                />
                <Label htmlFor="cf-firm-transaction" className="text-sm font-medium text-slate-700 cursor-pointer">
                  From Firm
                </Label>
              </div>

              {entryForm.is_firm_transaction && (
                <EntryRow>
                  <EntryField label="From Firm" required>
                    <Select value={entryForm.from_firm_id} onValueChange={(val) => setEntryForm({ ...entryForm, from_firm_id: val })}>
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue placeholder={loadingFirms ? 'Loading...' : 'Select firm'} />
                      </SelectTrigger>
                      <SelectContent>
                        {firms.map((f) => (
                          <SelectItem key={f.id} value={`${f.id}`}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </EntryField>

                  <EntryField label="To Type">
                    <Select value={entryForm.to_mode} onValueChange={(val) => setEntryForm({ ...entryForm, to_mode: val, to_firm_id: '', to_name: '' })}>
                      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="firm">Firm</SelectItem>
                        <SelectItem value="name">Other Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </EntryField>

                  {entryForm.to_mode === 'firm' ? (
                    <EntryField label="To Firm" required className="sm:col-span-2">
                      <Select value={entryForm.to_firm_id} onValueChange={(val) => setEntryForm({ ...entryForm, to_firm_id: val, to_name: '' })}>
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder={loadingFirms ? 'Loading...' : 'Select firm'} />
                        </SelectTrigger>
                        <SelectContent>
                          {firms.map((f) => (
                            <SelectItem key={f.id} value={`${f.id}`}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EntryField>
                  ) : (
                    <EntryField label="To Name" required className="sm:col-span-2">
                      <Input
                        placeholder="Party name"
                        value={entryForm.to_name}
                        onChange={(ev) => setEntryForm({ ...entryForm, to_name: ev.target.value.toUpperCase(), to_firm_id: '' })}
                      />
                    </EntryField>
                  )}
                </EntryRow>
              )}
            </div>

            <EntryField label="Remarks">
              <Textarea
                placeholder="Optional notes..."
                value={entryForm.remarks}
                onChange={(ev) => setEntryForm({ ...entryForm, remarks: ev.target.value })}
                rows={2}
              />
            </EntryField>

            {(isAdmin || canManage) && approvers.length > 0 && (
              <EntryField label="Assign To Admin">
                <Select
                  value={entryForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setEntryForm({ ...entryForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}
                >
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Select approver..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">- None -</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={app.id.toString()}>
                        {app.full_name || app.name || app.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EntryField>
            )}

            <EntryField label="Voucher">
              <VoucherUpload
                value={entryForm.voucher_url}
                onChange={(url) => setEntryForm({ ...entryForm, voucher_url: url })}
              />
            </EntryField>
          </form>
        </EntryDialog>

        {/* Analytics Modal */}
        <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-base">Ledger Analytics</DialogTitle>
              <DialogDescription className="text-sm">
                Visual summary for {selectedLedger?.ledger_name} showing debit/credit distribution and recent trend.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-blue-50/40">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Cash vs Bank</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                        <Legend />
                        <Bar dataKey="debit" name="Debit" fill="#ef4444" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="credit" name="Credit" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-emerald-50/40">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Given vs Returned</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={flowPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {flowPieData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-indigo-50/40">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Recent Trend (Last 12 Dates)</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-25} textAnchor="end" height={50} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                      <Legend />
                      <Bar dataKey="debit" name="Debit" fill="#f97316" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="credit" name="Credit" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAnalyticsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  LEDGERS LIST VIEW
  // ═══════════════════════════════════════════════════
  // ── List export/print: rows = selected ledgers if any, else all filtered ──
  const getExportRows = () => {
    const source = selectedLedgerIds.size
      ? filteredLedgers.filter((l) => selectedLedgerIds.has(l.id))
      : filteredLedgers;
    return source.map((l) => {
      const given = parseFloat(l.total_debit) || 0;
      const returned = parseFloat(l.total_credit) || 0;
      const cashG = parseFloat(l.cash_given) || 0;
      const cashR = parseFloat(l.cash_received) || 0;
      const bankG = parseFloat(l.bank_given) || 0;
      const bankR = parseFloat(l.bank_received) || 0;
      return {
        ledger: l, given, returned, pending: given - returned,
        cashG, cashR, cashP: cashG - cashR, bankG, bankR, bankP: bankG - bankR,
      };
    });
  };

  const downloadLedgersExcel = () => {
    const rows = getExportRows();
    if (!rows.length) return;
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    const aoa = [
      ['Person / Entity', 'Reference', 'Entries', 'Given', 'Returned', 'Pending', 'Cash Given', 'Cash Recv', 'Cash Pending', 'Bank Given', 'Bank Recv', 'Bank Pending', 'Status'],
      ...rows.map(({ ledger: l, ...r }) => [
        l.ledger_name, `${MONTH_NAMES[l.month]} ${l.year}`, parseInt(l.entry_count) || 0,
        r.given, r.returned, r.pending, r.cashG, r.cashR, r.cashP, r.bankG, r.bankR, r.bankP,
        l.is_locked ? 'LOCKED' : 'ACTIVE',
      ]),
      ['TOTAL', '', rows.reduce((s, r) => s + (parseInt(r.ledger.entry_count) || 0), 0),
        sum('given'), sum('returned'), sum('pending'), sum('cashG'), sum('cashR'), sum('cashP'),
        sum('bankG'), sum('bankR'), sum('bankP'), ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = aoa[0].map((_, i) => ({ wch: i === 0 ? 28 : 13 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Person Ledgers');
    const stamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `person-ledgers-${(currentSite?.name || 'site').replace(/\s+/g, '-').toLowerCase()}-${stamp}.xlsx`);
  };

  // HTML-based print viewer — opens a formatted page with its own Print button.
  const printLedgersList = () => {
    const rows = getExportRows();
    if (!rows.length) return;
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    const inr = (v) => `₹${(parseFloat(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const printedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    const cellsFor = (r) => [r.given, r.returned, r.pending, r.cashG, r.cashR, r.cashP, r.bankG, r.bankR, r.bankP]
      .map((v) => `<td class="num${v < 0 ? ' neg' : ''}">${inr(Math.abs(v))}${v < 0 ? ' (give)' : ''}</td>`).join('');
    const html = `<!doctype html><html><head><title>Person-wise Ledgers — ${(currentSite?.name || '').toUpperCase()}</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, 'Segoe UI', Arial, sans-serif; }
  body { margin: 0; background: #f1f5f9; color: #0f172a; }
  .toolbar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: flex-end; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
  .btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer; }
  .btn-print { background: #0f172a; border-color: #0f172a; color: #fff; }
  .page { max-width: 1140px; margin: 16px auto; background: #fff; padding: 24px 28px; border: 1px solid #e2e8f0; border-radius: 12px; }
  h1 { font-size: 18px; margin: 0; } .sub { color: #64748b; font-size: 12px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11.5px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 6px 8px; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  td.neg { color: #dc2626; }
  tr.total td { border-top: 2px solid #cbd5e1; font-weight: 700; background: #f8fafc; }
  .badge { font-size: 9px; border: 1px solid #cbd5e1; border-radius: 999px; padding: 1px 7px; color: #475569; }
  @media print {
    .toolbar { display: none; } body { background: #fff; }
    .page { border: none; border-radius: 0; margin: 0; max-width: none; padding: 0; }
    @page { size: A4 landscape; margin: 12mm; }
  }
</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.close()">Close</button><button class="btn btn-print" onclick="window.print()">Print</button></div>
<div class="page">
  <h1>Person-wise Ledgers — ${(currentSite?.name || '').toUpperCase()}</h1>
  <p class="sub">${rows.length} ledger${rows.length === 1 ? '' : 's'}${selectedLedgerIds.size ? ' (selected)' : ''} · Printed ${printedAt}</p>
  <table>
    <thead><tr>
      <th>Person / Entity</th><th>Reference</th>
      <th class="num">Given</th><th class="num">Returned</th><th class="num">Pending</th>
      <th class="num">Cash Given</th><th class="num">Cash Recv</th><th class="num">Cash Pending</th>
      <th class="num">Bank Given</th><th class="num">Bank Recv</th><th class="num">Bank Pending</th>
      <th>Status</th>
    </tr></thead>
    <tbody>
      ${rows.map(({ ledger: l, ...r }) => `<tr>
        <td><strong>${l.ledger_name || ''}</strong></td>
        <td>${MONTH_NAMES[l.month]} ${l.year} · ${l.entry_count} entries</td>
        ${cellsFor(r)}
        <td><span class="badge">${l.is_locked ? 'LOCKED' : 'ACTIVE'}</span></td>
      </tr>`).join('')}
      <tr class="total">
        <td>TOTAL (${rows.length})</td><td></td>
        ${cellsFor({ given: sum('given'), returned: sum('returned'), pending: sum('pending'), cashG: sum('cashG'), cashR: sum('cashR'), cashP: sum('cashP'), bankG: sum('bankG'), bankR: sum('bankR'), bankP: sum('bankP') })}
        <td></td>
      </tr>
    </tbody>
  </table>
</div>
</body></html>`;
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) return;
    writePrintDocument(w, html);
    w.document.close();
  };

  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Person-wise Ledgers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cash flow ledgers for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/cashflow/analytics')}>
            <BarChart3 className="w-4 h-4 mr-1.5" /> Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={printLedgersList} disabled={!filteredLedgers.length}>
            <Printer className="w-4 h-4 mr-1.5" /> Print{selectedLedgerIds.size ? ` (${selectedLedgerIds.size})` : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLedgersExcel} disabled={!filteredLedgers.length}>
            <Download className="w-4 h-4 mr-1.5" /> Excel{selectedLedgerIds.size ? ` (${selectedLedgerIds.size})` : ''}
          </Button>
          {canWrite && (
            <Button size="sm" onClick={handleOpenCreateLedger}>
              <Plus className="w-4 h-4 mr-1.5" /> New Person Ledger
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {ledgers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search person / entity..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={ledgerSort} onValueChange={setLedgerSort}>
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                <SelectItem value="pending-desc">Pending (high → low)</SelectItem>
                <SelectItem value="given-desc">Given (high → low)</SelectItem>
              </SelectContent>
            </Select>
            <FilterChips
              label="Status" value={statusFilter} onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All', count: ledgers.length },
                { value: 'active', label: 'Active', count: ledgerCounts.active, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
                { value: 'locked', label: 'Locked', count: ledgerCounts.locked, activeClass: 'bg-amber-500 text-white border-amber-500' },
              ]}
            />
            {listFiltersActive && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500 ml-auto" onClick={clearListFilters}>
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>
          <FilterChips
            label="Balance" value={balanceFilter} onChange={setBalanceFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'receive', label: 'To Receive', count: ledgerCounts.receive, activeClass: 'bg-slate-800 text-white border-slate-800' },
              { value: 'give', label: 'To Give', count: ledgerCounts.give, activeClass: 'bg-red-600 text-white border-red-600' },
              { value: 'settled', label: 'Settled', count: ledgerCounts.settled, activeClass: 'bg-slate-500 text-white border-slate-500' },
            ]}
          />
        </div>
      )}

      {/* Ledger Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : ledgers.length === 0 ? (
        <div className="text-center py-16">
          <User className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No person ledgers created yet</p>
        </div>
      ) : filteredLedgers.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No ledgers match your filters</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clearListFilters}>Clear filters</Button>
        </div>
      ) : (
        <Card className="shadow-none border-slate-200 overflow-hidden">
          {/* PlotPayments-style table: sticky head row + frozen select/person
              columns, tri-state select-all. Selection scopes the totals row. */}
          <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 260px)', WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
              <tr>
                <th className="w-8 text-center sticky left-0 z-40 bg-slate-50 px-3 py-2">
                  <Checkbox
                    checked={
                      filteredLedgers.length > 0 && filteredLedgers.every((l) => selectedLedgerIds.has(l.id))
                        ? true
                        : filteredLedgers.some((l) => selectedLedgerIds.has(l.id)) ? 'indeterminate' : false
                    }
                    onCheckedChange={() => setSelectedLedgerIds((prev) => {
                      const next = new Set(prev);
                      const all = filteredLedgers.every((l) => next.has(l.id));
                      filteredLedgers.forEach((l) => { if (all) next.delete(l.id); else next.add(l.id); });
                      return next;
                    })}
                    className="align-middle bg-white"
                    aria-label="Select all ledgers"
                  />
                </th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left sticky left-8 z-40 bg-slate-50 px-3 py-2 min-w-44" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>Person / Entity</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-left px-3 py-2 whitespace-nowrap">Reference</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Debited</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Credited</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Pending</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Cash Given</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Cash Recv</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Cash Pending</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Bank Given</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Bank Recv</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right px-3 py-2 whitespace-nowrap">Bank Pending</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center px-3 py-2 whitespace-nowrap">Status</th>
                <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center px-3 py-2 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.map((ledger) => {
                const tDebit = parseFloat(ledger.total_debit) || 0;
                const tCredit = parseFloat(ledger.total_credit) || 0;
                const pending = tDebit - tCredit;
                const cashGiven = parseFloat(ledger.cash_given) || 0;
                const cashRecv = parseFloat(ledger.cash_received) || 0;
                const cashPending = cashGiven - cashRecv;
                const bankGiven = parseFloat(ledger.bank_given) || 0;
                const bankRecv = parseFloat(ledger.bank_received) || 0;
                const bankPending = bankGiven - bankRecv;

                const isSel = selectedLedgerIds.has(ledger.id);
                // To-give in BOTH bank and cash → the whole entry reads red.
                const bothGive = cashPending < 0 && bankPending < 0;
                const stickyBg = isSel ? 'bg-blue-50' : bothGive ? 'bg-red-50' : 'bg-white';
                return (
                  <tr
                    key={ledger.id}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${
                      isSel ? 'bg-blue-50/60 hover:bg-blue-50' : bothGive ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50/60'
                    }`}
                    onClick={() => navigate(`/cashflow/${ledger.id}`)}
                  >
                    <td className={`w-8 text-center sticky left-0 z-10 px-3 py-2 ${stickyBg}`} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => setSelectedLedgerIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(ledger.id)) next.delete(ledger.id); else next.add(ledger.id);
                          return next;
                        })}
                        className="align-middle bg-white/80"
                        aria-label={`Select ${ledger.ledger_name}`}
                      />
                    </td>
                    <td className={`sticky left-8 z-10 px-3 py-2 ${stickyBg}`} style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-50 shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900 whitespace-nowrap">{ledger.ledger_name}</span>
                          {ledger.linked_user_id || ledger.linked_member_id ? (
                            <span className="block text-[10px] font-medium text-emerald-600 whitespace-nowrap">
                              Linked: {ledger.linked_user_name || ledger.linked_member_name || (ledger.linked_user_id ? `User #${ledger.linked_user_id}` : `Client #${ledger.linked_member_id}`)}
                            </span>
                          ) : (
                            <span className="block text-[10px] font-medium text-amber-600 whitespace-nowrap">User/client mapping required</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {MONTH_NAMES[ledger.month]} {ledger.year} · {ledger.entry_count} entries
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{formatCurrency(tDebit)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{formatCurrency(tCredit)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-sm font-bold tabular-nums ${pending < 0 || bothGive ? 'text-red-600' : 'text-amber-600'}`}>
                        ₹{formatCurrency(Math.abs(pending))}
                      </span>
                      <div className={`text-[10px] ${pending < 0 || bothGive ? 'text-red-500' : 'text-amber-500'}`}>
                        {pending >= 0 ? 'To Receive' : 'To Give'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(cashGiven)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(cashRecv)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-xs font-semibold tabular-nums ${cashPending < 0 ? 'text-red-600' : cashPending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {cashPending < 0 ? `-₹${formatCurrency(Math.abs(cashPending))}` : `₹${formatCurrency(cashPending)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(bankGiven)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(bankRecv)}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-xs font-semibold tabular-nums ${bankPending < 0 ? 'text-red-600' : bankPending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {bankPending < 0 ? `-₹${formatCurrency(Math.abs(bankPending))}` : `₹${formatCurrency(bankPending)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ledger.is_locked ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">Locked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">Active</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {/* stopPropagation on the wrapper so row-click nav doesn't also fire */}
                      <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" title="View ledger"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                          onClick={() => navigate(`/cashflow/${ledger.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" title="Rename ledger"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            onClick={() => handleOpenEditLedger(ledger)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" title="Delete ledger"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteLedger(ledger)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Cumulative totals — of the selection when rows are checked,
                else of everything the filters show. Sticky at the bottom. */}
            {(() => {
              const rows = selectedLedgerIds.size
                ? filteredLedgers.filter((l) => selectedLedgerIds.has(l.id))
                : filteredLedgers;
              const cumGiven = rows.reduce((s, l) => s + (parseFloat(l.total_debit) || 0), 0);
              const cumReturned = rows.reduce((s, l) => s + (parseFloat(l.total_credit) || 0), 0);
              const cumPending = cumGiven - cumReturned;
              const cumCashGiven = rows.reduce((s, l) => s + (parseFloat(l.cash_given) || 0), 0);
              const cumCashRecv = rows.reduce((s, l) => s + (parseFloat(l.cash_received) || 0), 0);
              const cumCashPending = cumCashGiven - cumCashRecv;
              const cumBankGiven = rows.reduce((s, l) => s + (parseFloat(l.bank_given) || 0), 0);
              const cumBankRecv = rows.reduce((s, l) => s + (parseFloat(l.bank_received) || 0), 0);
              const cumBankPending = cumBankGiven - cumBankRecv;
              return (
                <tfoot className="sticky bottom-0 z-30" style={{ boxShadow: '0 -1px 0 0 #cbd5e1' }}>
                  <tr className="bg-slate-100">
                    <td className="sticky left-0 z-40 bg-slate-100 px-3 py-3" />
                    <td className="sticky left-8 z-40 bg-slate-100 px-3 py-3 text-sm font-bold text-slate-900 whitespace-nowrap" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                      Total{selectedLedgerIds.size ? ` (${rows.length} selected)` : ''}
                    </td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-slate-900">₹{formatCurrency(cumGiven)}</td>
                    <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-slate-900">₹{formatCurrency(cumReturned)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-sm font-bold tabular-nums ${cumPending < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        ₹{formatCurrency(Math.abs(cumPending))}
                      </span>
                      <div className={`text-[10px] ${cumPending < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                        {cumPending >= 0 ? 'To Receive' : 'To Give'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumCashGiven)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumCashRecv)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-bold tabular-nums ${cumCashPending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {cumCashPending < 0 ? `-₹${formatCurrency(Math.abs(cumCashPending))}` : `₹${formatCurrency(cumCashPending)}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumBankGiven)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumBankRecv)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs font-bold tabular-nums ${cumBankPending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {cumBankPending < 0 ? `-₹${formatCurrency(Math.abs(cumBankPending))}` : `₹${formatCurrency(cumBankPending)}`}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              );
            })()}
          </table>
          </div>
        </Card>
      )}

      {/* Ledger Dialog */}
      <Dialog open={ledgerDialogOpen} onOpenChange={(open) => { setLedgerDialogOpen(open); if (!open) resetLedgerForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingLedgerId ? 'Edit Person Ledger' : 'Create Person Ledger'}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingLedgerId
                ? 'Map this ledger to a User Management account or client, then update its display name. Existing entries remain unchanged.'
                : 'Select a User Management account or client to create a permanently linked Personal Ledger.'}
            </DialogDescription>
          </DialogHeader>

          {message.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmitLedger} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Linked Person from User Management *</Label>
              <Popover open={ledgerPersonOpen} onOpenChange={setLedgerPersonOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" aria-expanded={ledgerPersonOpen} className="h-9 w-full justify-between font-normal">
                    <span className={selectedLedgerPersonLabel ? 'truncate' : 'text-slate-400'}>{selectedLedgerPersonLabel || 'Search and select user or client'}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search name, phone, email, client type…"
                      value={ledgerPersonSearch}
                      onValueChange={setLedgerPersonSearch}
                    />
                    <CommandList className="max-h-72">
                      <CommandEmpty className="py-5 text-center text-xs text-slate-500">No user or client found.</CommandEmpty>
                      {editingLedgerId && ledgerForm.linked_user_id && !approvers.some((item) => String(item.id) === ledgerForm.linked_user_id) && (
                        <CommandGroup heading="Current mapping">
                          <CommandItem value={`current-user-${ledgerForm.linked_user_id}`} onSelect={() => selectLedgerPerson('user', ledgerForm.linked_user_id)}>
                            {ledgers.find((item) => item.id === editingLedgerId)?.linked_user_name || `Mapped user #${ledgerForm.linked_user_id}`}
                          </CommandItem>
                        </CommandGroup>
                      )}
                      {editingLedgerId && ledgerForm.linked_member_id && !ledgerMembers.some((item) => String(item.id) === ledgerForm.linked_member_id) && (
                        <CommandGroup heading="Current mapping">
                          <CommandItem value={`current-member-${ledgerForm.linked_member_id}`} onSelect={() => selectLedgerPerson('member', ledgerForm.linked_member_id)}>
                            {ledgers.find((item) => item.id === editingLedgerId)?.linked_member_name || `Mapped client #${ledgerForm.linked_member_id}`}
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup heading="Login users">
                        {approvers.filter((managedUser) => matchesLedgerPersonSearch(managedUser, 'user')).map((managedUser) => (
                          <CommandItem key={`user-${managedUser.id}`} value={`user ${managedUser.name || ''} ${managedUser.email || ''} ${managedUser.phone || ''}`} onSelect={() => selectLedgerPerson('user', managedUser.id)}>
                            {managedUser.name || managedUser.email} · {String(managedUser.role || 'USER').replace('_', ' ').toUpperCase()}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Clients / members">
                        {ledgerMembers.filter((member) => matchesLedgerPersonSearch(member, 'member')).map((member) => (
                          <CommandItem key={`member-${member.id}`} value={`member ${member.full_name || ''} ${member.phone || ''} ${member.member_type || ''}`} onSelect={() => selectLedgerPerson('member', member.id)}>
                            {member.full_name} · {String(member.member_type || 'MEMBER').replace('_', ' ')}{member.phone ? ` · ${member.phone}` : ''}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-[10px] text-slate-400">Search directly inside the dropdown. The selected record is saved by ID, so name changes do not break tracking.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ledger Display Name *</Label>
              <Input
                placeholder="e.g., OM ASSOCIATES, RAVI BHAI, KULDEEP MAIN"
                value={ledgerForm.ledger_name}
                onChange={(ev) => setLedgerForm({ ...ledgerForm, ledger_name: ev.target.value.toUpperCase() })}
                required
              />
              <p className="text-[10px] text-slate-400">Defaults to the selected person’s name; you may keep a familiar ledger label.</p>
            </div>

            {!editingLedgerId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-900 mb-2">ℹ️ How it works:</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Create a ledger for each person/entity you track</li>
                  <li>• Add entries from any date (not limited by month)</li>
                  <li>• Track money given (Debit) and returned (Credit)</li>
                  <li>• Pending = Total Given - Total Returned</li>
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setLedgerDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {editingLedgerId ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  editingLedgerId ? 'Save Changes' : 'Create Ledger'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashFlow;
