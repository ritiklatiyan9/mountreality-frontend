import { writePrintDocument } from '../lib/safePrint';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import { apolloClient } from '../graphql/client';
import { GET_EXPENSES_PAGE_DATA, GET_EXPENSES_BREAKDOWN } from '../graphql/queries';
import * as XLSX from 'xlsx';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext,
} from '../components/ui/pagination';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '../components/ui/popover';
import {
  Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty
} from '../components/ui/command';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ChevronDown, Building2, ArrowUpRight, ArrowDownRight,
  Banknote, Calendar, Filter, X, Download, Printer, Tag,
  BarChart3, CreditCard, Hash, Clock, CheckCircle2, XCircle,
  UploadCloud, ExternalLink, FileImage, ImageIcon, ArrowUpDown, ChevronsUpDown,
  Eye, User as UserIcon, Radar as RadarIcon, UserPlus, PenLine,
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import ChequeStatusControl from '../components/ChequeStatusControl';
import SignaturePad from '../components/SignaturePad';
import { useDocViewer } from '../components/DocViewer';
import { printCashReceipt } from '../lib/cashReceipt';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import CreditDebitTabs from '../components/CreditDebitTabs';
import {
  EntryDialog, EntryFooter, EntryRow, EntryField, EntryAmount, EntryModeChips,
} from '../components/EntryModal';
import BulkActionsBar from '../components/BulkActionsBar';
import BankAccountSelect from '../components/BankAccountSelect';
import { EmptyState, SkeletonBlock } from '../components/dashboard/primitives';
import ExpenseSummary from '../components/expenses/ExpenseSummary';
import ExpenseTable from '../components/expenses/ExpenseTable';
import ExpenseMobileList from '../components/expenses/ExpenseMobileList';
import { PERIOD_OPTIONS } from '../components/expenses/expenseMeta';
import { useRowSelection } from '../hooks/useRowSelection';
const PAYMENT_MODE_OPTIONS = [
  'CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST',
];


const MODE_COLORS = {
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'IMPS': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

// ── Local-date helper → returns YYYY-MM-DD for <input type="date">.
// Robust against every shape the server may send back:
//   • Date object (pg DATE → JS Date at local midnight)
//   • ISO "2026-04-23T00:00:00.000Z"
//   • plain "2026-04-23"
//   • locale string "Wed Apr 23 2026 ..."
// For the first two string variants we slice the date portion directly to
// avoid Date() timezone shifts silently moving it by a day. Returns ''
// (treated as empty by the <input type="date">) on anything unparseable —
// previously a silently-invalid Date was producing "NaN-NaN-NaN" which the
// input rejected, wiping the field when the edit modal opened.
const toLocal = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (!dt || Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const buildExpensesQueryFilters = ({
  search,
  mode,
  category,
  toEntity,
  dateFrom,
  dateTo,
  missingBill,
  order,
}) => {
  const filters = {
    onlySite: true,
    order: order === 'asc' ? 'ASC' : 'DESC',
  };

  if (search) filters.search = search;
  if (mode && mode !== 'all') filters.mode = mode;
  // `category` may be a single non-"all" string (legacy) or an array of tokens (multi-category AND).
  if (Array.isArray(category)) {
    const tokens = category.map((c) => String(c).trim()).filter(Boolean);
    if (tokens.length > 0) filters.categories = tokens;
  } else if (category && category !== 'all') {
    filters.category = category;
  }
  if (toEntity && toEntity !== 'all') filters.toEntity = toEntity;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (missingBill) filters.missingBill = true;

  return filters;
};

// Shared A4 voucher print styles — reused by both the single-row printReceipt
// and the bulk printSelectedReceipts (one combined window covers all selected
// rows; looping window.open per row gets killed by popup blockers after the
// first). ".document + .document" page-breaks are a no-op when only one
// document is printed.
const RECEIPT_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; flex-direction: column; align-items: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .document + .document { margin-top: 8mm; page-break-before: always; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 3mm; border-bottom: 2px double #0f172a; padding: 3mm 3mm 2.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 18px; color: #166534; letter-spacing: 2px; margin-bottom: 2px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 3mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 12px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 3mm; font-size: 10px; padding: 0 3mm; }
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
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    .customer-sign { display: block; max-height: 11mm; max-width: 48mm; margin: 0 auto 1px; object-fit: contain; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .document + .document { margin-top: 0 !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .customer-sign { max-height: 9mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
`;

const Expenses = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSite, isAdmin, canManage, user, hasPermission } = useAuth();
  const openDoc = useDocViewer();
  const canWrite  = canManage && hasPermission('expenses', 'write');
  const canUpdate = canManage && hasPermission('expenses', 'update');
  const canDelete = canManage && hasPermission('expenses', 'delete');
  const siteId = currentSite?.id;
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  // ── State ──
  const [expenses, setExpenses] = useState([]);
  const selection = useRowSelection();
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [summary, setSummary] = useState({ total_debit: 0, total_credit: 0, total_count: 0 });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownLoaded, setBreakdownLoaded] = useState(false);
  const breakdownSeqRef = useRef(0);
  const [autocomplete, setAutocomplete] = useState({
    fromEntities: [], toEntities: [], paymentModes: [], remarks: [],
    accountNos: [], branches: [], categories: [],
  });
  const [customExpenseCategories, setCustomExpenseCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [approvers, setApprovers] = useState([]);

  const [txnType, setTxnType] = useState('debit');
  const isCreditTxn = txnType === 'credit';

  // Filters
  const [searchQuery, setSearchQuery] = useState(queryFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(queryFromUrl);
  const [filterMode, setFilterMode] = useState('all');
  // Multi-category AND filter — each entry is an ILIKE token the category must contain.
  // Empty array = no filter (equivalent to the old "all").
  const [filterCategories, setFilterCategories] = useState([]);
  const toggleFilterCategory = useCallback((value) => {
    if (!value || value === 'all') {
      setFilterCategories([]);
      return;
    }
    setFilterCategories((prev) => (
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    ));
  }, []);
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTo, setFilterTo] = useState('all');
  const [filterBillStatus, setFilterBillStatus] = useState('all');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterCategoryOpen, setFilterCategoryOpen] = useState(false);
  const [filterCategorySearch, setFilterCategorySearch] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarSort, setRadarSort] = useState('debit'); // 'debit' | 'name'
  const [uploadingBillId, setUploadingBillId] = useState(null);
  const [viewEntry, setViewEntry] = useState(null);
  const [signEntry, setSignEntry] = useState(null);
  const searchTimerRef = useRef(null);
  const fetchSeqRef = useRef(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Form
  const [form, setForm] = useState({
    date: toLocal(new Date()),
    payment_mode: '',
    bank_account_id: '',
    amount: '', remark: '', account_no: '',
    branch: '', category: '',
    assigned_user_id: null, voucher_url: '',
    assigned_admin_id: null,
  });

  // ── Debounce search ──
  useEffect(() => {
    setSearchQuery(queryFromUrl);
    setDebouncedSearch(queryFromUrl);
    setCurrentPage(1);
  }, [queryFromUrl]);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  // ── Fetch all ──
  const fetchExpenses = useCallback(async () => {
    if (!siteId) return;
    const seq = ++fetchSeqRef.current;
    try {
      setLoading(true);
      // Watchdog — never let the spinner hang past 15s on a stalled request.
      const watchdog = setTimeout(() => {
        if (seq === fetchSeqRef.current) setLoading(false);
      }, 15000);
      const filters = buildExpensesQueryFilters({
        search: debouncedSearch,
        mode: filterMode,
        category: filterCategories,
        toEntity: filterTo,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        missingBill: filterBillStatus === 'missing',
        order: sortOrder,
      });

      const { data } = await apolloClient.query({
        query: GET_EXPENSES_PAGE_DATA,
        variables: {
          siteId: String(siteId),
          page: currentPage,
          limit: itemsPerPage,
          filters,
        },
        fetchPolicy: 'network-only',
      });

      clearTimeout(watchdog);

      if (seq !== fetchSeqRef.current) return;

      const pageData = data?.expensesPageData;
      setExpenses(pageData?.expenses || []);
      setSummary(pageData?.summary || { total_debit: 0, total_credit: 0, total_count: 0 });

      if (pageData?.pagination) {
        setTotalItems(pageData.pagination.totalItems || 0);
        setTotalPages(pageData.pagination.totalPages || 1);
      } else {
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      console.error('Failed to fetch expenses:', err);
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [
    siteId, currentPage, itemsPerPage, debouncedSearch,
    filterMode, filterCategories, filterTo, filterDateFrom, filterDateTo, filterBillStatus, sortOrder
  ]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ── Lazy breakdown fetch (only when accordion is open) ──
  const fetchBreakdown = useCallback(async () => {
    if (!siteId) return;
    const seq = ++breakdownSeqRef.current;
    try {
      setBreakdownLoading(true);
      const filters = buildExpensesQueryFilters({
        search: debouncedSearch,
        mode: filterMode,
        category: filterCategories,
        toEntity: filterTo,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        missingBill: filterBillStatus === 'missing',
        order: sortOrder,
      });
      const { data } = await apolloClient.query({
        query: GET_EXPENSES_BREAKDOWN,
        variables: { siteId: String(siteId), filters },
        fetchPolicy: 'network-only',
      });
      if (seq !== breakdownSeqRef.current) return;
      const br = data?.expensesBreakdown;
      setCategoryBreakdown(br?.categoryBreakdown || []);
      setBreakdownLoaded(true);
    } catch (err) {
      if (seq !== breakdownSeqRef.current) return;
      console.error('Failed to fetch breakdown:', err);
    } finally {
      if (seq === breakdownSeqRef.current) setBreakdownLoading(false);
    }
  }, [
    siteId, debouncedSearch, filterMode, filterCategories, filterTo,
    filterDateFrom, filterDateTo, filterBillStatus, sortOrder,
  ]);

  // Fire when opened; refetch when filters change while open.
  useEffect(() => {
    if (breakdownOpen || radarOpen) fetchBreakdown();
  }, [breakdownOpen, radarOpen, fetchBreakdown]);

  // Fetch autocomplete, categories and approvers once per site change
  useEffect(() => {
    if (!siteId) return;
    Promise.all([
      api.get(`/expenses/autocomplete?site_id=${siteId}`),
      api.get('/expense-categories'),
      api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
    ]).then(([acRes, catRes, appRes]) => {
      setAutocomplete(acRes.data || {
        fromEntities: [], toEntities: [], paymentModes: [], remarks: [],
        accountNos: [], branches: [], categories: [],
      });
      setCustomExpenseCategories((catRes.data.categories || []).map(c => c.name));
      setApprovers(appRes.data.approvers || []);
    }).catch(() => { });
  }, [siteId]);

  // Merged category list for dropdowns
  const allCategoryOptions = useMemo(() => {
    return [...customExpenseCategories].sort();
  }, [customExpenseCategories]);

  const filteredCategoryOptionsForFilter = useMemo(() => {
    const q = filterCategorySearch.trim().toLowerCase();
    if (!q) return allCategoryOptions;
    return allCategoryOptions.filter((c) => c.toLowerCase().includes(q));
  }, [allCategoryOptions, filterCategorySearch]);

  useEffect(() => {
    if (!filterCategoryOpen) setFilterCategorySearch('');
  }, [filterCategoryOpen]);

  const isBankMode = Boolean(form.payment_mode) && form.payment_mode !== 'CASH';

  const voucherInputRef = useRef(null);

  // ── Form helpers ──
  const resetForm = () => {
    setForm({
      date: toLocal(new Date()),
      payment_mode: '',
      bank_account_id: '',
      amount: '', remark: '', account_no: '',
      branch: '', category: '',
      assigned_user_id: null, voucher_url: '',
      assigned_admin_id: null,
    });
    setTxnType('debit');
    setEditingId(null);
    setMessage({ type: '', text: '' });
    if (voucherInputRef.current) voucherInputRef.current.value = '';
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (e) => {
    const debit = parseFloat(e.debit) || 0;
    const credit = parseFloat(e.credit) || 0;
    const nextTxnType = credit > 0 && debit <= 0 ? 'credit' : 'debit';
    setTxnType(nextTxnType);
    // Preserve the row's own date when editing. Fall back to today only if
    // every candidate is unparseable — we must never hand the date input an
    // empty string from a record that really did have a date on it.
    const resolvedDate = toLocal(e.date) || toLocal(e.created_at) || toLocal(new Date());
    setForm({
      date: resolvedDate,
      payment_mode: e.payment_mode || '',
      bank_account_id: e.bank_account_id ? String(e.bank_account_id) : '',
      amount: String(nextTxnType === 'credit' ? credit : debit),
      remark: e.remark || '', account_no: e.account_no || '',
      branch: e.branch || '', category: e.category || '',
      assigned_user_id: e.assigned_user_id || null, voucher_url: e.voucher_url || '',
      assigned_admin_id: e.assigned_admin_id || null,
      cheque_no: e.cheque_no || '',
    });
    setEditingId(e.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });
    if (isBankMode && !form.bank_account_id) {
      setMessage({ type: 'error', text: 'Select the bank account used for this transaction' });
      return;
    }
    setSubmitting(true);
    try {
      const amt = Math.abs(parseFloat(form.amount) || 0);
      if (amt <= 0) {
        setMessage({ type: 'error', text: 'Amount should be greater than 0' });
        setSubmitting(false);
        return;
      }
      const payload = {
        site_id: siteId,
        date: form.date || toLocal(new Date()),
        payment_mode: form.payment_mode,
        bank_account_id: form.bank_account_id || null,
        cheque_no: form.payment_mode === 'CHEQUE' ? (form.cheque_no || null) : null,
        debit: txnType === 'debit' ? amt : 0,
        credit: txnType === 'credit' ? amt : 0,
        remark: form.remark,
        account_no: form.account_no,
        branch: form.branch,
        category: form.category,
        assigned_user_id: form.assigned_user_id,
        voucher_url: form.voucher_url,
        assigned_admin_id: form.assigned_admin_id,
      };
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Expense updated' });
      } else {
        await api.post('/expenses', payload);
        setMessage({ type: 'success', text: 'Expense added' });
      }
      // Close dialog instantly; reconcile in background.
      setDialogOpen(false);
      fetchExpenses();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      // Background reconcile — list updates without blocking.
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selected);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const { data } = await api.post('/expenses/bulk-delete', { ids });
      toast.success(data?.message || `Deleted ${data?.deleted?.length ?? ids.length} expense(s)`);
      selection.clear();
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  // onEdit only ever fires with exactly 1 row selected (BulkActionsBar
  // disables the button otherwise) — reuse the existing single-row edit UI.
  const handleBulkEdit = () => {
    const id = Array.from(selection.selected)[0];
    const row = expenses.find((e) => e.id === id);
    if (row) handleOpenEdit(row);
  };

  const handleVoucherUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Invalid file type. Please upload an image or PDF.' });
      return;
    }

    setUploadingVoucher(true);
    setMessage({ type: '', text: '' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/single?provider=s3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(prev => ({ ...prev, voucher_url: res.data.fileUrl || res.data.url }));
      setMessage({ type: 'success', text: 'Voucher uploaded successfully' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Voucher upload failed' });
    } finally {
      setUploadingVoucher(false);
    }
  };

  // ── Inline bill upload (directly from table row) ──
  const handleBillUpload = async (expId, file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) return;
    setUploadingBillId(expId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/single?provider=s3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const billUrl = res.data.fileUrl || res.data.url;
      await api.put(`/expenses/${expId}`, { bill_url: billUrl });
      // Background reconcile — no blocking await.
      fetchExpenses();
    } catch (err) {
      console.error('Bill upload failed:', err);
    } finally {
      setUploadingBillId(null);
    }
  };

  // ── Signatures drawn on signature pad / pen tablet ──
  // "Name Sign" setting: on (default) → authorized signatory prints as the
  // user's name; off → the pad captures the authority's signature too.
  const nameSignOn = localStorage.getItem('nameSign') !== '0';

  const handleSaveSignature = async ({ customer, authority }) => {
    const entry = signEntry;
    const sigPatch = { customer_signature_url: customer };
    if (authority) sigPatch.authority_signature_url = authority;
    await api.put(`/expenses/${entry.id}`, sigPatch);
    setExpenses((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...sigPatch } : e)));
    setViewEntry((v) => (v && v.id === entry.id ? { ...v, ...sigPatch } : v));
    setSignEntry(null);
    printReceipt({ ...entry, ...sigPatch });
  };

  const sortedCategoryBreakdown = useMemo(() => {
    return [...categoryBreakdown].sort((a, b) =>
      String(a.category || '').localeCompare(String(b.category || ''))
    );
  }, [categoryBreakdown]);

  // ── Period helpers ──
  const getDateRange = (period) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const toISO = (d) => toLocal(d);
    switch (period) {
      case 'today': return { from: toISO(today), to: toISO(today) };
      case 'week': { const d = today.getDay(); const m = new Date(today); m.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); return { from: toISO(m), to: toISO(today) }; }
      case 'month': { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: toISO(f), to: toISO(today) }; }
      case 'last_month': { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const l = new Date(today.getFullYear(), today.getMonth(), 0); return { from: toISO(f), to: toISO(l) }; }
      default: return { from: '', to: '' };
    }
  };

  const handlePeriodChange = (period) => {
    setFilterPeriod(period);
    if (period === 'all' || period === 'custom') {
      if (period === 'all') { setFilterDateFrom(''); setFilterDateTo(''); }
    } else {
      const { from, to } = getDateRange(period);
      setFilterDateFrom(from); setFilterDateTo(to);
    }
  };

  const clearFilters = () => {
    setSearchQuery(''); setFilterMode('all'); setFilterCategories([]);
    setFilterPeriod('all'); setFilterDateFrom(''); setFilterDateTo('');
    setFilterTo('all'); setFilterBillStatus('all'); setSortOrder('desc');
  };

  // Reset to page 1 when filters or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterMode, filterCategories, filterTo, filterDateFrom, filterDateTo, filterBillStatus, itemsPerPage, sortOrder]);

  const hasActiveFilters = filterMode !== 'all' || filterCategories.length > 0 ||
    filterTo !== 'all' || filterDateFrom || filterDateTo || searchQuery || filterBillStatus !== 'all';

  // The summary is already computed by the backend for the filtered results!
  const totalDebit = parseFloat(summary.total_debit) || 0;
  const totalCredit = parseFloat(summary.total_credit) || 0;
  const netBalance = totalCredit - totalDebit;
  // Cash/Bank flow split — backend tags each row by payment mode.
  // cash_debit = money paid out via cash, cash_credit = money received as cash, etc.
  const cashOut = parseFloat(summary.cash_debit) || 0;
  const cashIn  = parseFloat(summary.cash_credit) || 0;
  const bankOut = parseFloat(summary.bank_debit) || 0;
  const bankIn  = parseFloat(summary.bank_credit) || 0;

  // Unique TO entities for filter
  const uniqueToEntities = useMemo(() => {
    return [...new Set(expenses.map(e => e.to_entity).filter(Boolean))].sort();
  }, [expenses]);

  // ── Helpers ──
  const fmt = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };
  const parseDateValue = (value) => {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    const text = String(value).trim();
    if (!text) return null;

    if (/^\d+$/.test(text)) {
      const asNumber = Number(text);
      if (Number.isFinite(asNumber)) {
        const dt = new Date(asNumber);
        if (!Number.isNaN(dt.getTime())) return dt;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [y, m, d] = text.split('-').map((part) => parseInt(part, 10));
      const dt = new Date(y, m - 1, d);
      if (!Number.isNaN(dt.getTime())) return dt;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const fmtDate = (d) => {
    const parsed = parseDateValue(d);
    if (!parsed) return '—';
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  /* Every row action in one place — the table and the mobile list take
     the same bundle, so they can never diverge on behaviour. */
  const expenseActions = {
    formatDate: fmtDate,
    onView: (exp) => setViewEntry(exp),
    onPrint: (exp) => printReceipt(exp),
    onSign: (exp) => setSignEntry(exp),
    onEdit: (exp) => handleOpenEdit(exp),
    onDelete: (id) => handleDelete(id),
    onNavigate: (route) => navigate(route),
    onUploadBill: (id, file) => handleBillUpload(id, file),
    onViewBill: (exp) => openDoc({
      url: exp.bill_url,
      title: `Bill — ₹${fmt(parseFloat(exp.debit) || parseFloat(exp.credit) || 0)}`,
    }),
  };

  const getModeBadge = (mode) => {
    if (!mode) return null;
    const cls = MODE_COLORS[mode] || 'bg-slate-50 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>{mode}</Badge>;
  };

  const getStatusBadge = (status, approvedByName) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] font-medium gap-1 ${config.className}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
        {approvedByName && (status === 'approved' || status === 'rejected') && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-default shrink-0 ${
                  status === 'approved' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                }`}>
                  {approvedByName[0].toUpperCase()}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>{status === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-semibold">{approvedByName}</span></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  // ── Download Excel ──
  const downloadExcel = async () => {
    try {
      setMessage({ type: 'info', text: 'Generating Excel...' });

      const filters = buildExpensesQueryFilters({
        search: searchQuery,
        mode: filterMode,
        category: filterCategories,
        toEntity: filterTo,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        missingBill: filterBillStatus === 'missing',
        order: sortOrder,
      });

      const { data } = await apolloClient.query({
        query: GET_EXPENSES_PAGE_DATA,
        variables: {
          siteId: String(siteId),
          page: 1,
          limit: 0, // fetch all rows for export
          filters,
        },
        fetchPolicy: 'network-only',
      });

      const fullData = data?.expensesPageData?.expenses || [];
      const summaryData = data?.expensesPageData?.summary || { total_debit: 0, total_credit: 0 };

      const dlTotalDebit = parseFloat(summaryData.total_debit) || 0;
      const dlTotalCredit = parseFloat(summaryData.total_credit) || 0;
      const dlNetBalance = dlTotalCredit - dlTotalDebit;

      const wb = XLSX.utils.book_new();
      const headerRows = [
        [`Expenses — ${currentSite?.name || ''}`],
        [`Total Debit: ₹${fmt(dlTotalDebit)}  |  Total Credit: ₹${fmt(dlTotalCredit)}  |  Balance: ₹${fmt(dlNetBalance)}`],
        [],
      ];

      const colHeaders = ['No', 'Date', 'FROM', 'TO', 'Mode', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Remark', 'Account', 'Branch', 'Category'];
      headerRows.push(colHeaders);

      const dataRows = fullData.map((e, i) => {
        const rowDate = fmtDate(e.date);
        return [
          i + 1,
          rowDate === '—' ? '' : rowDate,
          e.from_entity || '', e.to_entity || '', e.payment_mode || '',
          parseFloat(e.debit) || 0, parseFloat(e.credit) || 0,
          parseFloat(e.balance) || '',
          e.remark || '', e.account_no || '', e.branch || '', e.category || '',
        ];
      });

      const totRow = ['', '', '', '', 'TOTAL',
        dlTotalDebit,
        dlTotalCredit,
        '', '', '', '', '',
      ];

      const allRows = [...headerRows, ...dataRows, totRow];
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      ws['!cols'] = [
        { wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 16 },
        { wch: 18 }, { wch: 16 },
      ];
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
      XLSX.writeFile(wb, `Expenses_${(currentSite?.name || '').replace(/[^a-zA-Z0-9]/g, '_')}_${toLocal(new Date())}.xlsx`);
      setMessage({ type: '', text: '' });
    } catch (err) {
      console.error('Failed to export excel:', err);
      setMessage({ type: 'error', text: 'Failed to download Excel file' });
    }
  };

  // ── Print Receipt ──
  // Builds the two-copy "office / payee" markup for one entry (general A4
  // voucher template — used for every non-CASH mode). Shared by the
  // single-row printReceipt and the bulk printSelectedReceipts so the two
  // never drift out of sync.
  const buildReceiptDocument = async (exp) => {
    const debit = parseFloat(exp.debit) || 0;
    const credit = parseFloat(exp.credit) || 0;
    const isDebit = debit > 0;
    const amt = isDebit ? debit : credit;
    const absAmt = Math.abs(amt);
    const typeLabel = isDebit ? 'Payment Voucher' : 'Receipt Voucher';
    const voucherNo = `${isDebit ? 'PV' : 'RV'}-${String(exp.id).padStart(6, '0')}`;
    const dateStr = fmtDate(exp.date);
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const siteName = (currentSite?.name || 'COMPANY').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const signerName = user?.full_name || user?.name || '';
    const amtColor = isDebit ? '#dc2626' : '#059669';

    let qrDataUrl = null;
    if (exp.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(exp.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch { qrDataUrl = null; }
    }
    const qrSection = qrDataUrl
      ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
      : '';

    // Authorized signatory: drawn signature wins; else name (when Name Sign on).
    const authoritySigHtml = exp.authority_signature_url
      ? `<img class="customer-sign" src="${exp.authority_signature_url}" alt="" />`
      : (nameSignOn ? `<div class="digital-signature">${signerName}</div>` : '');

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'ACCOUNTS & FINANCE DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>${typeLabel}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Voucher No:</b> ${voucherNo}</div>
            <div class="meta-item"><b>Date:</b> ${dateStr}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              ${exp.from_entity ? `<div class="kv-row"><div class="k">From / Source</div><div class="c">:</div><div class="v">${exp.from_entity.toUpperCase()}</div></div>` : ''}
              ${exp.to_entity ? `<div class="kv-row"><div class="k">To / Paid To</div><div class="c">:</div><div class="v">${exp.to_entity.toUpperCase()}</div></div>` : ''}
              ${exp.category ? `<div class="kv-row"><div class="k">Category</div><div class="c">:</div><div class="v" style="color:#7c3aed;font-weight:700">${String(exp.category).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(absAmt)}/-</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">${isDebit ? 'Payment' : 'Receipt'} Details:</div>
          <table class="data-table">
            <tr><th>Date</th><td>${dateStr}</td></tr>
            ${exp.category ? `<tr><th>Category</th><td>${exp.category}</td></tr>` : ''}
            ${exp.payment_mode ? `<tr><th>Payment Mode</th><td>${exp.payment_mode}</td></tr>` : ''}
            ${exp.account_no ? `<tr><th>Account No</th><td>${exp.account_no}</td></tr>` : ''}
            ${exp.branch ? `<tr><th>Branch</th><td>${exp.branch}</td></tr>` : ''}
            <tr><th>Amount</th><td style="color:${amtColor}">RS ${fmtINR(absAmt)}/-</td></tr>
            ${exp.remark ? `<tr><th>Remark</th><td>${exp.remark}</td></tr>` : ''}
          </table>
          <div class="footer">
            <div class="sig-box">${exp.customer_signature_url ? `<img class="customer-sign" src="${exp.customer_signature_url}" alt="" />` : ''}<div class="sig-line">${isDebit ? 'Received By' : 'Deposited By'}</div></div>
            <div class="sig-box">${authoritySigHtml}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    return {
      typeLabel, voucherNo,
      documentHtml: `<div class="document">
        ${receiptBlock('Office Copy')}
        <hr class="scissor-line" />
        ${receiptBlock(isDebit ? 'Payee Copy' : 'Payer Copy')}
      </div>`,
    };
  };

  const printReceipt = async (exp) => {
    const debit = parseFloat(exp.debit) || 0;
    const credit = parseFloat(exp.credit) || 0;
    const isDebit = debit > 0;
    const amt = isDebit ? debit : credit;
    const absAmt = Math.abs(amt);
    const voucherNo = `${isDebit ? 'PV' : 'RV'}-${String(exp.id).padStart(6, '0')}`;
    const dateStr = fmtDate(exp.date);
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const siteName = (currentSite?.name || 'COMPANY').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const signerName = user?.full_name || user?.name || '';
    const amtColor = isDebit ? '#dc2626' : '#059669';

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if ((exp.payment_mode || '').toUpperCase() === 'CASH') {
      printCashReceipt({
        siteName, siteAddr,
        docTitle: isDebit ? 'Cash Payment Voucher' : 'Cash Receipt',
        voucherNo, dateStr, printedAt,
        partyLabel: isDebit ? 'Paid To' : 'Received From',
        partyName: ((isDebit ? exp.to_entity : exp.from_entity) || exp.to_entity || exp.from_entity || '').toUpperCase(),
        amount: absAmt, amountColor: amtColor,
        rows: [
          { label: 'Category', value: exp.category ? String(exp.category).toUpperCase() : '' },
          { label: 'Remark', value: exp.remark || '' },
        ],
        signerName,
        customerSigLabel: isDebit ? 'Received By' : 'Deposited By',
        row: exp,
      });
      return;
    }

    const { typeLabel, documentHtml } = await buildReceiptDocument(exp);
    const html = `<!DOCTYPE html>
<html><head>
  <title>${typeLabel.toUpperCase()} — ${voucherNo}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  ${documentHtml}
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=750');
    writePrintDocument(w, html);
    w.document.close();
  };

  // Bulk print — ONE window covering every selected native row (looping
  // window.open per row gets popup-blocked after the first). All rows go
  // through the general A4 template regardless of payment mode; ponytail:
  // CASH-mode entries lose their special A5 layout in bulk print — acceptable
  // for a multi-voucher printout, upgrade to per-mode branching if that ever
  // matters for bulk.
  const printSelectedReceipts = async (rows) => {
    if (!rows.length) return;
    const docs = await Promise.all(rows.map(buildReceiptDocument));
    const html = `<!DOCTYPE html>
<html><head>
  <title>Vouchers (${rows.length})</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  ${docs.map((d) => d.documentHtml).join('\n')}
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=750');
    writePrintDocument(w, html);
    w.document.close();
  };

  const handleBulkPrint = () => {
    const rows = expenses.filter((e) => !e.source && selection.isSelected(e.id));
    printSelectedReceipts(rows);
  };

  // Rows aggregated from other modules (exp.source set) have no /expenses/:id
  // row to select, delete, or print as a native expense — selection only
  // ever spans native rows.
  const visibleNativeIds = useMemo(
    () => expenses.filter((e) => !e.source).map((e) => e.id),
    [expenses]
  );

  // ── Guard ──
  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view expenses</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  MAIN VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 pb-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-mr-text">
            Expenses
          </h1>
          <p className="mt-1 text-[13px] text-mr-muted">
            Spending, reimbursements and bills{currentSite?.name ? ` · ${currentSite.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BulkActionsBar
            count={selection.count}
            onClear={selection.clear}
            onEdit={canUpdate ? handleBulkEdit : undefined}
            onDelete={canDelete ? handleBulkDelete : undefined}
            onPrint={handleBulkPrint}
            entityLabel="expense"
            deleting={bulkDeleting}
          />
          <Button
            variant="outline"
            onClick={() => setRadarOpen(true)}
            className="h-10 rounded-full border-mr-line text-[13px]"
            title="Category radar chart"
          >
            <RadarIcon className="mr-1.5 h-4 w-4" strokeWidth={1.9} /> Radar
          </Button>
          <Button
            variant="outline"
            onClick={downloadExcel}
            disabled={expenses.length === 0}
            className="h-10 rounded-full border-mr-line text-[13px]"
          >
            <Download className="mr-1.5 h-4 w-4" strokeWidth={1.9} /> Excel
          </Button>
          {canWrite && (
            <Button
              onClick={handleOpenCreate}
              className="h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
            >
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Add expense
            </Button>
          )}
        </div>
      </div>

      <ExpenseSummary
        totalDebit={totalDebit}
        totalCredit={totalCredit}
        netBalance={netBalance}
        entryCount={summary.total_count}
        cashIn={cashIn}
        cashOut={cashOut}
        bankIn={bankIn}
        bankOut={bankOut}
        siteName={currentSite?.name}
      />

      {/* Breakdown */}
      <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
          <CollapsibleTrigger asChild>
            <button
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-mr-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset sm:px-6"
              aria-expanded={breakdownOpen}
            >
              <span>
                <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-mr-text">
                  Spend by category
                  {breakdownLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-mr-faint" aria-hidden="true" />}
                </span>
                <span className="mt-0.5 block text-[12px] text-mr-muted">Tap a category to filter the entries below</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-mr-faint transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-mr-line px-5 pb-5 pt-4 sm:px-6">
              {breakdownLoading && !breakdownLoaded ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
                </div>
              ) : sortedCategoryBreakdown.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-mr-muted">No category data for this selection.</p>
              ) : (() => {
                const maxCatDebit = Math.max(...sortedCategoryBreakdown.map((c) => parseFloat(c.total_debit) || 0), 1);
                return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {sortedCategoryBreakdown.map((c) => {
                    const key = c.category;
                    const isActive = filterCategories.includes(key);
                    const letter = (key || '?').charAt(0).toUpperCase();
                    const share = Math.min(100, ((parseFloat(c.total_debit) || 0) / maxCatDebit) * 100);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleFilterCategory(key)}
                        aria-pressed={isActive}
                        className={`group rounded-control border p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue ${isActive
                          ? 'border-transparent bg-mr-ink text-white'
                          : 'border-mr-line bg-mr-surface hover:bg-mr-surface-2'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${isActive ? 'bg-white/15 text-white' : 'bg-mr-blue-soft text-mr-blue'}`}>
                            {letter}
                          </span>
                          <p className={`truncate text-[12px] font-medium ${isActive ? 'text-white' : 'text-mr-text'}`}>{key}</p>
                        </div>
                        <p className={`text-[17px] font-semibold tabular-nums ${isActive ? 'text-white' : 'text-mr-text'}`}>
                          ₹{fmt(c.total_debit)}
                        </p>
                        <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isActive ? 'bg-white/20' : 'bg-mr-surface-2'}`}>
                          <div className={`h-full rounded-full ${isActive ? 'bg-white/70' : 'bg-mr-coral'}`} style={{ width: `${share}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className={`text-[12px] ${isActive ? 'text-white/60' : 'text-mr-faint'}`}>{c.entries} {c.entries === 1 ? 'entry' : 'entries'}</span>
                          {c.total_credit > 0 && (
                            <span className={`text-[12px] ${isActive ? 'text-mr-lime' : 'text-mr-lime-ink'}`}>+₹{fmt(c.total_credit)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* Filter Bar */}
      <section className="rounded-panel border border-mr-line bg-mr-surface">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div role="radiogroup" aria-label="Reporting period" className="mr-rail inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-mr-line bg-mr-surface-2 p-1">
              {PERIOD_OPTIONS.map((pr) => (
                <button
                  key={pr.key}
                  type="button"
                  role="radio"
                  aria-checked={filterPeriod === pr.key}
                  onClick={() => { handlePeriodChange(pr.key); if (pr.key === 'custom') setFilterPanelOpen(true); }}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1 ${
                    filterPeriod === pr.key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text'
                  }`}
                >
                  {pr.label}
                </button>
              ))}
            </div>
            <span className="px-1 text-[12px] tabular-nums text-mr-muted">
              {totalItems} {totalItems === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <label htmlFor="mr-expense-search" className="sr-only">Search expenses</label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
              <Input
                id="mr-expense-search"
                placeholder="Search party, remark or account…"
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-10 text-[13px] shadow-none focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/25"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilterPanelOpen((open) => !open)}
              aria-expanded={filterPanelOpen}
              className={`h-10 rounded-full px-4 text-[12px] font-semibold ${filterPanelOpen || hasActiveFilters ? 'border-transparent bg-mr-ink text-white hover:bg-mr-ink-2 hover:text-white' : 'border-mr-line text-mr-muted'}`}
            >
              <Filter className="mr-1.5 h-4 w-4" strokeWidth={1.9} /> Filters
              {hasActiveFilters && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[11px]">On</span>}
            </Button>
          </div>

          <Collapsible open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
            <CollapsibleContent className="pt-0.5">
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-mr-line bg-mr-surface-2/60 p-2.5">
            {filterPeriod === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-mr-line bg-mr-surface px-3 py-1">
                <Calendar className="h-3.5 w-3.5 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                <Input
                  type="date" value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-8 w-36 rounded-control border-mr-line bg-mr-surface text-[12px]"
                />
                <span className="text-[12px] text-mr-muted">to</span>
                <Input
                  type="date" value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-8 w-36 rounded-control border-mr-line bg-mr-surface text-[12px]"
                />
              </div>
            )}

            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="h-9 w-36 rounded-full border-mr-line bg-mr-surface text-[12px]" aria-label="Filter by payment mode">
                <SelectValue placeholder="All modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {[...new Set([...PAYMENT_MODE_OPTIONS, ...autocomplete.paymentModes])].sort().map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={filterCategoryOpen} onOpenChange={setFilterCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={filterCategoryOpen}
                  className={`h-9 w-48 justify-between rounded-full text-[12px] font-normal ${
                    filterCategories.length > 0
                      ? 'border-transparent bg-mr-blue-soft text-mr-blue hover:bg-mr-blue-soft'
                      : 'border-mr-line bg-mr-surface hover:bg-mr-surface-2'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Tag className="w-3 h-3 shrink-0" />
                    {filterCategories.length === 0
                      ? 'All Categories'
                      : filterCategories.length === 1
                        ? `${filterCategories[0]} · + add`
                        : `${filterCategories.length} categories · AND`}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search category..."
                    value={filterCategorySearch}
                    onValueChange={setFilterCategorySearch}
                    className="text-xs"
                  />
                  <div className="px-2.5 pt-2 pb-1 border-b border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 leading-tight">
                      Pick multiple to chain — all categories must match (AND).
                    </span>
                    {filterCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterCategories([])}
                        className="text-[10px] font-semibold text-red-500 hover:text-red-700 shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <CommandList className="max-h-64">
                    <CommandEmpty className="py-4 text-center text-xs text-slate-400">No category found.</CommandEmpty>
                    {filterCategories.length > 0 && (
                      <CommandGroup heading={`Selected (${filterCategories.length})`}>
                        {filterCategories.map((c) => (
                          <CommandItem
                            key={`sel-${c}`}
                            value={c}
                            onSelect={() => toggleFilterCategory(c)}
                            className="text-xs"
                          >
                            <Check className="mr-2 h-4 w-4 opacity-100 text-violet-600" />
                            <span className="flex-1 truncate">{c}</span>
                            <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandGroup heading={filterCategories.length > 0 ? 'Add another' : 'Categories'}>
                      {filteredCategoryOptionsForFilter
                        .filter((c) => !filterCategories.includes(c))
                        .map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            // Keep popover open so user can add multiple categories for AND filtering.
                            onSelect={() => toggleFilterCategory(c)}
                            className="text-xs"
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            {c}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={filterTo} onValueChange={setFilterTo}>
              <SelectTrigger className="h-9 w-36 rounded-full border-mr-line bg-mr-surface text-[12px]" aria-label="Filter by recipient">
                <SelectValue placeholder="All recipients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Recipients</SelectItem>
                {uniqueToEntities.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => setFilterBillStatus(filterBillStatus === 'missing' ? 'all' : 'missing')}
              type="button"
              aria-pressed={filterBillStatus === 'missing'}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue ${
                filterBillStatus === 'missing'
                  ? 'border-transparent bg-mr-coral-ink text-white'
                  : 'border-mr-line bg-mr-surface text-mr-muted hover:text-mr-coral-ink'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
              Missing bills
            </button>

          </div>
            </CollapsibleContent>
          </Collapsible>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {filterPeriod !== 'all' && filterPeriod !== 'custom' && (
                <Badge variant="secondary" className="gap-1 rounded-full border-mr-line bg-mr-surface-2 text-[12px] font-medium text-mr-muted">
                  <Calendar className="w-3 h-3" />
                  {filterPeriod === 'today' ? 'Today' : filterPeriod === 'week' ? 'This Week' : filterPeriod === 'month' ? 'This Month' : 'Last Month'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => handlePeriodChange('all')} />
                </Badge>
              )}
              {(filterDateFrom || filterDateTo) && filterPeriod === 'custom' && (
                <Badge variant="secondary" className="gap-1 rounded-full border-mr-line bg-mr-surface-2 text-[12px] font-medium text-mr-muted">
                  <Calendar className="w-3 h-3" /> {filterDateFrom || '...'} → {filterDateTo || '...'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterPeriod('all'); }} />
                </Badge>
              )}
              {filterMode !== 'all' && (
                <Badge variant="secondary" className="gap-1 rounded-full border-mr-line bg-mr-surface-2 text-[12px] font-medium text-mr-muted">
                  <CreditCard className="w-3 h-3" /> {filterMode}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterMode('all')} />
                </Badge>
              )}
              {filterCategories.map((c) => (
                <Badge key={`cat-${c}`} variant="secondary" className="gap-1 rounded-full border-transparent bg-mr-blue-soft text-[12px] font-medium text-mr-blue">
                  <Tag className="w-3 h-3" /> {c}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => toggleFilterCategory(c)} />
                </Badge>
              ))}
              {filterCategories.length > 1 && (
                <Badge variant="outline" className="gap-1 rounded-full border-mr-line text-[12px] text-mr-muted">
                  {filterCategories.length} categories · AND
                </Badge>
              )}
              {filterTo !== 'all' && (
                <Badge variant="secondary" className="gap-1 rounded-full border-mr-line bg-mr-surface-2 text-[12px] font-medium text-mr-muted">
                  TO: {filterTo}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterTo('all')} />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1 rounded-full border-mr-line bg-mr-surface-2 text-[12px] font-medium text-mr-muted">
                  <Search className="w-3 h-3" /> &quot;{searchQuery}&quot;
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              {filterBillStatus === 'missing' && (
                <Badge variant="secondary" className="gap-1 rounded-full border-transparent bg-mr-coral-soft text-[12px] font-medium text-mr-coral-ink">
                  <AlertCircle className="w-3 h-3" /> Missing Bills
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterBillStatus('all')} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 rounded-full px-2.5 text-[12px] text-mr-muted hover:text-mr-text">Clear all</Button>
              <span className="ml-auto text-[12px] tabular-nums text-mr-muted">
                Showing <span className="font-medium text-mr-text">{expenses.length}</span> of {totalItems}
                <span className="mx-1.5 text-mr-faint">·</span>Debit <span className="font-medium text-mr-coral-ink">₹{fmt(totalDebit)}</span>
                <span className="mx-1.5 text-mr-faint">·</span>Credit <span className="font-medium text-mr-lime-ink">₹{fmt(totalCredit)}</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Expenses Table */}
      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        <div className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-mr-text">Expense entries</h2>
              <p className="mt-0.5 text-[12px] text-mr-muted">Every payment, bill and approval in one place</p>
            </div>
            <span className="text-[12px] text-mr-muted">{totalItems} record{totalItems === 1 ? '' : 's'}</span>
          </div>
          {loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={totalItems === 0 && !hasActiveFilters ? 'No expenses recorded yet' : 'No entries match your filters'}
              description={totalItems === 0 && !hasActiveFilters
                ? 'Add the first expense entry to start tracking spending against this site.'
                : 'Try a different search term, or clear the filters to see everything.'}
              action={canWrite && totalItems === 0 && !hasActiveFilters ? (
                <Button
                  onClick={handleOpenCreate}
                  className="mt-1 h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
                >
                  <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Add expense
                </Button>
              ) : null}
            />
          ) : (
            <>
              <ExpenseTable
                expenses={expenses}
                selection={selection}
                visibleNativeIds={visibleNativeIds}
                sortOrder={sortOrder}
                onToggleSort={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                isAdmin={isAdmin}
                canUpdate={canUpdate}
                canDelete={canDelete}
                uploadingBillId={uploadingBillId}
                onRefreshCheque={fetchExpenses}
                actions={expenseActions}
              />
              <ExpenseMobileList
                expenses={expenses}
                selection={selection}
                canUpdate={canUpdate}
                canDelete={canDelete}
                uploadingBillId={uploadingBillId}
                actions={expenseActions}
              />

              {/* Totals sit below the scroll area rather than in a sticky
                  tfoot competing with the sticky header for z-order. */}
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-mr-line bg-mr-surface-2/60 px-4 py-4 sm:px-6">
                <span className="text-[12px] font-medium text-mr-muted">
                  Total · {totalItems} entr{totalItems === 1 ? 'y' : 'ies'}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <span className="text-[12px] text-mr-muted">
                    Debit <span className="ml-1 text-[14px] font-semibold tabular-nums text-mr-coral-ink">₹{fmt(totalDebit)}</span>
                  </span>
                  <span className="text-[12px] text-mr-muted">
                    Credit <span className="ml-1 text-[14px] font-semibold tabular-nums text-mr-lime-ink">₹{fmt(totalCredit)}</span>
                  </span>
                  <span className="text-[12px] text-mr-muted">
                    Net <span className={`ml-1 text-[17px] font-semibold tabular-nums ${netBalance >= 0 ? 'text-mr-lime-ink' : 'text-mr-coral-ink'}`}>
                      ₹{fmt(Math.abs(netBalance))}
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {!loading && totalItems > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 overflow-x-auto border-t border-mr-line bg-mr-surface px-4 py-3.5 sm:px-6 md:flex-row">
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-[12px] text-mr-muted">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                </p>
                <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="h-8 w-17.5 border-slate-300 bg-white text-xs">
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
        </div>
      </section>

      {/* View Details Dialog */}
      <Dialog open={!!viewEntry} onOpenChange={(open) => { if (!open) setViewEntry(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {viewEntry && (() => {
            const v = viewEntry;
            const debit = parseFloat(v.debit) || 0;
            const credit = parseFloat(v.credit) || 0;
            const isDebit = debit > 0;
            const amt = isDebit ? debit : credit;
            const kv = (k, val) => val == null || val === '' ? null : (
              <div className="grid grid-cols-5 gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="col-span-2 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{k}</span>
                <span className="col-span-3 text-xs text-slate-900 font-medium break-words">{val}</span>
              </div>
            );
            return (
              <>
                <div className={`px-5 pt-5 pb-4 border-b ${isDebit ? 'bg-red-50/50 border-red-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold flex items-center gap-2">
                      <Eye className="w-4 h-4 text-slate-700" />
                      Expense Details
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      {fmtDate(v.date)} &middot; Voucher #{String(v.id).padStart(6, '0')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {isDebit ? 'Debit' : 'Credit'}
                    </span>
                    <span className={`text-2xl font-bold tabular-nums ${isDebit ? 'text-red-600' : 'text-emerald-700'}`}>
                      ₹{fmt(amt)}
                    </span>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-0">
                  {v.category && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 px-2.5 py-1 rounded-md border border-violet-200 uppercase">
                        <Tag className="w-3 h-3" /> {v.category}
                      </span>
                      {v.payment_mode && getModeBadge(v.payment_mode)}
                      {getStatusBadge(v.status || 'pending', v.approved_by_name)}
                    </div>
                  )}
                  {kv('Date', fmtDate(v.date))}
                  {kv('From / Source', v.from_entity)}
                  {kv('To / Recipient', v.to_entity)}
                  {kv('Assigned Admin', v.assigned_admin_name)}
                  {kv('Assigned User', v.assigned_user_name)}
                  {kv('Category', v.category)}
                  {kv('Payment Mode', v.payment_mode)}
                  {kv('Cheque No', v.cheque_no)}
                  {kv('Cheque Status', v.cheque_status)}
                  {kv('Account No', v.account_no)}
                  {kv('Branch', v.branch)}
                  {kv('Debit', debit > 0 ? `₹${fmt(debit)}` : null)}
                  {kv('Credit', credit > 0 ? `₹${fmt(credit)}` : null)}
                  {kv('Balance', v.balance != null ? `₹${fmt(v.balance)}` : null)}
                  {kv('Remark', v.remark)}
                  {kv('Source', v.source)}
                  {kv('Approved By', v.approved_by_name)}
                  {kv('Approved At', v.approved_at ? fmtDate(v.approved_at) : null)}
                  {kv('Created At', v.created_at ? fmtDate(v.created_at) : null)}
                  {kv('Updated At', v.updated_at ? fmtDate(v.updated_at) : null)}
                  {(v.voucher_url || v.bill_url || v.customer_signature_url) && (
                    <div className="pt-3 flex flex-wrap gap-2">
                      {v.voucher_url && (
                        <button type="button" onClick={() => openDoc({ url: v.voucher_url, title: `Voucher — ₹${fmt(amt)}` })}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-md border border-indigo-200 hover:bg-indigo-100 cursor-pointer">
                          <ExternalLink className="w-3 h-3" /> Open Voucher
                        </button>
                      )}
                      {v.bill_url && (
                        <button type="button" onClick={() => openDoc({ url: v.bill_url, title: `Bill — ₹${fmt(amt)}` })}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                          <ImageIcon className="w-3 h-3" /> Open Bill
                        </button>
                      )}
                      {v.customer_signature_url && (
                        <button type="button" onClick={() => openDoc({ url: v.customer_signature_url, title: 'Customer Signature' })}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 px-2.5 py-1.5 rounded-md border border-violet-200 hover:bg-violet-100 cursor-pointer">
                          <PenLine className="w-3 h-3" /> Customer Signature
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter className="px-5 py-3 border-t bg-slate-50 gap-2">
                  {canUpdate && !v.source && (
                    <Button variant="outline" size="sm" onClick={() => setSignEntry(v)}>
                      <PenLine className="w-3.5 h-3.5 mr-1.5" /> {v.customer_signature_url ? 'Re-Sign' : 'Sign & Print'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => printReceipt(v)}>
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Receipt
                  </Button>
                  <Button size="sm" onClick={() => setViewEntry(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Customer Signature Pad */}
      <SignaturePad
        open={!!signEntry}
        onOpenChange={(o) => { if (!o) setSignEntry(null); }}
        onSave={handleSaveSignature}
        askAuthority={!nameSignOn}
        signeeLabel={signEntry
          ? `${signEntry.to_entity || signEntry.from_entity || 'Customer'} · ₹${fmt(Math.abs(parseFloat(signEntry.debit) || parseFloat(signEntry.credit) || 0))}`
          : ''}
      />

      {/* Expense Dialog */}
      <EntryDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        title={editingId ? 'Edit Entry' : 'Record Entry'}
        description="Expense"
        footer={
          <EntryFooter
            onCancel={() => setDialogOpen(false)}
            onSubmit={() => document.getElementById('expense-entry-form')?.requestSubmit()}
            submitting={submitting}
            submitLabel={editingId ? 'Save Changes' : (isCreditTxn ? '↓ Record Credit' : '↑ Record Debit')}
            submitClassName={isCreditTxn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
          />
        }
      >
          {/* Message */}
          {message.text && (
            <div className={`flex gap-2 p-2.5 rounded-lg text-xs font-medium ${message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
              {message.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form id="expense-entry-form" onSubmit={handleSubmit} className="space-y-4">
            <CreditDebitTabs
              value={txnType}
              onChange={(value) => setTxnType(value === 'credit' ? 'credit' : 'debit')}
              debitHint="Money used"
              creditHint="Money returned"
              className="w-full"
            />

            <EntryRow>
              <EntryField label="Date" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </EntryField>
              <EntryField label="Payment Mode">
                <EntryModeChips
                  value={form.payment_mode}
                  onChange={(m) => setForm(prev => ({ ...prev, payment_mode: prev.payment_mode === m ? '' : m }))}
                  modes={PAYMENT_MODE_OPTIONS}
                />
              </EntryField>
            </EntryRow>

            <EntryAmount
              direction={txnType}
              label={isCreditTxn ? 'Amount Received (₹)' : 'Amount (₹)'}
              hint={form.amount
                ? `₹${(parseFloat(form.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} will be ${isCreditTxn ? 'credited' : 'debited'}`
                : undefined}
              inputProps={{
                step: '0.01',
                placeholder: '0.00',
                value: form.amount,
                onChange: (e) => setForm(prev => ({ ...prev, amount: e.target.value })),
                required: true,
              }}
            />

            <BankAccountSelect
              value={form.bank_account_id}
              onChange={(value) => setForm((prev) => ({ ...prev, bank_account_id: value }))}
              paymentMode={form.payment_mode}
              disabled={submitting}
              required
            />

            {form.payment_mode === 'CHEQUE' && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cheque Details</p>
                <EntryField label="Cheque No">
                  <Input placeholder="Enter cheque number"
                    value={form.cheque_no || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, cheque_no: e.target.value }))} />
                </EntryField>
              </div>
            )}

            {/* Bank details */}
            {isBankMode && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bank Details</p>
                <EntryRow>
                  <EntryField label="Account No">
                    <Input placeholder="CNRB-077582..."
                      value={form.account_no}
                      onChange={(e) => setForm(prev => ({ ...prev, account_no: e.target.value.toUpperCase() }))}
                      list="exp-acc-suggestions" />
                    <datalist id="exp-acc-suggestions">
                      {autocomplete.accountNos.map((a) => <option key={a} value={a} />)}
                    </datalist>
                  </EntryField>
                  <EntryField label="Branch">
                    <Input placeholder="MAIN, SADAR..."
                      value={form.branch}
                      onChange={(e) => setForm(prev => ({ ...prev, branch: e.target.value.toUpperCase() }))}
                      list="exp-branch-suggestions" />
                    <datalist id="exp-branch-suggestions">
                      {autocomplete.branches.map((b) => <option key={b} value={b} />)}
                    </datalist>
                  </EntryField>
                </EntryRow>
              </div>
            )}

            <EntryRow>
              <EntryField label="Category">
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen} modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="h-9 w-full justify-between font-normal"
                    >
                      <span className={form.category ? 'text-foreground' : 'text-muted-foreground'}>
                        {form.category || 'Select category...'}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    style={{ width: 'var(--radix-popover-trigger-width)' }}
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command shouldFilter={true}>
                      <CommandInput placeholder="Search category..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="— None —"
                            onSelect={() => { setForm(prev => ({ ...prev, category: '' })); setCategoryOpen(false); }}
                            className="text-muted-foreground"
                          >— None —</CommandItem>
                          {allCategoryOptions.map((c) => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={(val) => {
                                const matched = allCategoryOptions.find(opt => opt.toLowerCase() === val.toLowerCase()) || val;
                                setForm(prev => ({ ...prev, category: matched }));
                                setCategoryOpen(false);
                              }}
                            >
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </EntryField>

              {/* Assign To Admin */}
              {(isAdmin || canManage) && approvers.length > 0 && (
                <EntryField label="Assign To Admin">
                <Select value={form.assigned_admin_id?.toString() || '_none'} onValueChange={(v) => setForm(prev => ({ ...prev, assigned_admin_id: v === '_none' ? null : parseInt(v) }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver..." />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="_none">— Auto-assign or no preference —</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={app.id.toString()}>
                        {app.full_name || app.name || app.email || `Admin #${app.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </EntryField>
              )}
            </EntryRow>

            {/* Remark */}
            <EntryField label="Remark">
              <Textarea placeholder="ADJUST A19 DG, TRF TO A7, IN BANK..."
                value={form.remark}
                onChange={(e) => setForm(prev => ({ ...prev, remark: e.target.value.toUpperCase() }))}
                rows={2} className="resize-none" />
            </EntryField>

            {/* Voucher upload area */}
            <EntryField label="Voucher / Receipt">
              {form.voucher_url && !uploadingVoucher ? (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-100">
                    <FileImage className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-blue-800 truncate">Voucher uploaded</p>
                    <button type="button" onClick={() => openDoc({ url: form.voucher_url, title: 'Voucher / Receipt' })}
                      className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer">
                      <ExternalLink className="w-2.5 h-2.5" /> View file
                    </button>
                  </div>
                  <button type="button"
                    onClick={() => { setForm(prev => ({ ...prev, voucher_url: '' })); if (voucherInputRef.current) voucherInputRef.current.value = ''; }}
                    className="text-blue-400 hover:text-red-500 transition-colors p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
                  uploadingVoucher
                    ? 'border-slate-200 bg-slate-50 cursor-wait'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                  {uploadingVoucher ? (
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  ) : (
                    <UploadCloud className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="text-[11px] text-slate-500 font-medium">
                    {uploadingVoucher ? 'Uploading...' : 'Click to upload image or PDF'}
                  </span>
                  <input
                    ref={voucherInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleVoucherUpload}
                    disabled={uploadingVoucher}
                    className="hidden"
                  />
                </label>
              )}
            </EntryField>
          </form>
      </EntryDialog>

      {/* ── Category Radar Modal ── */}
      <Dialog open={radarOpen} onOpenChange={setRadarOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {(() => {
            const radarData = (() => {
              const rows = (categoryBreakdown || [])
                .map((r) => ({
                  category: r.category || 'UNCATEGORIZED',
                  debit: parseFloat(r.total_debit) || 0,
                  credit: parseFloat(r.total_credit) || 0,
                  entries: parseInt(r.entries, 10) || 0,
                }))
                .filter((r) => r.debit > 0 || r.credit > 0);
              if (radarSort === 'name') rows.sort((a, b) => a.category.localeCompare(b.category));
              else rows.sort((a, b) => b.debit - a.debit);
              // Radar charts become unreadable past ~12 axes; show top N and fold the rest into "Others".
              const TOP = 12;
              if (rows.length <= TOP) return rows;
              const top = rows.slice(0, TOP);
              const rest = rows.slice(TOP);
              const otherDebit = rest.reduce((s, r) => s + r.debit, 0);
              const otherCredit = rest.reduce((s, r) => s + r.credit, 0);
              const otherEntries = rest.reduce((s, r) => s + r.entries, 0);
              return [...top, { category: `Others (${rest.length})`, debit: otherDebit, credit: otherCredit, entries: otherEntries }];
            })();

            const totalDebit = radarData.reduce((s, r) => s + r.debit, 0);
            const topCategory = radarData.reduce((best, r) => (!best || r.debit > best.debit ? r : best), null);

            return (
              <>
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                          <RadarIcon className="w-4 h-4" />
                        </div>
                        <DialogTitle className="text-base font-bold text-slate-900">Expenses by Category</DialogTitle>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Radar view of spending across categories — reflects the active filters.
                      </p>
                    </div>
                    <Tabs value={radarSort} onValueChange={setRadarSort}>
                      <TabsList className="h-7">
                        <TabsTrigger value="debit" className="text-[11px] px-2.5">Top spend</TabsTrigger>
                        <TabsTrigger value="name" className="text-[11px] px-2.5">A → Z</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {breakdownLoading && !breakdownLoaded ? (
                    <div className="h-80 flex items-center justify-center text-xs text-slate-400 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading categories…
                    </div>
                  ) : radarData.length === 0 ? (
                    <div className="h-80 flex flex-col items-center justify-center text-xs text-slate-400">
                      <Tag className="w-8 h-8 mb-2 opacity-40" />
                      No category data for the current filters.
                    </div>
                  ) : (
                    <>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                              dataKey="category"
                              tick={{ fill: '#475569', fontSize: 10 }}
                              tickFormatter={(v) => (v && v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                            />
                            <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={fmt} />
                            <RechartsTooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                              formatter={(value, name, props) => {
                                if (name === 'Debit') {
                                  const entries = props?.payload?.entries || 0;
                                  return [`₹${fmt(value)} (${entries} entr${entries === 1 ? 'y' : 'ies'})`, 'Debit'];
                                }
                                return [`₹${fmt(value)}`, name];
                              }}
                              labelStyle={{ fontWeight: 700, color: '#0f172a' }}
                            />
                            <Radar
                              name="Debit"
                              dataKey="debit"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              fill="#8b5cf6"
                              fillOpacity={0.18}
                              dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div className="rounded-lg bg-violet-50/60 border border-violet-100 px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categories</p>
                          <p className="text-sm font-extrabold text-violet-700 tabular-nums mt-0.5">{radarData.length}</p>
                        </div>
                        <div className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Debit</p>
                          <p className="text-sm font-extrabold text-red-700 tabular-nums mt-0.5">₹{fmt(totalDebit)}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50/80 border border-slate-200 px-3 py-2 col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Category</p>
                          <p className="text-sm font-bold text-slate-800 truncate mt-0.5" title={topCategory?.category}>
                            {topCategory?.category || '—'}
                          </p>
                          <p className="text-[10px] text-slate-500 tabular-nums">₹{fmt(topCategory?.debit || 0)}</p>
                        </div>
                      </div>

                      <div className="max-h-44 overflow-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
                        {radarData.map((r) => {
                          const pct = totalDebit > 0 ? (r.debit / totalDebit) * 100 : 0;
                          return (
                            <div key={r.category} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                              <span className="flex-1 truncate text-slate-700" title={r.category}>{r.category}</span>
                              <span className="text-[10px] text-slate-400 tabular-nums w-10 text-right">{r.entries}</span>
                              <span className="font-semibold text-slate-800 tabular-nums w-20 text-right">₹{fmt(r.debit)}</span>
                              <span className="text-[10px] text-slate-500 tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
