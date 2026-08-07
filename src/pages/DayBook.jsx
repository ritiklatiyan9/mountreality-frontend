import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import CreditDebitTabs from '../components/CreditDebitTabs';
import {
  EntryRow, EntryField, EntryAmount, EntryModeChips, FieldLabel,
} from '../components/EntryModal';
import { cn } from '@/lib/utils';
import { classifyPaymentMode, BUCKETS, BUCKET_LABELS, NON_CASH_BUCKETS } from '../utils/paymentMode';
import QRCode from 'qrcode';
import ChequeStatusControl from '../components/ChequeStatusControl';
import * as XLSX from 'xlsx';
import { Calendar as ShadCalendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, parse } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ChevronDown, Building2, ArrowUpRight, ArrowDownRight, ArrowDownLeft,
  Download, Printer, BookOpen, BarChart3, Hash, MapPin,
  Filter, X, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Activity, Users, FileText,
  Camera, ArrowUpDown, PenLine, Tag, ArrowLeftRight, User, MessageSquare, Landmark,
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { printCashReceipt } from '../lib/cashReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn, CUSTOMER_SIGN_CSS } from '../lib/receiptSignature';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const ENTRY_TYPES = ['GENERAL', 'EXPENSE', 'INCOME', 'PAYMENT', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'FARMER PAYMENT', 'PLOT COMMISSION', 'VENDOR PAYMENT', 'PLOT PAYMENT', 'CASH FLOW', 'FIRM TRANSACTION', 'OTHER'];
const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'ADJUST', 'RETURN', 'REFUND',
];
const derivePaymentType = (raw) => {
  const bucket = classifyPaymentMode(raw);
  return bucket === 'cash' ? 'CASH' : bucket === 'cheque' ? 'CHEQUE' : 'BANK';
};

const FARMER_PAY_MODES = ['CASH', 'RTGS', 'CASH PLOT PAYMENT', 'CASH REFUND PLOT PAYMENT', 'PAY ADVANCE', 'CHEQUE', 'NEFT', 'UPI', 'BANK TRANSFER'];
const PAY_MODES = ['CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST'];
const CATEGORIES = [
  'CONSTRUCTION', 'MATERIAL', 'LABOUR', 'TRANSPORT', 'OFFICE', 'SALARY', 'BROKERAGE', 'LEGAL',
  'MAINTENANCE', 'UTILITIES', 'MISC', 'CEMENT', 'SAND', 'STEEL', 'BRICKS', 'PLUMBING', 'ELECTRICAL',
  'PAINTING', 'FLOORING', 'TILES', 'WOOD', 'HARDWARE', 'CARPENTRY', 'WELDING', 'FABRICATION',
  'GLASS', 'ALUMINIUM', 'ROOFING', 'EXCAVATION', 'EARTH WORK', 'BORING', 'WATER SUPPLY', 'DRAINAGE',
  'COMPOUND WALL', 'FENCING', 'GATE', 'ROAD WORK', 'LANDSCAPING', 'ARCHITECT', 'ENGINEER', 'SURVEYOR',
  'CONSULTANT', 'CONTRACTOR', 'GOVERNMENT', 'REGISTRATION', 'STAMP DUTY', 'TAX', 'GST', 'TDS',
  'INSURANCE', 'RENT', 'TELEPHONE', 'INTERNET', 'PETROL', 'DIESEL', 'FOOD', 'REFRESHMENT', 'PRINTING',
  'STATIONERY', 'COURIER', 'ADVANCE', 'DEPOSIT', 'REFUND', 'LOAN', 'EMI', 'INTEREST', 'COMMISSION',
  'MARKETING', 'ADVERTISEMENT', 'SOCIETY', 'DONATION', 'MACHINERY', 'EQUIPMENT', 'VEHICLE',
  'FURNITURE', 'FIXTURE', 'DEMOLITION', 'CLEANING', 'SECURITY', 'MISCELLANEOUS',
];

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const TYPE_STYLE = {
  GENERAL: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  EXPENSE: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  INCOME: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PAYMENT: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  RECEIPT: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  TRANSFER: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  ADJUSTMENT: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'FARMER PAYMENT': { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
  'PLOT COMMISSION': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  'VENDOR PAYMENT': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'COMMISSION PAYMENT': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  'INSTALLMENT PAYMENT': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  'CASH FLOW': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'FIRM TRANSACTION': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'PLOT PAYMENT': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const MODE_STYLE = {
  CASH: 'bg-green-50 text-green-700 border-green-200',
  UPI: 'bg-blue-50 text-blue-700 border-blue-200',
  CHEQUE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  BANK: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  TRANSFER: 'bg-blue-50 text-blue-700 border-blue-200',
  NEFT: 'bg-teal-50 text-teal-700 border-teal-200',
  RTGS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  IMPS: 'bg-orange-50 text-orange-700 border-orange-200',
  ADJUST: 'bg-sky-50 text-sky-700 border-sky-200',
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(parseFloat(v) || 0);
const isPostedEntry = (entry) => {
  const chequeStatus = String(entry?.cheque_status || '').toUpperCase();
  if (chequeStatus === 'BOUNCED' || chequeStatus === 'RETURNED') return false;
  return String(entry?.status ?? 'approved').toLowerCase() === 'approved';
};
const scopeEntriesByBook = (sourceEntries, scope) => {
  return sourceEntries.flatMap((entry) => {
    const rawMode = String(entry.payment_mode || '').trim().toUpperCase();
    const cashAmount = Number(entry.cash_amount) || 0;
    const bankAmount = Number(entry.bank_amount) || 0;
    if (rawMode === 'SPLIT' && (cashAmount > 0 || bankAmount > 0)) {
      if (scope === 'all') {
        return [{
          ...entry,
          source_debit: entry.source_debit ?? entry.debit,
          source_credit: entry.source_credit ?? entry.credit,
          debit: cashAmount + bankAmount,
          credit: 0,
        }];
      }
      const amount = scope === 'cash' ? cashAmount : bankAmount;
      if (amount <= 0) return [];
      return [{
        ...entry,
        source_debit: entry.debit,
        source_credit: entry.credit,
        source_payment_mode: entry.payment_mode,
        debit: amount,
        credit: 0,
        payment_mode: scope === 'cash' ? 'CASH' : 'BANK',
      }];
    }
    if (scope === 'all') return [entry];
    const isCash = classifyPaymentMode(entry.payment_mode) === 'cash';
    return (scope === 'cash' ? isCash : !isCash) ? [entry] : [];
  });
};
const fmtDate = (d) => {
  if (!d || typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d + 'T00:00:00')); }
  catch { return ''; }
};
const fmtDateLong = (d) => {
  if (!d || typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  try { return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d + 'T00:00:00')); }
  catch { return ''; }
};
const toISO = (d) => { const dt = d instanceof Date ? d : new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
const TODAY = toISO(new Date());

const DAYBOOK_PERIODS = [
  ['date', 'Day'], ['week', 'Week'], ['month', 'Month'], ['overall', 'Overall'], ['custom', 'Select range'],
];
const STATEMENT_SOURCE_LABELS = {
  expenses: 'EXPENSE', farmer_payments: 'FARMER PAYMENT', plot_payments: 'PLOT PAYMENT',
  plot_installment_payments: 'INSTALLMENT PAYMENT',
  plot_commissions: 'PLOT COMMISSION', plot_commission_payments: 'COMMISSION PAYMENT',
  vendor_payments: 'VENDOR PAYMENT', firm_transactions: 'FIRM TRANSACTION',
  personal_ledger: 'CASH FLOW', day_book: 'GENERAL',
};
// source_key → day-view id prefix; sources listed here have working
// edit/delete endpoints, everything else stays read-only in statements.
const STATEMENT_EDIT_PREFIX = {
  expenses: 'expense', farmer_payments: 'fp', plot_payments: 'pp',
  firm_transactions: 'ft', plot_commissions: 'comm',
  vendor_payments: 'vp', plot_commission_payments: 'pcp',
  plot_installment_payments: 'pip',
};
// vp/pcp/pip rows are updated through the generic module route
const MODULE_PAYMENT_ROUTE = { vp: 'vendor-payment', pcp: 'commission-payment', pip: 'installment-payment' };
const modulePaymentRoute = (id) => typeof id === 'string' ? MODULE_PAYMENT_ROUTE[id.split('_')[0]] : undefined;
const statementEditId = (item) => {
  if (String(item.id).includes(':')) return null; // split cash/bank leg — edit the source row from the day view instead
  if (item.source_key === 'day_book') return item.source_id ? Number(item.source_id) : null;
  if (item.source_key === 'personal_ledger' || !item.source_key) return `cf_${item.id}`;
  const prefix = STATEMENT_EDIT_PREFIX[item.source_key];
  return prefix && item.source_id ? `${prefix}_${item.source_id}` : null;
};
const periodRange = (preset, selectedDate, customFrom, customTo) => {
  if (preset === 'date') return { from: selectedDate, to: selectedDate };
  if (preset === 'overall') return { from: '', to: '' };
  if (preset === 'custom') return { from: customFrom, to: customTo };
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  if (preset === 'week') {
    const day = from.getDay() || 7;
    from.setDate(from.getDate() - day + 1);
  } else if (preset === 'month') from.setDate(1);
  else if (preset === 'year') from.setMonth(0, 1);
  return { from: toISO(from), to: toISO(to) };
};
const statementEscape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const compareEntriesChronologically = (a, b) => {
  const dateCmp = String(a?.date || '').localeCompare(String(b?.date || ''));
  if (dateCmp) return dateCmp;
  const aCreated = Date.parse(a?.created_at || '') || 0;
  const bCreated = Date.parse(b?.created_at || '') || 0;
  if (aCreated !== bCreated) return aCreated - bCreated;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), undefined, { numeric: true });
};

const blankForm = (date) => ({
  date: date || TODAY,
  particular: '', entry_type: 'GENERAL', debit: '', credit: '',
  remarks: '', payment_mode: '', category: '',
  from_entity: '', to_entity: '', account_no: '', branch: '',
  farmer_id: '', interest_rate: '', interest_amount: '', by_note: '',
  plot_no: '', plot_size: '', plot_rate: '', father_name: '', commission_person: '',
  ledger_name: '', ledger_type: 'site', cf_key: '',
  firm_id: '', firm_name: '', firm_purpose: '', firm_remark: '', firm_cheque_no: '',
  pp_plot_id: '', pp_payment_from: '', pp_payment_type: 'CASH', pp_bank_details: '', pp_narration: '', pp_received_by: '', pp_cheque_no: '',
  cheque_no: '',
  assigned_admin_id: null,
  voucher_url: '',
});

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
const DayBook = () => {
  const location = useLocation();
  const { currentSite, isAdmin, canManage, hasPermission, user } = useAuth();
  const canUpdate = canManage && hasPermission('daybook', 'update');
  const canDelete = canManage && hasPermission('daybook', 'delete');
  const siteId = currentSite?.id;

  const daybookPreset = useMemo(() => {
    if (location.pathname.startsWith('/daybook/cash')) return 'cash';
    if (location.pathname.startsWith('/daybook/bank')) return 'bank';
    return 'all';
  }, [location.pathname]);

  const daybookTitle = daybookPreset === 'cash' ? 'Cash Day Book' : daybookPreset === 'bank' ? 'Bank Day Book' : 'Day Book';

  /* ── State ── */
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    opening_balance: 0,
    closing_balance: 0,
    total_debit: 0,
    total_credit: 0,
    total_count: 0,
  });
  const [modeBalance, setModeBalance] = useState(null);
  const [typeBreakdown, setTypeBD] = useState([]);
  const [modeBreakdown, setModeBD] = useState([]);
  const [categoryBreakdown, setCatBD] = useState([]);
  const [autocomplete, setAC] = useState({ particulars: [], fromEntities: [], toEntities: [], paymentModes: [], remarks: [], accountNos: [], branches: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [cashflowLedgers, setCashflowLedgers] = useState([]);
  const [firms, setFirms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [voucherUploading, setVoucherUploading] = useState(false);
  const [genDir, setGenDir] = useState('debit'); // generic-entry direction tab; maps to debit/credit payload fields
  const [receiptEntry, setReceiptEntry] = useState(null);
  const [signEntry, setSignEntry] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptQr, setReceiptQr] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Edit request (sub-admin proof photo)
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };
  const clearProofPhoto = () => {
    setProofPhoto(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
  };

  /* ── Selected Date (core concept: Day Book = one day at a time) ── */
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [autoJumped, setAutoJumped] = useState(false);
  // "Day" is the default: it's the only view backed by full per-source record IDs,
  // so it's the only one where Add/Edit/Delete can actually work. The other tabs
  // (Overall/Week/Month/Custom) pull from the cross-module Balance Sheet
  // aggregation, which is intentionally read-only — still available, just not
  // what you land on.
  const [periodPreset, setPeriodPreset] = useState('date');
  const [customFrom, setCustomFrom] = useState(toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(TODAY);
  const isRangeStatement = periodPreset !== 'date';
  const activePeriod = useMemo(
    () => periodRange(periodPreset, selectedDate, customFrom, customTo),
    [periodPreset, selectedDate, customFrom, customTo],
  );

  /* filters (within the selected date) */
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [fMode, setFMode] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [bdTab, setBdTab] = useState('type');


  /* ── Single-day working view + optimized read-only period statements ── */
  const fetchEntries = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      if (!isRangeStatement) {
        const { data } = await api.get(`/daybook?site_id=${siteId}&date=${selectedDate}`);
        setEntries(data.entries || []);
        setSummary(data.summary || {
          opening_balance: 0,
          closing_balance: 0,
          total_debit: 0,
          total_credit: 0,
          total_count: 0,
        });
        setTypeBD(data.typeBreakdown || []);
        setModeBD(data.modeBreakdown || []);
        setCatBD(data.categoryBreakdown || []);
      } else {
        if (activePeriod.from && activePeriod.to && activePeriod.from > activePeriod.to) {
          setEntries([]);
          setMessage({ type: 'error', text: 'From date cannot be after To date' });
          return;
        }
        const params = new URLSearchParams({
          site_id: String(siteId),
          scope: daybookPreset,
          // Export/print must include the whole selected statement, not just the current page.
          limit: '100000',
        });
        if (activePeriod.from) params.set('date_from', activePeriod.from);
        if (activePeriod.to) params.set('date_to', activePeriod.to);
        const { data } = await api.get(`/balance-sheet?${params.toString()}`);
        const mapped = (data.transactions || []).map((item) => {
          const editId = statementEditId(item);
          return {
            id: `statement_${item.id}`,
            original_id: item.id,
            edit_id: editId,
            site_id: siteId,
            date: item.entry_date,
            particular: item.particular,
            entry_type: STATEMENT_SOURCE_LABELS[item.source_key] || 'GENERAL',
            debit: item.debit,
            credit: item.credit,
            running_balance: item.running_balance,
            remarks: item.remarks,
            payment_mode: String(item.payment_mode || item.bucket || '').toUpperCase(),
            category: STATEMENT_SOURCE_LABELS[item.source_key] || item.source_key,
            from_entity: item.entity_name,
            to_entity: item.linked_detail,
            voucher_url: item.voucher_url,
            cheque_status: item.cheque_status,
            cheque_no: item.cheque_no,
            source: 'balance_statement',
            readonly_statement: !editId,
            status: item.status,
          };
        });
        setEntries(mapped);
        setSummary({
          opening_balance: data.summary?.opening_balance || 0,
          closing_balance: data.summary?.closing_balance || 0,
          total_debit: data.summary?.total_debit || 0,
          total_credit: data.summary?.total_credit || 0,
          total_count: data.summary?.total_entries || 0,
        });
        setTypeBD((data.by_source || []).map((item) => ({
          entry_type: STATEMENT_SOURCE_LABELS[item.source_key] || item.source_key,
          entries: item.entries,
          total_debit: item.total_debit,
          total_credit: item.total_credit,
        })));
        setModeBD((data.by_mode || []).map((item) => ({
          payment_mode: String(item.payment_mode || item.bucket).toUpperCase(),
          entries: item.entries,
          total_debit: item.total_debit,
          total_credit: item.total_credit,
        })));
        setCatBD([]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [siteId, selectedDate, isRangeStatement, activePeriod, daybookPreset]);

  /* ── Fetch dropdown data (site-level – only fires on site change) ── */
  const fetchDropdowns = useCallback(async () => {
    if (!siteId) return;
    try {
      const [aRes, fRes, mRes, cfRes, firmRes, plotRes, appRes] = await Promise.all([
        api.get(`/daybook/autocomplete?site_id=${siteId}`),
        api.get(`/daybook/farmers?site_id=${siteId}`),
        api.get(`/daybook/members?site_id=${siteId}`),
        api.get(`/daybook/cashflow-ledgers?site_id=${siteId}`),
        api.get(`/daybook/firms?site_id=${siteId}`),
        api.get(`/daybook/plots?site_id=${siteId}`),
        api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
      ]);
      setAC(aRes.data || { particulars: [], fromEntities: [], toEntities: [], paymentModes: [], remarks: [], accountNos: [], branches: [], categories: [] });
      setFarmers(fRes.data.farmers || []);
      setMembers(mRes.data.members || []);
      setCashflowLedgers(cfRes.data.ledgers || []);
      setFirms(firmRes.data.firms || []);
      setPlots(plotRes.data.plots || []);
      setApprovers(appRes.data.approvers || []);
    } catch (err) { console.error(err); }
  }, [siteId]);



  // Fetch dropdown data once per site
  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

  // Auto-jump to latest date with data when site changes
  useEffect(() => {
    if (!siteId) return;
    if (isRangeStatement) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/daybook/latest-date?site_id=${siteId}`);
        if (!cancelled && data.latest_date && /^\d{4}-\d{2}-\d{2}$/.test(data.latest_date) && data.latest_date !== TODAY && data.latest_date <= TODAY) {
          setSelectedDate(data.latest_date);
          setAutoJumped(true);
        }
      } catch { /* ignore – will just stay on today */ }
    })();
    return () => { cancelled = true; };
  }, [siteId, isRangeStatement]);



  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  // Fetch entries on date or site change
  useEffect(() => {
    setEntries([]); setSummary({ opening_balance: 0, closing_balance: 0, total_debit: 0, total_credit: 0, total_count: 0 });
    clearFilters(); fetchEntries();
  }, [fetchEntries]);

  /* ── Cumulative per-mode balance (fetched on all three routes so the Main
     Day Book's Opening + Remaining sum matches Cash + Bank + Cheque + UPI +
     Other — previously the Main view used a different daily-balance table
     which diverged from mode-balance by several crore). ── */
  useEffect(() => {
    if (!siteId) return;
    if (isRangeStatement) {
      setModeBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/daybook/mode-balance?site_id=${siteId}&date=${selectedDate}`);
        if (!cancelled) setModeBalance(data);
      } catch (err) {
        console.error('[daybook] mode-balance fetch failed:', err);
        if (!cancelled) setModeBalance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, selectedDate, entries, isRangeStatement]);

  /* ── Date navigation ── */
  const goDay = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(toISO(d));
    setAutoJumped(false);
  };
  const goToday = () => { setSelectedDate(TODAY); setAutoJumped(false); };
  const isToday = selectedDate === TODAY;
  const statementPeriodLabel = activePeriod.from && activePeriod.to
    ? activePeriod.from === activePeriod.to
      ? fmtDate(activePeriod.from)
      : `${fmtDate(activePeriod.from)} – ${fmtDate(activePeriod.to)}`
    : 'Overall activity';

  /* ── Form Helpers ── */
  const resetForm = () => { setForm(blankForm(selectedDate)); setGenDir('debit'); setEditingId(null); setMessage({ type: '', text: '' }); clearProofPhoto(); setVoucherUploading(false); };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const isEditingExpense = editingId && typeof editingId === 'string' && editingId.startsWith('expense_');
  const isEditingFarmerPayment = editingId && typeof editingId === 'string' && editingId.startsWith('fp_');
  const isEditingDbFarmerPayment = editingId && typeof editingId === 'number' && form.entry_type === 'FARMER PAYMENT';
  const isEditingCommission = editingId && typeof editingId === 'string' && editingId.startsWith('comm_');
  const isEditingDbCommission = editingId && typeof editingId === 'number' && form.entry_type === 'PLOT COMMISSION';
  const isEditingCashFlow = editingId && typeof editingId === 'string' && editingId.startsWith('cf_');
  const isEditingDbCashFlow = editingId && typeof editingId === 'number' && form.entry_type === 'CASH FLOW';
  const isEditingFirmTxn = editingId && typeof editingId === 'string' && editingId.startsWith('ft_');
  const isEditingDbFirmTxn = editingId && typeof editingId === 'number' && form.entry_type === 'FIRM TRANSACTION';
  const isEditingPlotPayment = editingId && typeof editingId === 'string' && editingId.startsWith('pp_');
  const isEditingDbPlotPayment = editingId && typeof editingId === 'number' && form.entry_type === 'PLOT PAYMENT';
  // Generic types show the Credit/Debit tabs; specialized types (incl. EXPENSE) pin the direction, so tabs are hidden.
  const isGenericEntry = !['FARMER PAYMENT', 'PLOT COMMISSION', 'CASH FLOW', 'FIRM TRANSACTION', 'PLOT PAYMENT', 'EXPENSE'].includes(form.entry_type);
  // The 5 dual-write types render as one self-contained block in the dialog's right column.
  const isSpecializedType = ['FARMER PAYMENT', 'PLOT COMMISSION', 'CASH FLOW', 'FIRM TRANSACTION', 'PLOT PAYMENT'].includes(form.entry_type);
  // Display-only direction for the dialog header's icon/badge color — never sent to the backend.
  const dbDisplayDirection = form.entry_type === 'PLOT PAYMENT' ? 'credit'
    : (form.entry_type === 'FARMER PAYMENT' || form.entry_type === 'PLOT COMMISSION') ? 'debit'
    : (form.entry_type === 'CASH FLOW' || form.entry_type === 'FIRM TRANSACTION')
      ? (((parseFloat(form.credit) || 0) > 0 && !(parseFloat(form.debit) || 0)) ? 'credit' : 'debit')
      : genDir;
  const openEdit = (e) => {
    setForm({
      date: e.date ? toISO(e.date) : '', particular: e.particular || '',
      entry_type: e.entry_type || 'GENERAL', debit: (e.source_debit ?? e.debit) ? String(e.source_debit ?? e.debit) : '',
      credit: (e.source_credit ?? e.credit) ? String(e.source_credit ?? e.credit) : '', remarks: e.remarks || '',
      voucher_url: e.voucher_url || '',
      payment_mode: e.source_payment_mode || e.payment_mode || '', category: e.category || '',
      from_entity: e.from_entity || '', to_entity: e.to_entity || '',
      account_no: e.account_no || '', branch: e.branch || '',
      // Farmer payment fields
      farmer_id: e.farmer_id ? String(e.farmer_id) : '',
      interest_rate: e.interest_rate ? String(e.interest_rate) : '',
      interest_amount: e.interest_amount ? String(e.interest_amount) : '',
      by_note: e.by_note || e.commission_by_note || '',
      // Plot commission fields
      plot_no: e.plot_no || '',
      plot_size: e.plot_size || '',
      plot_rate: e.plot_rate || '',
      father_name: e.father_name || '',
      commission_person: e.particular || '',
      // Cash flow fields
      ledger_name: e.ledger_name || '',
      ledger_type: e.ledger_type || 'site',
      cf_key: (() => {
        // Match by ledger_name + month + year to find the cash_flow_months record id
        const match = cashflowLedgers.find(l =>
          (l.ledger_name || '') === (e.ledger_name || '') && l.month == e.cf_month && l.year == e.cf_year
        );
        return match ? `${match.id}` : '';
      })(),
      // Firm transaction fields
      firm_id: e.firm_id ? String(e.firm_id) : '',
      firm_name: e.firm_txn_name || '',
      firm_purpose: e.firm_purpose || '',
      firm_remark: e.firm_remark || '',
      firm_cheque_no: e.firm_cheque_no || '',
      // Plot payment fields
      pp_plot_id: e.pp_plot_id ? String(e.pp_plot_id) : '',
      pp_payment_from: e.pp_payment_from || '',
      pp_payment_type: e.pp_payment_type || 'BANK',
      pp_bank_details: e.pp_bank_details || '',
      pp_narration: e.pp_narration || '',
      pp_received_by: e.pp_received_by || '',
      pp_cheque_no: e.pp_cheque_no || '',
      cheque_no: e.cheque_no || '',
      assigned_admin_id: e.assigned_admin_id || null,
    });
    const editCredit = parseFloat(e.source_credit ?? e.credit) || 0;
    const editDebit = parseFloat(e.source_debit ?? e.debit) || 0;
    setGenDir(editCredit > 0 && !(editDebit > 0) ? 'credit' : 'debit');
    setEditingId(e.id); setDialogOpen(true);
  };

  // Statement rows carry only display fields — pull the full record from the
  // day view for that date so editing doesn't wipe module-specific fields
  // (farmer interest, ledger link, plot details, …).
  const openStatementEdit = async (row) => {
    if (!row.edit_id) return;
    try {
      const { data } = await api.get(`/daybook?site_id=${siteId}&date=${row.date}`);
      const match = (data.entries || []).find((en) => String(en.id) === String(row.edit_id));
      if (match) { openEdit(match); return; }
    } catch { /* fall through to limited edit below */ }
    openEdit({ ...row, id: row.edit_id });
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (voucherUploading) {
      setMessage({ type: 'error', text: 'Please wait for the evidence photo to finish uploading.' });
      return;
    }
    setMessage({ type: '', text: '' }); setSubmitting(true);
    try {
      const isFarmerPayment = form.entry_type === 'FARMER PAYMENT';
      const isCommission = form.entry_type === 'PLOT COMMISSION';
      const isCashFlow = form.entry_type === 'CASH FLOW';
      const isFirmTxn = form.entry_type === 'FIRM TRANSACTION';
      const isPlotPayment = form.entry_type === 'PLOT PAYMENT';
      const p = {
        site_id: siteId,
        date: isAdmin ? form.date : (editingId ? form.date : TODAY),
        particular: form.particular,
        entry_type: form.entry_type, debit: parseFloat(form.debit) || 0,
        credit: parseFloat(form.credit) || 0, remarks: form.remarks,
        payment_mode: form.payment_mode, category: form.category,
        from_entity: form.from_entity, to_entity: form.to_entity,
        assigned_admin_id: form.assigned_admin_id,
        account_no: form.account_no, branch: form.branch,
        voucher_url: form.voucher_url || null,
        ...(form.payment_mode === 'CHEQUE' && { cheque_no: form.cheque_no }),
        ...(isFarmerPayment && {
          farmer_id: form.farmer_id,
          interest_rate: parseFloat(form.interest_rate) || 0,
          interest_amount: parseFloat(form.interest_amount) || 0,
          by_note: form.by_note,
        }),
        ...(isCommission && {
          plot_no: form.plot_no,
          plot_size: form.plot_size,
          plot_rate: form.plot_rate,
          father_name: form.father_name,
          by_note: form.by_note,
        }),
        ...(isCashFlow && {
          ledger_name: form.ledger_name,
          ledger_type: form.ledger_type,
          ...(form.cf_key && { cash_flow_month_id: parseInt(form.cf_key) }),
        }),
        ...(isFirmTxn && {
          firm_id: form.firm_id,
          firm_name: form.firm_name,
          firm_purpose: form.firm_purpose,
          firm_remark: form.firm_remark,
          firm_cheque_no: form.firm_cheque_no,
        }),
        ...(isPlotPayment && {
          pp_plot_id: form.pp_plot_id,
          pp_payment_from: form.pp_payment_from,
          pp_payment_type: form.pp_payment_type,
          pp_bank_details: form.pp_bank_details,
          pp_narration: form.pp_narration,
          pp_received_by: form.pp_received_by,
          pp_cheque_no: form.pp_payment_type === 'CHEQUE' ? form.pp_cheque_no : undefined,
        }),
      };
      if (editingId) {
        // ── Sub-admin: send edit request instead of direct update ──
        if (!canUpdate) {
          let module = 'daybook';
          let recordId = editingId;
          if (typeof editingId === 'string') {
            if (editingId.startsWith('cf_')) { module = 'daybook_cashflow'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('ft_')) { module = 'daybook_firm_transaction'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('pp_')) { module = 'daybook_plot_payment'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('comm_')) { module = 'daybook_commission'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('fp_')) { module = 'daybook_farmer_payment'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('expense_')) { module = 'daybook_expense'; recordId = editingId.split('_')[1]; }
          } else if (typeof editingId === 'number') {
            const entry = entries.find(e => e.id === editingId);
            if (isCommission && entry?.commission_id) { module = 'daybook_commission'; recordId = entry.commission_id; }
            else if (isFarmerPayment && entry?.farmer_payment_id) { module = 'daybook_farmer_payment'; recordId = entry.farmer_payment_id; }
            else if (isCashFlow && entry?.cash_flow_entry_id) { module = 'daybook_cashflow'; recordId = entry.cash_flow_entry_id; }
            else if (isFirmTxn && entry?.firm_transaction_id) { module = 'daybook_firm_transaction'; recordId = entry.firm_transaction_id; }
            else if (isPlotPayment && entry?.plot_payment_id) { module = 'daybook_plot_payment'; recordId = entry.plot_payment_id; }
          }
          const fd = new FormData();
          fd.append('module', module);
          fd.append('record_id', String(recordId));
          fd.append('proposed_data', JSON.stringify(p));
          if (proofPhoto) fd.append('proof_photo', proofPhoto);
          await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
          setTimeout(() => setDialogOpen(false), 800);
        }
        // ── Admin: direct update ──
        // Vendor / commission / installment payments (generic module route)
        else if (modulePaymentRoute(editingId)) {
          await api.put(`/daybook/module/${modulePaymentRoute(editingId)}/${editingId.split('_')[1]}`, p);
        }
        else if (typeof editingId === 'string' && editingId.startsWith('cf_')) {
          const cfId = editingId.split('_')[1];
          await api.put(`/daybook/cashflow-entry/${cfId}`, p);
        }
        // If editing a firm-transaction-sourced entry (from Firm Transactions module)
        else if (typeof editingId === 'string' && editingId.startsWith('ft_')) {
          const ftId = editingId.split('_')[1];
          await api.put(`/daybook/firm-transaction/${ftId}`, p);
        }
        // If editing a plot-payment-sourced entry (from Plot Payments module)
        else if (typeof editingId === 'string' && editingId.startsWith('pp_')) {
          const ppId = editingId.split('_')[1];
          await api.put(`/daybook/plot-payment/${ppId}`, p);
        }
        // If editing a commission-sourced entry (from Commissions module)
        else if (typeof editingId === 'string' && editingId.startsWith('comm_')) {
          const commId = editingId.split('_')[1];
          await api.put(`/daybook/commission/${commId}`, p);
        }
        // If editing a farmer-payment-sourced entry (from Farmer Payments module)
        else if (typeof editingId === 'string' && editingId.startsWith('fp_')) {
          const fpId = editingId.split('_')[1];
          await api.put(`/daybook/farmer-payment/${fpId}`, p);
        }
        // If editing an expense-sourced entry
        else if (typeof editingId === 'string' && editingId.startsWith('expense_')) {
          const expId = editingId.split('_')[1];
          await api.put(`/daybook/expense/${expId}`, p);
        }
        // If editing a daybook entry that is linked to a commission
        else if (typeof editingId === 'number' && isCommission) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.commission_id) {
            await api.put(`/daybook/commission/${entry.commission_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a farmer payment
        else if (typeof editingId === 'number' && isFarmerPayment) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.farmer_payment_id) {
            await api.put(`/daybook/farmer-payment/${entry.farmer_payment_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a cash flow entry
        else if (typeof editingId === 'number' && isCashFlow) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.cash_flow_entry_id) {
            await api.put(`/daybook/cashflow-entry/${entry.cash_flow_entry_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a firm transaction
        else if (typeof editingId === 'number' && isFirmTxn) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.firm_transaction_id) {
            await api.put(`/daybook/firm-transaction/${entry.firm_transaction_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a plot payment
        else if (typeof editingId === 'number' && isPlotPayment) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.plot_payment_id) {
            await api.put(`/daybook/plot-payment/${entry.plot_payment_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        else {
          await api.put(`/daybook/${editingId}`, p);
        }
        if (canUpdate) setMessage({ type: 'success', text: 'Entry updated' });
      } else {
        await api.post('/daybook', p);
        setMessage({ type: 'success', text: isCommission ? 'Commission recorded in Day Book & Plot Commissions' : isFarmerPayment ? 'Farmer payment recorded in Day Book & Farmer Payments' : isCashFlow ? `Cash flow entry recorded in Day Book & "${form.ledger_name}" ledger` : isFirmTxn ? 'Firm transaction recorded in Day Book & Firm Transactions' : isPlotPayment ? 'Plot payment recorded in Day Book & Plot Payments' : 'Entry created' });
      }
      await fetchEntries(); setTimeout(() => setDialogOpen(false), 500);
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Something went wrong' }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, entry) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      if (modulePaymentRoute(id)) {
        await api.delete(`/daybook/module/${modulePaymentRoute(id)}/${id.split('_')[1]}`);
      } else if (typeof id === 'string' && id.startsWith('cf_')) {
        const cfId = id.split('_')[1];
        await api.delete(`/daybook/cashflow-entry/${cfId}`);
      } else if (typeof id === 'string' && id.startsWith('ft_')) {
        const ftId = id.split('_')[1];
        await api.delete(`/daybook/firm-transaction/${ftId}`);
      } else if (typeof id === 'string' && id.startsWith('pp_')) {
        const ppId = id.split('_')[1];
        await api.delete(`/daybook/plot-payment/${ppId}`);
      } else if (typeof id === 'string' && id.startsWith('comm_')) {
        const commId = id.split('_')[1];
        await api.delete(`/daybook/commission/${commId}`);
      } else if (typeof id === 'string' && id.startsWith('fp_')) {
        const fpId = id.split('_')[1];
        await api.delete(`/daybook/farmer-payment/${fpId}`);
      } else if (typeof id === 'string' && id.startsWith('expense_')) {
        const expId = id.split('_')[1];
        await api.delete(`/daybook/expense/${expId}`);
      } else if (entry?.firm_transaction_id) {
        await api.delete(`/daybook/firm-transaction/${entry.firm_transaction_id}`);
      } else if (entry?.plot_payment_id) {
        await api.delete(`/daybook/plot-payment/${entry.plot_payment_id}`);
      } else if (entry?.cash_flow_entry_id) {
        await api.delete(`/daybook/cashflow-entry/${entry.cash_flow_entry_id}`);
      } else if (entry?.commission_id) {
        await api.delete(`/daybook/commission/${entry.commission_id}`);
      } else if (entry?.farmer_payment_id) {
        await api.delete(`/daybook/farmer-payment/${entry.farmer_payment_id}`);
      } else {
        await api.delete(`/daybook/${id}`);
      }
      await fetchEntries();
    } catch (err) {
      console.error(err);
      window.alert(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  const clearFilters = () => { setQ(''); setFType('all'); setFMode('all'); setFCat('all'); };

  const openReceipt = (e) => { setReceiptEntry(e); setReceiptOpen(true); };

  // Generate QR for the signed verifyUrl whenever a new receipt is opened.
  useEffect(() => {
    let cancelled = false;
    if (!receiptEntry?.verifyUrl) { setReceiptQr(null); return; }
    (async () => {
      try {
        const url = await QRCode.toDataURL(receiptEntry.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setReceiptQr(url);
      } catch {
        if (!cancelled) setReceiptQr(null);
      }
    })();
    return () => { cancelled = true; };
  }, [receiptEntry]);

  // Farmer-style two-copy DayBook receipt with embedded QR + print stamp.
  const handlePrintReceipt = async (entryArg) => {
    // entryArg may be a click event (Dialog button) — only trust it if it looks like a row
    const e = entryArg && entryArg.id !== undefined ? entryArg : receiptEntry;
    if (!e) return;

    const dr = parseFloat(e.debit) || 0;
    const cr = parseFloat(e.credit) || 0;
    const isDebit = dr > 0;
    const amt = isDebit ? dr : cr;
    const amtColor = isDebit ? '#dc2626' : '#059669';
    const siteName = (currentSite?.name || 'DAY BOOK').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (e.payment_mode || '').toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';
    const entryIdStr = typeof e.id === 'string' ? e.id.replace(/\D+/g, '') : String(e.id || '');
    const refNo = `DB-${entryIdStr.padStart(5, '0')}`;
    const partyLine = e.to_entity || e.from_entity || e.farmer_name || e.agent_name || e.particular || '—';
    const party2Label = e.to_entity ? 'To' : (e.from_entity ? 'From' : 'Party');
    const docTitle = `${e.entry_type || 'Transaction'} Receipt`;

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if (isCash) {
      printCashReceipt({
        siteName, siteAddr,
        docTitle: isDebit ? 'Cash Payment Voucher' : 'Cash Receipt',
        voucherNo: refNo, dateStr: payDate, printedAt,
        partyLabel: party2Label, partyName: String(partyLine || '').toUpperCase(),
        amount: amt, amountColor: amtColor,
        rows: [
          { label: 'Entry Type', value: e.entry_type ? String(e.entry_type).toUpperCase() : '' },
          { label: (e.plot_no || e.pp_plot_no) ? 'Plot No' : '', value: e.plot_no || e.pp_plot_no || '' },
          { label: 'Remarks', value: e.remarks || '' },
        ],
        signerName,
        customerSigLabel: isDebit ? 'Receiver Signature' : 'Payer Signature',
        row: e,
      });
      return;
    }

    let qrDataUrl = null;
    if (e.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(e.verifyUrl, {
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
            <p>${siteAddr || 'PERSONAL LEDGER DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ${refNo}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${party2Label}</div><div class="c">:</div><div class="v">${String(partyLine).toUpperCase()}</div></div>
              ${e.particular ? `<div class="kv-row"><div class="k">Particular</div><div class="c">:</div><div class="v">${String(e.particular).toUpperCase()}</div></div>` : ''}
              ${e.category ? `<div class="kv-row"><div class="k">Category</div><div class="c">:</div><div class="v">${String(e.category).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(amt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(e.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Transaction Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>${refNo}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Entry Type</th><td>${(e.entry_type || '—').toUpperCase()}</td></tr>
            <tr><th>${isDebit ? 'Debit (Paid)' : 'Credit (Received)'}</th><td style="color:${amtColor}">RS ${fmtINR(amt)}/-</td></tr>
            ${e.plot_no || e.pp_plot_no ? `<tr><th>Plot No</th><td>${e.plot_no || e.pp_plot_no}</td></tr>` : ''}
            ${e.firm_name ? `<tr><th>Firm</th><td>${String(e.firm_name).toUpperCase()}</td></tr>` : ''}
            ${e.account_no ? `<tr><th>Account No</th><td>${e.account_no}</td></tr>` : ''}
            ${e.branch ? `<tr><th>Branch</th><td>${String(e.branch).toUpperCase()}</td></tr>` : ''}
            ${e.remarks ? `<tr><th>Remarks</th><td>${e.remarks}</td></tr>` : ''}
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box">${customerSigImg(e)}<div class="sig-line">${isDebit ? 'Receiver Signature' : 'Payer Signature'}</div></div>
            <div class="sig-box">${authoritySigHtml(e, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>DAYBOOK RECEIPT - ${refNo}</title>
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

    const w = window.open('', '_blank', 'width=1000,height=750');
    w.document.write(html);
    w.document.close();
  };

  /* ── Server already filters by date, entries = day's entries ── */
  const routeScopedEntries = useMemo(() => {
    return scopeEntriesByBook(entries, daybookPreset);
  }, [entries, daybookPreset]);
  const routeScopedPostedEntries = useMemo(
    () => routeScopedEntries.filter(isPostedEntry),
    [routeScopedEntries],
  );
  const routeOpeningBalance = useMemo(() => {
    if (isRangeStatement) return Number(summary.opening_balance) || 0;
    const buckets = daybookPreset === 'cash'
      ? ['cash']
      : daybookPreset === 'bank'
        ? NON_CASH_BUCKETS
        : BUCKETS;
    return buckets.reduce(
      (total, bucket) => total + (Number(modeBalance?.[bucket]?.opening_balance) || 0),
      0,
    );
  }, [isRangeStatement, modeBalance, summary.opening_balance, daybookPreset]);
  const dailyRunningBalances = useMemo(() => {
    if (isRangeStatement) return new Map();
    let balance = routeOpeningBalance;
    const balances = new Map();
    [...routeScopedEntries]
      .sort(compareEntriesChronologically)
      .forEach((entry) => {
        if (isPostedEntry(entry)) {
          balance += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
        }
        balances.set(String(entry.id), balance);
      });
    return balances;
  }, [isRangeStatement, routeOpeningBalance, routeScopedEntries]);

  const filtered = useMemo(() => {
    let l = [...routeScopedEntries];
    if (fType !== 'all') l = l.filter(e => e.entry_type === fType);
    if (fMode !== 'all') l = l.filter(e => e.payment_mode === fMode);
    if (fCat !== 'all') l = l.filter(e => e.category === fCat);
    if (q) {
      const s = q.toLowerCase();
      l = l.filter(e => e.particular?.toLowerCase().includes(s) || e.from_entity?.toLowerCase().includes(s) ||
        e.to_entity?.toLowerCase().includes(s) || e.remarks?.toLowerCase().includes(s) || e.category?.toLowerCase().includes(s));
    }
    l.sort(compareEntriesChronologically);
    if (sortOrder === 'desc') l.reverse();
    return l;
  }, [routeScopedEntries, q, fType, fMode, fCat, sortOrder]);

  const rows = useMemo(() => {
    return filtered.map(e => {
      const canonicalBalance = Number(e.running_balance);
      return {
        ...e,
        balance: isRangeStatement && Number.isFinite(canonicalBalance)
          ? canonicalBalance
          : (dailyRunningBalances.get(String(e.id)) ?? routeOpeningBalance),
      };
    });
  }, [filtered, isRangeStatement, dailyRunningBalances, routeOpeningBalance]);

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage],
  );

  useEffect(() => { setPage(1); }, [entries, q, fType, fMode, fCat, sortOrder, daybookPreset, periodPreset, selectedDate, customFrom, customTo]);

  const hasFilter = fType !== 'all' || fMode !== 'all' || fCat !== 'all' || q;
  const fTotals = useMemo(() => {
    let d = 0, c = 0;
    const posted = filtered.filter(isPostedEntry);
    posted.forEach(e => { d += parseFloat(e.debit) || 0; c += parseFloat(e.credit) || 0; });
    return { d, c, count: posted.length };
  }, [filtered]);

  /* Book totals ignore presentation filters. */
  const dayTotals = useMemo(() => {
    let d = 0, c = 0;
    routeScopedPostedEntries.forEach(e => { d += parseFloat(e.debit) || 0; c += parseFloat(e.credit) || 0; });
    return { d, c, count: routeScopedPostedEntries.length };
  }, [routeScopedPostedEntries]);

  // Mirror Balance Sheet's statement summary. For the daily operational view,
  // the authoritative opening comes from the same per-mode balance endpoint
  // that powers the live balance section below.
  const statementOpeningBalance = routeOpeningBalance;
  const serverClosingBalance = Number(summary.closing_balance);
  const statementClosingBalance = isRangeStatement && Number.isFinite(serverClosingBalance)
    ? serverClosingBalance
    : statementOpeningBalance + dayTotals.c - dayTotals.d;

  const net = dayTotals.c - dayTotals.d;

  const uTypes = useMemo(() => [...new Set(routeScopedEntries.map(e => e.entry_type).filter(Boolean))].sort(), [routeScopedEntries]);

  /* entryDates not needed — server filters by date */

  /* ── Export ── */
  // Builds one formatted worksheet (header block + statement summary + rows + totals)
  // for an arbitrary entry list — reused for the Main/Cash/Bank sheets below so all
  // three share identical layout, number formatting and running-balance logic.
  const buildDaybookSheet = (sheetTitle, sourceEntries, openingBalance, label) => {
    const headers = ['#', 'Date', 'Particular / Entity', 'Type', 'Mode', 'Debit (₹)', 'Credit (₹)', 'Running balance (₹)', 'Category', 'Remarks'];
    let bal = openingBalance;
    // Statements always calculate forward from opening in chronological order;
    // the on-screen sort direction is presentation-only.
    const ordered = [...sourceEntries].sort(compareEntriesChronologically);
    const withBalance = ordered.map((entry) => {
      bal += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
      return { ...entry, balance: bal };
    });
    const debitTotal = withBalance.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const creditTotal = withBalance.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    const closingBalance = openingBalance + creditTotal - debitTotal;
    const data = withBalance.map((entry, index) => [
      index + 1,
      fmtDate(entry.date),
      entry.particular || [entry.from_entity, entry.to_entity].filter(Boolean).join(' → ') || '',
      entry.entry_type || 'GENERAL',
      entry.payment_mode || '',
      Number(entry.debit) || 0,
      Number(entry.credit) || 0,
      Number(entry.balance) || 0,
      entry.category || '',
      entry.remarks || '',
    ]);
    const sheetRows = [
      [currentSite?.name || 'DG Account'],
      [`${sheetTitle} — ${daybookTitle}`],
      [`Period: ${label}`],
      [`Generated: ${new Date().toLocaleString('en-IN')} · ${withBalance.length} entries`],
      [],
      ['Statement summary'],
      ['Opening balance', '', 'Money in', '', 'Money out', '', 'Closing balance'],
      [openingBalance, '', creditTotal, '', debitTotal, '', closingBalance],
      [],
      headers,
      ...data,
      [],
      ['Totals', '', '', '', '', debitTotal, creditTotal, closingBalance],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:J1'), XLSX.utils.decode_range('A2:J2'),
      XLSX.utils.decode_range('A3:J3'), XLSX.utils.decode_range('A4:J4'),
    ];
    ws['!cols'] = [
      { wch: 7 }, { wch: 14 }, { wch: 34 }, { wch: 20 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 38 },
    ];
    ws['!rows'] = sheetRows.map((_, index) => ({ hpt: index === 0 ? 26 : index === 1 ? 21 : index === 9 ? 22 : 18 }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 9, c: 0 }, e: { r: 9 + data.length, c: headers.length - 1 } }) };
    for (let rowIndex = 7; rowIndex <= 11 + data.length; rowIndex += 1) {
      ['F', 'G', 'H'].forEach((col) => {
        const cell = ws[`${col}${rowIndex + 1}`];
        if (cell && typeof cell.v === 'number') cell.z = '[$₹-en-IN] #,##0';
      });
    }
    return ws;
  };

  const exportXL = () => {
    const label = isRangeStatement ? statementPeriodLabel : fmtDate(selectedDate);
    const postedEntries = entries.filter(isPostedEntry);
    const cashEntries = scopeEntriesByBook(postedEntries, 'cash');
    const bankEntries = scopeEntriesByBook(postedEntries, 'bank');
    const cashOpening = Number(modeBalance?.cash?.opening_balance) || 0;
    const bankOpening = NON_CASH_BUCKETS
      .reduce((sum, bucket) => sum + (Number(modeBalance?.[bucket]?.opening_balance) || 0), 0);
    const mainOpening = BUCKETS
      .reduce((sum, bucket) => sum + (Number(modeBalance?.[bucket]?.opening_balance) || 0), 0);

    const wb = XLSX.utils.book_new();
    if (isRangeStatement) {
      // The range endpoint is already scoped to the current route. Export one
      // accurately-labelled book with the opening returned for that scope;
      // emitting the other two used to fabricate zero openings from a cleared
      // modeBalance state and label a Bank-only data set as "Main".
      const sheetName = daybookPreset === 'cash' ? 'Cash' : daybookPreset === 'bank' ? 'Bank' : 'Main';
      const sheetTitle = daybookPreset === 'cash'
        ? 'Cash'
        : daybookPreset === 'bank'
          ? 'Bank'
          : 'Main (All Accounts)';
      XLSX.utils.book_append_sheet(
        wb,
        buildDaybookSheet(sheetTitle, postedEntries, statementOpeningBalance, label),
        sheetName,
      );
    } else {
      XLSX.utils.book_append_sheet(wb, buildDaybookSheet('Main (All Accounts)', postedEntries, mainOpening, label), 'Main');
      XLSX.utils.book_append_sheet(wb, buildDaybookSheet('Cash', cashEntries, cashOpening, label), 'Cash');
      XLSX.utils.book_append_sheet(wb, buildDaybookSheet('Bank', bankEntries, bankOpening, label), 'Bank');
    }

    const safeSite = (currentSite?.name || 'Site').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `DayBook_${safeSite}_${isRangeStatement ? periodPreset : selectedDate}.xlsx`);
  };

  const printDaybookStatement = () => {
    const postedRows = rows.filter(isPostedEntry);
    const printableRows = postedRows.map((entry, index) => `
      <tr>
        <td>${index + 1}</td><td>${statementEscape(fmtDate(entry.date))}</td>
        <td><strong>${statementEscape(entry.particular || '—')}</strong>${entry.from_entity || entry.to_entity ? `<small>${statementEscape([entry.from_entity, entry.to_entity].filter(Boolean).join(' → '))}</small>` : ''}</td>
        <td>${statementEscape(entry.entry_type || 'GENERAL')}</td><td>${statementEscape(entry.payment_mode || '—')}</td>
        <td class="number debit">${Number(entry.debit) > 0 ? statementEscape(fmt(entry.debit)) : '—'}</td>
        <td class="number credit">${Number(entry.credit) > 0 ? statementEscape(fmt(entry.credit)) : '—'}</td>
        <td class="number">${statementEscape(fmt(entry.balance))}</td>
      </tr>`).join('');
    const popup = window.open('', '_blank', 'width=1180,height=820');
    if (!popup) {
      setMessage({ type: 'error', text: 'Allow pop-ups to open the HTML statement viewer' });
      return;
    }
    const label = isRangeStatement ? statementPeriodLabel : fmtDate(selectedDate);
    popup.document.write(`<!doctype html><html><head><title>${statementEscape(daybookTitle)} · ${statementEscape(label)}</title><style>
      @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eef2ff;color:#0f172a;font:12px Inter,Arial,sans-serif}.bar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;background:#0f172a;color:#fff;padding:12px 20px}.bar span{color:#94a3b8;margin-left:8px}.bar button{border:0;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer}.print{background:#2563eb;color:#fff}.close{margin-left:8px;background:#fff;color:#334155}.sheet{width:min(1280px,calc(100% - 32px));margin:18px auto;background:#fff;padding:24px;border:1px solid #dbeafe;border-radius:16px;box-shadow:0 20px 50px #1e3a8a18}.head{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #1d4ed8;padding-bottom:16px}.brand{font-size:22px;font-weight:800;color:#1e3a8a}.muted{margin-top:4px;color:#64748b}.right{text-align:right}.right strong{display:block;font-size:16px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.card{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:12px}.card span{display:block;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-size:9px}.card strong{display:block;margin-top:5px;font-size:15px}.card.debit strong{color:#be123c}.card.credit strong{color:#047857}table{width:100%;border-collapse:collapse}th{background:#eff6ff;color:#1e3a8a;text-align:left;padding:9px 7px;font-size:9px;text-transform:uppercase;letter-spacing:.5px}td{padding:8px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}td small{display:block;margin-top:2px;color:#64748b}.number{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.debit{color:#be123c}.credit{color:#047857}.foot{display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #cbd5e1;color:#64748b;font-size:10px}@media print{body{background:#fff}.bar{display:none}.sheet{width:100%;margin:0;padding:0;border:0;border-radius:0;box-shadow:none}thead{display:table-header-group}tr{break-inside:avoid}}
    </style></head><body><div class="bar"><div><b>HTML Statement Viewer</b><span>Review before printing</span></div><div><button class="print" onclick="window.print()">Print / Save PDF</button><button class="close" onclick="window.close()">Close</button></div></div><main class="sheet"><section class="head"><div><div class="brand">${statementEscape(currentSite?.name || 'DG Account')}</div><div class="muted">${statementEscape(currentSite?.address || '')}</div><div class="muted">Approved accounting movements · Imprest excluded</div></div><div class="right"><strong>${statementEscape(daybookTitle)}</strong><span>${statementEscape(label)}</span></div></section><section class="cards"><div class="card"><span>Opening balance</span><strong>${statementEscape(fmt(statementOpeningBalance))}</strong></div><div class="card credit"><span>Book money in</span><strong>${statementEscape(fmt(dayTotals.c))}</strong></div><div class="card debit"><span>Book money out</span><strong>${statementEscape(fmt(dayTotals.d))}</strong></div><div class="card"><span>Closing balance</span><strong>${statementEscape(fmt(statementClosingBalance))}</strong></div></section><table><thead><tr><th>#</th><th>Date</th><th>Particular / entity</th><th>Type</th><th>Mode</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Running</th></tr></thead><tbody>${printableRows || '<tr><td colspan="8" style="padding:40px;text-align:center">No matching entries</td></tr>'}</tbody></table><div class="foot"><span>${postedRows.length} filtered entries: In ${statementEscape(fmt(fTotals.c))} · Out ${statementEscape(fmt(fTotals.d))}. Book totals/closing above remain authoritative.</span><span>Generated ${statementEscape(new Date().toLocaleString('en-IN'))}</span></div></main></body></html>`);
    popup.document.close();
  };

  /* ── No site ── */
  if (!siteId) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-lg font-semibold text-slate-700">No Site Selected</p>
        <p className="text-sm text-slate-400 mt-1">Please select a site from the dropdown</p>
      </div>
    </div>
  );

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ─── Header: airy product toolbar, not a boxed dashboard card ─── */}
      <header className="relative border-b border-slate-200 pb-5">
        <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">{daybookTitle}</h1>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 ring-1 ring-inset ring-blue-200">
                  {daybookPreset === 'cash' ? 'Cash' : daybookPreset === 'bank' ? 'Bank' : 'All accounts'}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {daybookPreset === 'cash' ? 'Cash entries' : daybookPreset === 'bank' ? 'All non-cash entries' : isRangeStatement ? 'Consolidated accounting statement' : 'Daily cash and bank working'}
                <span className="mx-2 text-slate-300">/</span><span className="font-medium text-slate-700">{currentSite?.name}</span>
                <span className="mx-2 text-slate-300">/</span>{dayTotals.count} entr{dayTotals.count === 1 ? 'y' : 'ies'}
              </p>
              {autoJumped && !isToday && !isRangeStatement && (
                <p className="mt-1.5 text-[11px] font-medium text-amber-700">Showing {fmtDate(selectedDate)}, the most recent day with activity.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportXL} className="h-9 rounded-full border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={printDaybookStatement} className="h-9 rounded-full border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <Printer className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Print / Save PDF
            </Button>
            {!isRangeStatement && <Button size="sm" onClick={openCreate} className="h-9 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add entry
            </Button>}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200" aria-label="Day Book period">
            {DAYBOOK_PERIODS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriodPreset(value)} className={`border-b-2 px-2.5 py-2 text-[11px] font-semibold transition-colors ${periodPreset === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
          {!isRangeStatement && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100" onClick={() => goDay(-1)} title="Previous day"><ChevronLeft className="h-4 w-4" /></Button>}
          {!isRangeStatement && <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'dd MMM, EEE') : 'Select date'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-slate-200 p-3 shadow-lg" align="end">
              <ShadCalendar
                mode="single"
                captionLayout="dropdown"
                startMonth={new Date(new Date().getFullYear() - 10, 0, 1)}
                endMonth={new Date()}
                selected={selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : new Date()}
                onSelect={(date) => { if (date) { setSelectedDate(toISO(date)); setAutoJumped(false); setCalendarOpen(false); } }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>}
          {!isRangeStatement && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100" onClick={() => goDay(1)} title="Next day"><ChevronRight className="h-4 w-4" /></Button>}
          {!isRangeStatement && !isToday && <Button variant="ghost" size="sm" onClick={goToday} className="h-8 rounded-full px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">Today</Button>}
        </div>
      </header>

      {periodPreset === 'custom' && (
        <section className="flex flex-wrap items-end gap-3 border-b border-blue-100 bg-blue-50/60 px-3 py-3">
          <div><Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">From date</Label><Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="h-8 w-40 border-slate-200 bg-white text-xs" /></div>
          <div><Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">To date</Label><Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="h-8 w-40 border-slate-200 bg-white text-xs" /></div>
          <p className="pb-1 text-[11px] text-blue-700">Read-only statement across connected accounting modules. Imprest is excluded.</p>
        </section>
      )}

      {periodPreset === 'date' && (
        <section className="flex flex-wrap items-end gap-3 border-b border-blue-100 bg-blue-50/60 px-3 py-3">
          <div><Label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Select day</Label><Input type="date" value={selectedDate} max={TODAY} onChange={(event) => { setSelectedDate(event.target.value); setAutoJumped(false); }} className="h-8 w-40 border-slate-200 bg-white text-xs" /></div>
          <p className="pb-1 text-[11px] text-blue-700">View and manage entries for one selected day.</p>
        </section>
      )}

      {/* ─── Opening + Remaining Balance (all three routes) ─── */}
      {!isRangeStatement && <BalanceCards
        isToday={isToday}
        selectedDate={selectedDate}
        mode={daybookPreset}
        modeBalance={modeBalance}
        entries={routeScopedPostedEntries}
      />}

      {/* ─── Summary Cards ─── */}
      <section className="grid grid-cols-2 border-y border-slate-200 bg-white lg:grid-cols-4">
        <DaybookMetric label={isRangeStatement ? 'Money out' : 'Day debit'} value={fmt(dayTotals.d)} tone="rose" icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
        <DaybookMetric label={isRangeStatement ? 'Money in' : 'Day credit'} value={fmt(dayTotals.c)} tone="emerald" icon={<ArrowDownRight className="h-3.5 w-3.5" />} />
        <DaybookMetric label="Net movement" value={fmt(Math.abs(net))} hint={net >= 0 ? 'Surplus' : 'Deficit'} tone={net >= 0 ? 'blue' : 'rose'} icon={<IndianRupee className="h-3.5 w-3.5" />} />
        <DaybookMetric label={isRangeStatement ? 'Statement entries' : 'Day entries'} value={dayTotals.count} hint={hasFilter && fTotals.count !== dayTotals.count ? `${fTotals.count} approved filtered` : isRangeStatement ? statementPeriodLabel : fmtDate(selectedDate)} tone="slate" icon={<Hash className="h-3.5 w-3.5" />} />
      </section>

      {/* ─── Search & Filter Toolbar ─── */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search particulars, entities, remarks…"
                value={q} onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
              />
              {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" /></button>}
            </div>
            <Button variant={showFilters || hasFilter ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}
              className={`h-9 gap-1.5 text-xs shrink-0 ${showFilters || hasFilter ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}>
              <Filter className="w-3.5 h-3.5" /> Filters
              {hasFilter && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white inline-block" />}
            </Button>
            <Button variant={showAnalytics ? 'default' : 'outline'} size="sm" onClick={() => setShowAnalytics(!showAnalytics)}
              className={`h-9 gap-1.5 text-xs shrink-0 ${showAnalytics ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1 shrink-0">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FilterSelect label="Entry Type" value={fType} onChange={setFType} allLabel="All Types" options={uTypes} />
              {daybookPreset === 'all' && (
                <FilterSelect label="Payment Mode" value={fMode} onChange={setFMode} allLabel="All Modes" options={PAY_MODES} />
              )}
              <FilterSelect label="Category" value={fCat} onChange={setFCat} allLabel="All Categories" options={CATEGORIES} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Analytics Panel ─── */}
      {showAnalytics && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Breakdown Analytics
              </CardTitle>
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {[{ k: 'type', l: 'Type' }, { k: 'mode', l: 'Mode' }, { k: 'category', l: 'Category' }].map(t => (
                  <button key={t.k} onClick={() => setBdTab(t.k)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${bdTab === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {bdTab === 'type' && typeBreakdown.map((i, x) => <BreakdownRow key={x} label={i.entry_type} count={i.entries} dr={i.total_debit} cr={i.total_credit} badge typeBadge />)}
              {bdTab === 'mode' && modeBreakdown.map((i, x) => <BreakdownRow key={x} label={i.payment_mode} count={i.entries} dr={i.total_debit} cr={i.total_credit} badge />)}
              {bdTab === 'category' && categoryBreakdown.slice(0, 12).map((i, x) => <BreakdownRow key={x} label={i.category} count={i.entries} dr={i.total_debit} cr={i.total_credit} />)}
              {bdTab === 'type' && typeBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
              {bdTab === 'mode' && modeBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
              {bdTab === 'category' && categoryBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Ledger Table ─── */}
      {/* Bleeds the ledger to the page edge — must negate main's gutter at its
          own breakpoints, or it overhangs and forces a horizontal scroll. */}
      <section className="-mx-4 md:-mx-6">
        <div className="flex items-center justify-between border-y border-slate-200 bg-slate-50 px-4 py-2.5 md:px-6">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {isRangeStatement ? statementPeriodLabel : fmtDate(selectedDate)} — {isRangeStatement ? 'Consolidated Statement' : 'Cash Working'} {hasFilter && <span className="font-normal normal-case text-slate-400">({filtered.length} of {entries.length} entries)</span>}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-red-600 tabular-nums">DR {fmt(fTotals.d)}</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-emerald-600 tabular-nums">CR {fmt(fTotals.c)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-60">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : rows.length === 0 ? null : (
          <div className="relative max-h-[calc(100dvh-180px)] overflow-auto overscroll-contain bg-white">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <TableHeader className="sticky top-0 z-40 bg-white shadow-[0_1px_0_0_#e2e8f0] [&_th]:bg-white">
                <TableRow className="bg-white hover:bg-white border-b border-slate-200">
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-12 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                      # <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 min-w-50">Particulars</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-24">Type</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-24">Mode</TableHead>
                  <TableHead className="text-[10px] font-bold text-red-500 uppercase tracking-wider h-9 w-28 text-right">Debit (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider h-9 w-28 text-right">Credit (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-30 text-right">Balance (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-36">Assigned To</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-20 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((e, i) => {
                  const dr = parseFloat(e.debit) || 0;
                  const cr = parseFloat(e.credit) || 0;
                  const bal = e.balance;
                  const ts = TYPE_STYLE[e.entry_type] || TYPE_STYLE.GENERAL;
                  const isFromExpense = e.source === 'expense';
                  const isFromFarmerPayment = e.source === 'farmer_payment' || e.source === 'daybook_farmer_payment';
                  const isFromCommission = e.source === 'commission' || e.source === 'daybook_commission';
                  const isFromCashFlow = e.source === 'cashflow' || e.source === 'daybook_cashflow';
                  const isFromFirmTxn = e.source === 'firm_transaction' || e.source === 'daybook_firm_transaction';
                  const isFromPlotPayment = e.source === 'plot_payment' || e.source === 'daybook_plot_payment';
                  return (
                    <TableRow key={e.id} className={`group hover:bg-slate-50/80 transition-colors border-b border-slate-100 ${isFromExpense ? 'bg-blue-50/30' : isFromFarmerPayment ? 'bg-lime-50/30' : isFromCommission ? 'bg-teal-50/30' : isFromCashFlow ? 'bg-amber-50/30' : isFromFirmTxn ? 'bg-indigo-50/30' : isFromPlotPayment ? 'bg-sky-50/40' : ''}`}>
                      <TableCell className="text-center text-[11px] text-slate-400 font-medium py-2.5">{((safePage - 1) * PAGE_SIZE) + i + 1}{isRangeStatement && <span className="mt-0.5 block whitespace-nowrap text-[8px] text-slate-400">{fmtDate(e.date)}</span>}</TableCell>
                      <TableCell className="py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{e.particular}</p>
                          {e.farmer_name && (
                            <p className="text-[11px] text-lime-600 font-medium mt-0.5 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {e.farmer_name}
                              {e.interest_amount > 0 && <span className="text-slate-400 ml-1">(Int: {fmt(e.interest_amount)})</span>}
                            </p>
                          )}
                          {e.plot_no && (
                            <p className="text-[11px] text-teal-600 font-medium mt-0.5 flex items-center gap-1">
                              <Hash className="w-3 h-3" /> Plot: {e.plot_no}
                              {e.plot_size && <span className="text-slate-400 ml-1">({e.plot_size})</span>}
                              {e.plot_rate && <span className="text-slate-400 ml-1">@{e.plot_rate}</span>}
                              {e.commission_by_note && <span className="text-slate-400 ml-1">• {e.commission_by_note}</span>}
                            </p>
                          )}
                          {e.father_name && (
                            <p className="text-[10px] text-slate-500 mt-0.5">S/O {e.father_name}</p>
                          )}
                          {e.ledger_name && (
                            <p className="text-[11px] text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" /> Ledger: {e.ledger_name}
                              {e.ledger_type === 'person' && <span className="text-slate-400 ml-1">(Person)</span>}
                            </p>
                          )}
                          {e.firm_name && (
                            <p className="text-[11px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Firm: {e.firm_name}
                              {e.firm_purpose && <span className="text-slate-400 ml-1">• {e.firm_purpose}</span>}
                              {e.firm_cheque_no && <span className="text-slate-400 ml-1">CHQ: {e.firm_cheque_no}</span>}
                            </p>
                          )}
                          {e.pp_plot_no && (
                            <p className="text-[11px] text-sky-700 font-medium mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Plot: {e.pp_plot_no}{e.pp_block ? ` (${e.pp_block})` : ''}
                              {e.pp_buyer_name && <span className="text-slate-500 ml-1">• {e.pp_buyer_name}</span>}
                              {e.pp_payment_from && <span className="text-slate-400 ml-1">via {e.pp_payment_from}</span>}
                              {e.pp_bank_details && <span className="text-slate-400 ml-1">• {e.pp_bank_details}</span>}
                            </p>
                          )}
                          {(e.from_entity || e.to_entity) && !e.farmer_name && (
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              {e.from_entity && <span>{e.from_entity}</span>}
                              {e.from_entity && e.to_entity && <ChevronRight className="w-3 h-3" />}
                              {e.to_entity && <span>{e.to_entity}</span>}
                            </p>
                          )}
                          {e.remarks && <p className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-xs">{e.remarks}</p>}
                          {e.category && (
                            <span className="inline-block text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0 rounded mt-1">{e.category}</span>
                          )}
                          {e.voucher_url && (
                            <span className="inline-block mt-1 ml-1" onClick={(ev) => ev.stopPropagation()}>
                              <VoucherThumbnail url={e.voucher_url} />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
                            {e.entry_type}
                          </span>
                          {isFromExpense && (
                            <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0 rounded">
                              Expense
                            </span>
                          )}
                          {isFromFarmerPayment && (
                            <span className="text-[9px] font-semibold text-lime-600 bg-lime-50 border border-lime-200 px-1.5 py-0 rounded">
                              Farmer Payment
                            </span>
                          )}
                          {isFromCommission && (
                            <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0 rounded">
                              Commission
                            </span>
                          )}
                          {isFromCashFlow && (
                            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0 rounded">
                              Cash Flow
                            </span>
                          )}
                          {isFromFirmTxn && (
                            <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0 rounded">
                              Firm Txn
                            </span>
                          )}
                          {isFromPlotPayment && (
                            <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0 rounded">
                              Plot Pmt
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {e.payment_mode ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${MODE_STYLE[e.payment_mode] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {e.payment_mode}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                        {!isRangeStatement && <ChequeStatusControl
                          chequeStatus={e.cheque_status}
                          source="daybook"
                          entryId={e.id}
                          isAdmin={isAdmin}
                          onStatusChange={fetchEntries}
                        />}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        {dr > 0
                          ? <span className="text-sm font-bold text-red-600">{fmt(dr)}</span>
                          : <span className="text-slate-200">—</span>}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        {cr > 0
                          ? <span className="text-sm font-bold text-emerald-600">{fmt(cr)}</span>
                          : <span className="text-slate-200">—</span>}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        <span className={`text-sm font-bold ${bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {bal < 0 && '−'}{bal > 0 && '+'}{fmt(Math.abs(bal))}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {e.assigned_admin_id ? (
                            <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                              {getAssignedAdminLabel(e) || '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">Unassigned</span>
                          )}
                          {e.approved_by_name && (e.status === 'approved' || e.status === 'rejected') && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-default shrink-0 ${
                                    e.status === 'approved' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                                  }`}>
                                    {e.approved_by_name[0].toUpperCase()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p>{e.status === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-semibold">{e.approved_by_name}</span></p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {isRangeStatement ? (
                          (!e.edit_id || (!canUpdate && !canDelete)) ? (
                            <span className="block text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">Read only</span>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canUpdate && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-slate-100" onClick={() => openStatementEdit(e)} title="Edit">
                                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50" onClick={() => handleDelete(e.edit_id, e)} title="Delete">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                                </Button>
                              )}
                            </div>
                          )
                        ) : <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50" title="View Receipt" onClick={() => openReceipt(e)}>
                            <FileText className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
                          </Button>
                          {canUpdate && /^\d+$/.test(String(e.id)) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50" onClick={() => setSignEntry(e)}
                              title={e.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}>
                              <PenLine className={`w-3.5 h-3.5 ${e.customer_signature_url ? 'text-emerald-500' : 'text-slate-400 hover:text-blue-600'}`} />
                            </Button>
                          )}
                          {/* Module-payment rows (vendor/commission/installment) have no
                              edit-request workflow — sub-admins see them read-only. */}
                          {(canUpdate || !modulePaymentRoute(e.id)) && (
                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${canUpdate ? 'hover:bg-slate-100' : 'hover:bg-amber-50'}`} onClick={() => openEdit(e)} title={canUpdate ? 'Edit' : 'Request Edit'}>
                              <Edit2 className={`w-3.5 h-3.5 ${canUpdate ? 'text-slate-500' : 'text-amber-500'}`} />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50" onClick={() => handleDelete(e.id, e)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                            </Button>
                          )}
                        </div>}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                  <TableCell colSpan={4} className="py-2.5">
                    <span className="text-xs font-bold text-slate-600 uppercase">{isRangeStatement ? 'Period' : 'Day'} Total ({fTotals.count} approved entries)</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className="text-sm font-bold text-red-700">{fmt(fTotals.d)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className="text-sm font-bold text-emerald-700">{fmt(fTotals.c)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className={`text-sm font-bold ${(fTotals.c - fTotals.d) > 0 ? 'text-emerald-600' : (fTotals.c - fTotals.d) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {(fTotals.c - fTotals.d) < 0 && '−'}{(fTotals.c - fTotals.d) > 0 && '+'}{fmt(Math.abs(fTotals.c - fTotals.d))}
                    </span>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </table>
          </div>
        )}
        {!loading && rows.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <p className="text-[11px] text-slate-500">Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length} entries</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="h-8 text-xs"><ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous</Button>
              <span className="min-w-20 text-center text-[11px] font-semibold text-slate-600">Page {safePage} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} className="h-8 text-xs">Next <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════════════ RECEIPT DIALOG ═══════════════════════ */}
      <SignaturePad
        open={!!signEntry}
        onOpenChange={(o) => { if (!o) setSignEntry(null); }}
        onSave={async ({ customer, authority }) => {
          const entry = signEntry;
          const sigPatch = { customer_signature_url: customer };
          if (authority) sigPatch.authority_signature_url = authority;
          await api.put(`/signatures/daybook/${entry.id}`, sigPatch);
          setSignEntry(null);
          fetchEntries();
          handlePrintReceipt({ ...entry, ...sigPatch });
        }}
        askAuthority={!nameSignOn()}
        signeeLabel={signEntry ? `Day Book #${signEntry.id} · ₹${parseFloat(signEntry.debit || signEntry.credit || 0).toLocaleString('en-IN')}` : ''}
      />

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Day Book Receipt</span>
            </div>
            <Button size="sm" variant="outline" onClick={handlePrintReceipt} className="h-8 text-xs gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </Button>
          </div>

          <div className="p-5 bg-white max-h-[80vh] overflow-y-auto">
            {receiptEntry && (() => {
              const e = receiptEntry;
              const dr = parseFloat(e.debit) || 0;
              const cr = parseFloat(e.credit) || 0;
              const entryIdStr = typeof e.id === 'string' ? e.id.replace(/\D+/g, '') : String(e.id || '');
              return (
                <div id="daybook-receipt-print">
                  <div className="r" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", maxWidth: '680px', margin: '0 auto', padding: '28px 32px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>

                    {/* Header */}
                    <div className="hdr" style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', letterSpacing: '1px', margin: 0 }}>{currentSite?.name || 'DGACCOUNT'}</h1>
                      {currentSite?.address && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{currentSite.address}</p>}
                      <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Day Book Transaction Receipt</p>
                    </div>

                    {/* Receipt title row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '4px 12px', background: '#f1f5f9', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        {e.entry_type || 'Transaction'} Receipt
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Receipt No.</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>DB-{entryIdStr.padStart(5, '0')}</div>
                      </div>
                    </div>

                    {/* Date + Mode bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Date</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{fmtDate(e.date)}</div>
                      </div>
                      {e.payment_mode && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Payment Mode</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{e.payment_mode}</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Entry Type</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{e.entry_type}</div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />

                    {/* Particular / parties */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Particulars</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {e.particular && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Particular</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{e.particular}</div>
                          </div>
                        )}
                        {e.category && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Category</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.category}</div>
                          </div>
                        )}
                        {e.from_entity && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>From</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.from_entity}</div>
                          </div>
                        )}
                        {e.to_entity && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>To</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.to_entity}</div>
                          </div>
                        )}
                        {e.farmer_name && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Farmer</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4d7c0f' }}>{e.farmer_name}</div>
                          </div>
                        )}
                        {e.interest_amount > 0 && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Interest</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>₹{e.interest_amount} @ {e.interest_rate}%</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plot / commission details */}
                    {(e.plot_no || e.pp_plot_no || e.firm_name || e.ledger_name) && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Additional Details</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {(e.plot_no || e.pp_plot_no) && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot No.</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{e.plot_no || e.pp_plot_no}</div>
                              </div>
                            )}
                            {e.plot_size && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot Size</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.plot_size}</div>
                              </div>
                            )}
                            {e.plot_rate && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot Rate</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.plot_rate}</div>
                              </div>
                            )}
                            {e.firm_name && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Firm</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#3730a3' }}>{e.firm_name}</div>
                              </div>
                            )}
                            {e.firm_purpose && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Purpose</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.firm_purpose}</div>
                              </div>
                            )}
                            {e.firm_cheque_no && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Cheque No.</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.firm_cheque_no}</div>
                              </div>
                            )}
                            {e.ledger_name && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Ledger</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>{e.ledger_name}</div>
                              </div>
                            )}
                            {e.account_no && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Account No.</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155', fontFamily: 'monospace' }}>{e.account_no}</div>
                              </div>
                            )}
                            {e.branch && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Branch</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.branch}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />

                    {/* Amount box */}
                    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        {dr > 0 && (
                          <>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Debit (Amount Paid)</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fca5a5', marginTop: '4px', fontFamily: 'monospace' }}>₹{dr.toLocaleString('en-IN')}</div>
                          </>
                        )}
                        {cr > 0 && (
                          <>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Credit (Amount Received)</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6ee7b7', marginTop: '4px', fontFamily: 'monospace' }}>₹{cr.toLocaleString('en-IN')}</div>
                          </>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Running Balance</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#34d399', marginTop: '3px', fontFamily: 'monospace' }}>₹{Math.abs(e.balance || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Remarks */}
                    {e.remarks && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fef08a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '3px' }}>Remarks</div>
                        <div style={{ fontSize: '12px', color: '#78350f', fontWeight: 500 }}>{e.remarks}</div>
                      </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 20px' }} />

                    {/* Signatures + QR */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px', gap: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '120px', borderTop: '1.5px solid #94a3b8', marginBottom: '5px' }}></div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Receiver Signature</div>
                      </div>
                      {receiptQr && (
                        <div style={{ textAlign: 'center' }}>
                          <img src={receiptQr} alt="Verify QR" style={{ width: '90px', height: '90px', border: '1px solid #0f172a', padding: '3px', background: '#fff', imageRendering: 'pixelated' }} />
                          <div style={{ fontSize: '9px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>Scan to verify</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '120px', borderTop: '1.5px solid #94a3b8', marginBottom: '5px' }}></div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Authorised Signatory</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '10px', color: '#94a3b8' }}>This is a computer-generated receipt. For queries contact the site office.</p>
                      <p style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>Printed on {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════ DIALOG ═══════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[96vh] gap-0 p-0 flex flex-col overflow-hidden rounded-3xl border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
          <div className="shrink-0 flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3 sm:px-6">
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
              dbDisplayDirection === 'credit' ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-red-600 shadow-red-600/25'
            )}>
              {dbDisplayDirection === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-slate-900">
                {editingId && !canUpdate
                  ? (isEditingExpense ? 'Request Expense Edit' : (isEditingFarmerPayment || isEditingDbFarmerPayment) ? 'Request Farmer Payment Edit' : (isEditingCommission || isEditingDbCommission) ? 'Request Commission Edit' : (isEditingCashFlow || isEditingDbCashFlow) ? 'Request Cash Flow Edit' : (isEditingFirmTxn || isEditingDbFirmTxn) ? 'Request Firm Txn Edit' : (isEditingPlotPayment || isEditingDbPlotPayment) ? 'Request Plot Payment Edit' : 'Request Entry Edit')
                  : editingId ? (isEditingExpense ? 'Edit Expense' : (isEditingFarmerPayment || isEditingDbFarmerPayment) ? 'Edit Farmer Payment' : (isEditingCommission || isEditingDbCommission) ? 'Edit Commission' : (isEditingCashFlow || isEditingDbCashFlow) ? 'Edit Cash Flow Entry' : (isEditingFirmTxn || isEditingDbFirmTxn) ? 'Edit Firm Transaction' : (isEditingPlotPayment || isEditingDbPlotPayment) ? 'Edit Plot Payment' : 'Edit Entry') : 'New Day Book Entry'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 truncate">
                Day Book entry · complete the details below
              </DialogDescription>
            </div>
            <span className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white',
              dbDisplayDirection === 'credit' ? 'bg-emerald-600' : 'bg-red-600'
            )}>
              {dbDisplayDirection === 'credit' ? 'Credit · In' : 'Debit · Out'}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 sm:px-6 md:overflow-visible">
            <form id="daybook-entry-form" onSubmit={handleSubmit} className="space-y-3">
              {message.text && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                  {message.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  {message.text}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                {/* ── Left column: entry type, date, direction, amount, mode ── */}
                <div className="space-y-3">
                  <EntryField label={<FieldLabel icon={Hash} color="bg-slate-100 text-slate-600">Entry Type</FieldLabel>} required>
                    <Select value={form.entry_type} onValueChange={(v) => {
                      const u = { entry_type: v };
                      if (v === 'EXPENSE') u.credit = '';
                      if (v === 'FARMER PAYMENT') { u.credit = ''; u.category = ''; }
                      if (v === 'PLOT COMMISSION') { u.credit = ''; u.category = 'COMMISSION'; }
                      if (v === 'CASH FLOW') { u.category = 'CASH FLOW'; }
                      if (v === 'FIRM TRANSACTION') { u.category = 'FIRM'; }
                      if (v === 'PLOT PAYMENT') { u.category = 'PLOT PAYMENT'; }
                      if (v !== 'FARMER PAYMENT') { u.farmer_id = ''; u.interest_rate = ''; u.interest_amount = ''; }
                      if (v !== 'PLOT COMMISSION') { u.plot_no = ''; u.plot_size = ''; u.plot_rate = ''; u.father_name = ''; u.commission_person = ''; }
                      if (v !== 'CASH FLOW') { u.ledger_name = ''; u.ledger_type = 'site'; u.cf_key = ''; }
                      if (v !== 'FIRM TRANSACTION') { u.firm_id = ''; u.firm_name = ''; u.firm_purpose = ''; u.firm_remark = ''; u.firm_cheque_no = ''; }
                      if (v !== 'PLOT PAYMENT') { u.pp_plot_id = ''; u.pp_payment_from = ''; u.pp_payment_type = 'CASH'; u.pp_bank_details = ''; u.pp_narration = ''; u.pp_received_by = ''; }
                      if (v !== 'FARMER PAYMENT' && v !== 'PLOT COMMISSION') { u.by_note = ''; }
                      setForm({ ...form, ...u });
                    }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(ENTRY_TYPES.includes(form.entry_type) ? ENTRY_TYPES : [form.entry_type, ...ENTRY_TYPES]).map(t => (
                          <SelectItem key={t} value={t}>
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${(TYPE_STYLE[t] || TYPE_STYLE.GENERAL).dot}`} />
                              {t}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </EntryField>

                  <EntryField label={<FieldLabel icon={CalendarIcon} color="bg-sky-100 text-sky-600">Date</FieldLabel>} required>
                    <Input
                      type="date"
                      value={isAdmin ? form.date : (editingId ? form.date : TODAY)}
                      onChange={isAdmin ? ((e) => setForm({ ...form, date: e.target.value })) : undefined}
                      readOnly={!isAdmin}
                      disabled={!isAdmin}
                      required
                      className="h-9 text-sm"
                    />
                  </EntryField>

                  {/* Direction, amount, mode — generic types + EXPENSE only; the 5 specialized
                      types pin their own direction/amount/mode inside their own block below. */}
                  {!isSpecializedType && (
                    <>
                      {isGenericEntry && (
                        <CreditDebitTabs
                          value={genDir}
                          onChange={(d) => {
                            setGenDir(d);
                            setForm({ ...form, credit: d === 'credit' ? (form.credit || form.debit) : '', debit: d === 'debit' ? (form.debit || form.credit) : '' });
                          }}
                        />
                      )}

                      {form.entry_type === 'EXPENSE' ? (
                        <EntryAmount label="Debit Amount (₹)" direction="debit" required={false}
                          inputProps={{ step: '0.01', min: undefined, placeholder: '0.00', value: form.debit, onChange: (e) => setForm({ ...form, debit: e.target.value }) }} />
                      ) : (
                        <EntryAmount label="Amount (₹)" direction={genDir} required={false}
                          inputProps={{ step: '0.01', min: undefined, placeholder: '0.00', value: genDir === 'credit' ? form.credit : form.debit, onChange: (e) => setForm({ ...form, [genDir]: e.target.value }) }} />
                      )}

                      {form.entry_type === 'EXPENSE' && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          This entry will also appear in the Expenses module
                        </div>
                      )}

                      <EntryField label={<FieldLabel icon={Landmark} color="bg-violet-100 text-violet-600">Payment Mode</FieldLabel>}>
                        <EntryModeChips
                          value={form.payment_mode}
                          modes={PAY_MODES}
                          onChange={(m) => setForm({ ...form, payment_mode: form.payment_mode === m ? '' : m })}
                        />
                        <Input
                          placeholder="Or type custom mode…"
                          value={!PAY_MODES.includes(form.payment_mode) ? form.payment_mode : ''}
                          onChange={(e) => setForm({ ...form, payment_mode: e.target.value.toUpperCase() })}
                          className="mt-1.5 h-9 text-sm"
                          list="db-mode-suggestions"
                        />
                        <datalist id="db-mode-suggestions">
                          {autocomplete.paymentModes?.filter(m => !PAY_MODES.includes(m)).map((m, i) => <option key={i} value={m} />)}
                        </datalist>
                      </EntryField>

                      {form.payment_mode === 'CHEQUE' && (
                        <EntryField label={<FieldLabel icon={FileText} color="bg-indigo-100 text-indigo-600">Cheque No</FieldLabel>}>
                          <Input value={form.cheque_no} onChange={(e) => setForm({ ...form, cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                        </EntryField>
                      )}
                    </>
                  )}
                </div>

                {/* ── Right column: particular, type-specific content, admin/person/remarks ── */}
                <div className="space-y-3">
                  {/* Particular / Purpose — universal, every type (including specialized) */}
                  <EntryField label={<FieldLabel icon={Tag} color="bg-indigo-100 text-indigo-600">{form.entry_type === 'FARMER PAYMENT' ? 'Payment Description' : form.entry_type === 'PLOT COMMISSION' ? 'Commission Description' : form.entry_type === 'CASH FLOW' ? 'Particular / Description' : form.entry_type === 'FIRM TRANSACTION' ? 'Transaction Description' : form.entry_type === 'PLOT PAYMENT' ? 'Payment Description' : form.entry_type === 'EXPENSE' ? 'Expense Purpose / Description' : 'Particular / Description'}</FieldLabel>} required>
                    <Input value={form.particular} onChange={(e) => setForm({ ...form, particular: e.target.value.toUpperCase() })} placeholder={form.entry_type === 'FARMER PAYMENT' ? 'FARMER PAYMENT - RAJU, ADV FARMER…' : form.entry_type === 'PLOT COMMISSION' ? 'COMMISSION - PLOT A1, BROKERAGE…' : form.entry_type === 'PLOT PAYMENT' ? 'PLOT PAYMENT - A1 BUYER NAME…' : form.entry_type === 'EXPENSE' ? 'PEPSI, CEMENT, BRICKS, SALARY…' : 'Enter description…'} required className="h-9 text-sm" list="db-plist" />
                    <datalist id="db-plist">{autocomplete.particulars?.map((p, i) => <option key={i} value={p} />)}</datalist>
                  </EntryField>

                  {/* ── FARMER PAYMENT FIELDS ── */}
                  {form.entry_type === 'FARMER PAYMENT' && (
                    <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Farmer Payment</p>
                      <EntryRow>
                      {/* Farmer Select */}
                      <EntryField label="Select Farmer" required>
                        <Select value={form.farmer_id} onValueChange={(v) => {
                          const farmer = farmers.find(f => String(f.id) === v);
                          setForm({
                            ...form,
                            farmer_id: v,
                            interest_rate: farmer?.interest_rate ? String(farmer.interest_rate) : form.interest_rate,
                            to_entity: farmer?.name || form.to_entity,
                            particular: form.particular || `FARMER PAYMENT - ${farmer?.name || ''}`,
                          });
                        }}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Choose a farmer…" />
                          </SelectTrigger>
                          <SelectContent>
                            {farmers.filter(f => f.status === 'active').map(f => (
                              <SelectItem key={f.id} value={String(f.id)}>
                                <span className="flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-lime-600" />
                                  <span className="font-medium">{f.name}</span>
                                  {f.phone && <span className="text-slate-400 text-xs">({f.phone})</span>}
                                  <span className="text-xs text-slate-400 ml-auto">Paid: {fmt(f.total_paid || 0)}</span>
                                </span>
                              </SelectItem>
                            ))}
                            {farmers.filter(f => f.status === 'active').length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-400">No active farmers for this site</div>
                            )}
                          </SelectContent>
                        </Select>
                      </EntryField>

                      {/* Payment Mode (Farmer-specific options) */}
                      <EntryField label="Payment Mode" required>
                        <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select payment method…" />
                          </SelectTrigger>
                          <SelectContent>
                            {FARMER_PAY_MODES.map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </EntryField>
                      </EntryRow>

                      {/* Amount */}
                      <EntryAmount label="Payment Amount (₹)" direction="debit"
                        inputProps={{
                          step: '0.01', min: undefined, placeholder: '0.00', value: form.debit, required: true,
                          onChange: (e) => {
                            const amt = e.target.value;
                            const ir = parseFloat(form.interest_rate) || 0;
                            const ia = ir > 0 ? ((parseFloat(amt) || 0) * ir / 100).toFixed(2) : form.interest_amount;
                            setForm({ ...form, debit: amt, interest_amount: ia });
                          },
                        }} />

                      {/* Interest Rate + Interest Amount */}
                      <EntryRow>
                        <EntryField label="Interest Rate (%)">
                          <Input type="number" step="0.01" placeholder="0.00" value={form.interest_rate}
                            onChange={(e) => {
                              const rate = e.target.value;
                              const amt = parseFloat(form.debit) || 0;
                              const ia = parseFloat(rate) > 0 ? (amt * parseFloat(rate) / 100).toFixed(2) : '0';
                              setForm({ ...form, interest_rate: rate, interest_amount: ia });
                            }}
                            className="h-9 text-sm tabular-nums" />
                        </EntryField>
                        <EntryField label="Interest Amount (₹)">
                          <Input type="number" step="0.01" placeholder="0.00" value={form.interest_amount}
                            onChange={(e) => setForm({ ...form, interest_amount: e.target.value })}
                            className="h-9 text-sm tabular-nums" />
                        </EntryField>
                      </EntryRow>

                      {/* By Note */}
                      <EntryField label="By Note / Reference">
                        <Input value={form.by_note} onChange={(e) => setForm({ ...form, by_note: e.target.value.toUpperCase() })} placeholder="CHQ NO 123456, REF TXN…" className="h-9 text-sm" />
                      </EntryField>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-lime-50 border border-lime-200 text-[11px] font-semibold text-lime-700">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        This entry will also appear in the Farmer Payments module
                      </div>
                    </div>
                  )}

                  {/* ── PLOT COMMISSION FIELDS ── */}
                  {form.entry_type === 'PLOT COMMISSION' && (
                    <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Plot Commission</p>
                      {/* Person Select (from Members/Users) with search */}
                      <EntryField label="Person / Particular" required>
                        <Select value={form.commission_person} onValueChange={(v) => {
                          const member = members.find(m => m.full_name === v);
                          setForm({
                            ...form,
                            commission_person: v,
                            particular: v,
                            to_entity: v,
                            father_name: member?.father_name || form.father_name,
                          });
                        }}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select a person…" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="px-2 pb-2 pt-1 sticky top-0 bg-white z-10">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Search members…"
                                  value={memberSearch}
                                  onChange={(e) => setMemberSearch(e.target.value)}
                                  className="w-full h-8 pl-8 pr-3 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            {members
                              .filter(m => {
                                if (!memberSearch) return true;
                                const s = memberSearch.toLowerCase();
                                return m.full_name?.toLowerCase().includes(s) ||
                                  m.phone?.toLowerCase().includes(s) ||
                                  m.email?.toLowerCase().includes(s) ||
                                  m.member_type?.toLowerCase().includes(s);
                              })
                              .map(m => (
                                <SelectItem key={m.id} value={m.full_name}>
                                  <span className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-teal-600" />
                                    <span className="font-medium">{m.full_name}</span>
                                    {m.phone && <span className="text-slate-400 text-xs">({m.phone})</span>}
                                    <span className="text-[10px] text-slate-400 ml-auto">{m.member_type}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            {members.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-400">No members registered for this site</div>
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          value={form.particular}
                          onChange={(e) => setForm({ ...form, particular: e.target.value.toUpperCase(), commission_person: e.target.value.toUpperCase() })}
                          placeholder="Or type name manually…"
                          className="mt-1.5 h-9 text-sm"
                        />
                      </EntryField>

                      {/* Father Name */}
                      <EntryField label="Father Name">
                        <Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value.toUpperCase() })} placeholder="S/O RAMESH CHAUDHARY…" className="h-9 text-sm" />
                      </EntryField>

                      {/* Plot No + Plot Size + Plot Rate */}
                      <div className="grid grid-cols-3 gap-3">
                        <EntryField label="Plot No">
                          <Input value={form.plot_no} onChange={(e) => setForm({ ...form, plot_no: e.target.value.toUpperCase() })} placeholder="A1, B12…" className="h-9 text-sm" />
                        </EntryField>
                        <EntryField label="Plot Size">
                          <Input value={form.plot_size} onChange={(e) => setForm({ ...form, plot_size: e.target.value.toUpperCase() })} placeholder="1200 SQFT…" className="h-9 text-sm" />
                        </EntryField>
                        <EntryField label="Plot Rate">
                          <Input value={form.plot_rate} onChange={(e) => setForm({ ...form, plot_rate: e.target.value.toUpperCase() })} placeholder="1500/SQFT…" className="h-9 text-sm" />
                        </EntryField>
                      </div>

                      {/* Commission Amount */}
                      <EntryAmount label="Commission Amount (₹)" direction="debit"
                        inputProps={{ step: '0.01', min: undefined, placeholder: '0.00', value: form.debit, required: true, onChange: (e) => setForm({ ...form, debit: e.target.value }) }} />

                      {/* By Note */}
                      <EntryField label="By Note / Reference">
                        <Input value={form.by_note} onChange={(e) => setForm({ ...form, by_note: e.target.value.toUpperCase() })} placeholder="CHQ NO 123456, REF TXN…" className="h-9 text-sm" />
                      </EntryField>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-700">
                        <Hash className="w-3.5 h-3.5 shrink-0" />
                        This entry will also appear in the Plot Commissions module
                      </div>
                    </div>
                  )}

                  {/* ── CASH FLOW FIELDS ── */}
                  {form.entry_type === 'CASH FLOW' && (() => {
                    /* helper: build safe compound key for a ledger record */
                    const cfKey = (l) => `${l.id}`;
                    /* helper: display name for a ledger (handles null names) */
                    const cfLabel = (l) => l.ledger_name || `${l.ledger_type === 'person' ? 'Person' : 'Site'} Ledger`;
                    /* find selected ledger from the list */
                    const selectedCfLedger = cashflowLedgers.find(l => cfKey(l) === form.cf_key);
                    const selectedCfDisplay = selectedCfLedger
                      ? `${cfLabel(selectedCfLedger)} — ${MONTH_NAMES[selectedCfLedger.month]} ${selectedCfLedger.year}`
                      : null;

                    return (
                      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cash Flow</p>
                        {/* Ledger Select — shows ALL month+ledger combinations */}
                        <EntryField label="Cash Flow Ledger" required>
                          <Select value={form.cf_key} onValueChange={(v) => {
                            const ledger = cashflowLedgers.find(l => cfKey(l) === v);
                            setForm({
                              ...form,
                              cf_key: v,
                              ledger_name: ledger?.ledger_name || '',
                              ledger_type: ledger?.ledger_type || 'site',
                            });
                          }}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select a ledger…">
                                {selectedCfDisplay && (
                                  <span className="flex items-center gap-2">
                                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="font-medium">{selectedCfDisplay}</span>
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {cashflowLedgers.map(l => {
                                const monthLabel = MONTH_NAMES[l.month] || l.month;
                                const displayName = cfLabel(l);
                                return (
                                  <SelectItem key={cfKey(l)} value={cfKey(l)}>
                                    <span className="flex items-center gap-2">
                                      <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="font-medium">{displayName}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">{monthLabel} {l.year}</span>
                                      <span className="text-[10px] text-slate-400">{l.ledger_type === 'person' ? 'Person' : 'Site'}</span>
                                      <span className="text-[10px] text-slate-400 ml-auto">{l.entry_count || 0} entries</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                              {cashflowLedgers.length === 0 && (
                                <div className="px-3 py-2 text-xs text-slate-400">No ledgers found. Create one in Cash Flow module first, or type a new name below.</div>
                              )}
                            </SelectContent>
                          </Select>
                          <Input
                            value={form.ledger_name}
                            onChange={(e) => setForm({ ...form, ledger_name: e.target.value.toUpperCase() })}
                            placeholder="Or type a new ledger name…"
                            className="mt-1.5 h-9 text-sm"
                          />
                        </EntryField>

                        {/* Ledger Type */}
                        <EntryField label="Ledger Type">
                          <Select value={form.ledger_type} onValueChange={(v) => setForm({ ...form, ledger_type: v })}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="site">Site Ledger</SelectItem>
                              <SelectItem value="person">Person Ledger</SelectItem>
                            </SelectContent>
                          </Select>
                        </EntryField>

                        {/* Debit + Credit */}
                        <EntryRow>
                          <EntryField label="Debit (₹)">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">DR</span>
                              <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                                onChange={(e) => setForm({ ...form, debit: e.target.value })}
                                className="h-9 pl-9 text-sm tabular-nums border-red-200/50 focus-visible:ring-red-300" />
                            </div>
                          </EntryField>
                          <EntryField label="Credit (₹)">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                              <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                                onChange={(e) => setForm({ ...form, credit: e.target.value })}
                                className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                            </div>
                          </EntryField>
                        </EntryRow>

                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                          <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                          {selectedCfLedger
                            ? <>This entry will also appear in Cash Flow → <span className="underline">{cfLabel(selectedCfLedger)}</span> ({MONTH_NAMES[selectedCfLedger.month]} {selectedCfLedger.year})</>
                            : form.ledger_name
                              ? <>This entry will create a new Cash Flow ledger "{form.ledger_name}"</>
                              : <>Select a ledger or type a new name above</>
                          }
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── FIRM TRANSACTION FIELDS ── */}
                  {form.entry_type === 'FIRM TRANSACTION' && (
                    <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Firm Transaction</p>
                      {/* Firm Select */}
                      <EntryField label="Select Firm" required>
                        <Select value={form.firm_id} onValueChange={(v) => {
                          const firm = firms.find(f => String(f.id) === v);
                          setForm({
                            ...form,
                            firm_id: v,
                            to_entity: firm?.name || form.to_entity,
                            particular: form.particular || `FIRM TXN - ${firm?.name || ''}`,
                          });
                        }}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Choose a firm…" />
                          </SelectTrigger>
                          <SelectContent>
                            {firms.map(f => (
                              <SelectItem key={f.id} value={String(f.id)}>
                                <span className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                  <span className="font-medium">{f.name}</span>
                                  <span className="text-xs text-slate-400 ml-auto">
                                    DR {fmt(f.total_debit || 0)} | CR {fmt(f.total_credit || 0)}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                            {firms.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-400">No firms for this site. Create one in Firm Transactions module first.</div>
                            )}
                          </SelectContent>
                        </Select>
                      </EntryField>

                      {/* Debit + Credit */}
                      <EntryRow>
                        <EntryField label="Debit (₹)">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">DR</span>
                            <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                              onChange={(e) => setForm({ ...form, debit: e.target.value })}
                              className="h-9 pl-9 text-sm tabular-nums border-red-200/50 focus-visible:ring-red-300" />
                          </div>
                        </EntryField>
                        <EntryField label="Credit (₹)">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                            <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                              onChange={(e) => setForm({ ...form, credit: e.target.value })}
                              className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                          </div>
                        </EntryField>
                      </EntryRow>

                      {/* Name + Purpose */}
                      <EntryRow>
                        <EntryField label="Name">
                          <Input value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value.toUpperCase() })} placeholder="PERSON NAME…" className="h-9 text-sm" />
                        </EntryField>
                        <EntryField label="Purpose">
                          <Input value={form.firm_purpose} onChange={(e) => setForm({ ...form, firm_purpose: e.target.value.toUpperCase() })} placeholder="MATERIAL, LABOUR…" className="h-9 text-sm" />
                        </EntryField>
                      </EntryRow>

                      {/* Remark + Cheque No */}
                      <EntryRow>
                        <EntryField label="Remark">
                          <Input value={form.firm_remark} onChange={(e) => setForm({ ...form, firm_remark: e.target.value.toUpperCase() })} placeholder="REMARK…" className="h-9 text-sm" />
                        </EntryField>
                        <EntryField label="Cheque No">
                          <Input value={form.firm_cheque_no} onChange={(e) => setForm({ ...form, firm_cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                        </EntryField>
                      </EntryRow>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        This entry will also appear in the Firm Transactions module
                      </div>
                    </div>
                  )}

                  {/* ── PLOT PAYMENT FIELDS ── */}
                  {form.entry_type === 'PLOT PAYMENT' && (
                    <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Plot Payment</p>
                      {/* Plot Select */}
                      <EntryField label="Select Plot" required>
                        <Select value={form.pp_plot_id} onValueChange={(v) => {
                          const plot = plots.find(p => String(p.id) === v);
                          setForm({
                            ...form,
                            pp_plot_id: v,
                            to_entity: plot ? `${plot.plot_no} - ${plot.buyer_name}` : form.to_entity,
                            particular: form.particular || `PLOT PAYMENT - ${plot?.plot_no || ''} (${plot?.buyer_name || ''})`,
                          });
                        }}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Choose a plot…" />
                          </SelectTrigger>
                          <SelectContent>
                            {plots.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                <span className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-sky-700" />
                                  <span className="font-medium">{p.plot_no}{p.block ? ` (${p.block})` : ''}</span>
                                  <span className="text-xs text-slate-500 ml-1">{p.buyer_name || 'No buyer'}</span>
                                  <span className="text-xs text-slate-400 ml-auto">
                                    ₹{fmt(p.sale_price || 0)} | Rcvd ₹{fmt(p.total_received || 0)}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                            {plots.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-400">No plots for this site. Create one in Plot Registry first.</div>
                            )}
                          </SelectContent>
                        </Select>
                      </EntryField>

                      {/* Payment From + Amount */}
                      <EntryField label="Payment From" required>
                        <Select value={form.pp_payment_from} onValueChange={(v) => {
                          const pt = derivePaymentType(v);
                          setForm({ ...form, pp_payment_from: v, pp_payment_type: pt });
                        }}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_FROM_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </EntryField>
                      <EntryAmount label="Amount (₹)" direction="credit"
                        inputProps={{ step: '0.01', min: undefined, placeholder: '0.00', value: form.credit, onChange: (e) => setForm({ ...form, credit: e.target.value }) }} />

                      {/* Bank Details (conditional) */}
                      {(form.pp_payment_type === 'BANK' || form.pp_payment_type === 'CHEQUE') && (
                        <EntryField label={form.pp_payment_type === 'CHEQUE' ? 'Cheque No' : 'Bank Details'}>
                          {form.pp_payment_type === 'CHEQUE' ? (
                            <Input value={form.pp_cheque_no} onChange={(e) => setForm({ ...form, pp_cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                          ) : (
                            <Input value={form.pp_bank_details} onChange={(e) => setForm({ ...form, pp_bank_details: e.target.value.toUpperCase() })} placeholder="BANK NAME, CHQ NO, A/C NO…" className="h-9 text-sm" />
                          )}
                        </EntryField>
                      )}

                      {/* Narration + Received By */}
                      <EntryRow>
                        <EntryField label="Narration">
                          <Input value={form.pp_narration} onChange={(e) => setForm({ ...form, pp_narration: e.target.value.toUpperCase() })} placeholder="NARRATION…" className="h-9 text-sm" />
                        </EntryField>
                        <EntryField label="Received By">
                          <Input value={form.pp_received_by} onChange={(e) => setForm({ ...form, pp_received_by: e.target.value.toUpperCase() })} placeholder="NAME…" className="h-9 text-sm" />
                        </EntryField>
                      </EntryRow>

                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-semibold text-sky-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        This entry will also appear in the Plot Payments module
                      </div>
                    </div>
                  )}

                  {/* From / To, Category, Account, Branch — generic types + EXPENSE only */}
                  {!isSpecializedType && (
                    <>
                      <EntryRow>
                        <EntryField label={<FieldLabel icon={ArrowLeftRight} color="bg-orange-100 text-orange-600">From Entity</FieldLabel>}>
                          <Input value={form.from_entity} onChange={(e) => setForm({ ...form, from_entity: e.target.value.toUpperCase() })} placeholder="GAYATRI ASSOCIATES, IDIB-001884…" className="h-9 text-sm" list="db-from" />
                          <datalist id="db-from">{autocomplete.fromEntities?.map((f, i) => <option key={i} value={f} />)}</datalist>
                        </EntryField>
                        <EntryField label={<FieldLabel icon={User} color="bg-cyan-100 text-cyan-600">To Entity</FieldLabel>}>
                          <Input value={form.to_entity} onChange={(e) => setForm({ ...form, to_entity: e.target.value.toUpperCase() })} placeholder="B11, A10, A5, B16…" className="h-9 text-sm" list="db-to" />
                          <datalist id="db-to">{autocomplete.toEntities?.map((t, i) => <option key={i} value={t} />)}</datalist>
                        </EntryField>
                      </EntryRow>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <EntryField label={<FieldLabel icon={Tag} color="bg-pink-100 text-pink-600">Category</FieldLabel>}>
                          <Select value={form.category || '_none'} onValueChange={(v) => setForm({ ...form, category: v === '_none' ? '' : v })}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— None —</SelectItem>
                              {[...new Set([...CATEGORIES, ...(autocomplete.categories || [])])].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </EntryField>
                        <EntryField label={<FieldLabel icon={Hash} color="bg-slate-100 text-slate-500">Account No</FieldLabel>}>
                          <Input value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value.toUpperCase() })} placeholder="CNRB-077582, SBI-858615…" className="h-9 text-sm" list="db-acc" />
                          <datalist id="db-acc">{autocomplete.accountNos?.map((a, i) => <option key={i} value={a} />)}</datalist>
                        </EntryField>
                      </div>
                      <EntryField label={<FieldLabel icon={MapPin} color="bg-teal-100 text-teal-600">Branch</FieldLabel>}>
                        <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value.toUpperCase() })} placeholder="MAIN, SADAR, CIVIL LINES…" className="h-9 text-sm" list="db-br" />
                        <datalist id="db-br">{autocomplete.branches?.map((b, i) => <option key={i} value={b} />)}</datalist>
                      </EntryField>
                    </>
                  )}

                  {/* Assign To Admin — universal */}
                  {(isAdmin || canManage) && approvers.length > 0 && (
                    <EntryField label={<FieldLabel icon={Users} color="bg-amber-100 text-amber-600">Assign To Admin</FieldLabel>}>
                      <Select value={form.assigned_admin_id?.toString() || '_none'} onValueChange={(v) => setForm({ ...form, assigned_admin_id: v === '_none' ? null : parseInt(v) })}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select approver..." />
                        </SelectTrigger>
                        <SelectContent>
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

                  <EntryField label={<FieldLabel icon={MessageSquare} color="bg-slate-100 text-slate-500">Remarks</FieldLabel>}>
                    <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value.toUpperCase() })} placeholder="ADJUST A19 DG, TRF TO A7, IN BANK…" rows={2} className="text-sm resize-none" />
                  </EntryField>
                </div>
              </div>

              {/* Voucher / camera proof — saved on the entry itself, full width */}
              <VoucherUpload
                label="Evidence Photo · Optional"
                value={form.voucher_url || null}
                onChange={(url) => setForm((f) => ({ ...f, voucher_url: url || '' }))}
                onUploadingChange={setVoucherUploading}
                disabled={submitting}
              />

              {/* Proof photo for sub-admin edit request - OPTIONAL */}
              {editingId && !canUpdate && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Proof Photo <span className="text-slate-400">(optional)</span></Label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <Camera className="w-4 h-4 text-slate-600" />
                      <span className="text-xs text-slate-700">{proofPhoto ? proofPhoto.name : 'Upload proof photo (optional)'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleProofPhotoChange} />
                    </label>
                    {proofPreview && (
                      <img src={proofPreview} alt="Proof" className="w-12 h-12 rounded-lg object-cover border" />
                    )}
                  </div>
                </div>
              )}

              {/* hidden submit keeps Enter-to-submit working; visible button lives in the footer below */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
            <p className="hidden sm:block text-[11px] text-slate-400">
              Enter: next field · Shift+Tab: previous · Esc: close
            </p>
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting} className="h-10 rounded-full px-5">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => document.getElementById('daybook-entry-form')?.requestSubmit()}
                disabled={submitting || voucherUploading}
                className={cn(
                  'h-10 rounded-full px-5 text-white',
                  editingId && !isAdmin ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                {submitting
                  ? (editingId && !isAdmin ? 'Submitting Request…' : editingId ? 'Saving…' : 'Creating…')
                  : (editingId && !isAdmin ? 'Submit Edit Request' : editingId ? 'Update' : 'Create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayBook;

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function DaybookMetric({ label, value, hint, tone = 'slate', icon }) {
  const tones = {
    rose: 'text-rose-600 bg-rose-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    slate: 'text-slate-600 bg-slate-100',
  };
  return (
    <div className="min-w-0 border-b border-r border-slate-100 px-4 py-3.5 last:border-r-0 lg:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${tones[tone] || tones.slate}`}>{icon}</span>
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function SummaryCard({ label, value, sub, color, icon, onClick }) {
  const colors = {
    red: { gradient: 'from-red-50 via-rose-50 to-orange-50', border: 'border-red-100', iconBg: 'bg-red-100', iconText: 'text-red-600', valueText: 'text-red-700', wave: 'text-red-100' },
    emerald: { gradient: 'from-emerald-50 via-green-50 to-teal-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', valueText: 'text-emerald-700', wave: 'text-emerald-100' },
    blue: { gradient: 'from-blue-50 via-sky-50 to-indigo-50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600', valueText: 'text-blue-700', wave: 'text-blue-100' },
    amber: { gradient: 'from-amber-50 via-yellow-50 to-orange-50', border: 'border-amber-100', iconBg: 'bg-amber-100', iconText: 'text-amber-600', valueText: 'text-amber-700', wave: 'text-amber-100' },
  };
  const c = colors[color] || colors.emerald;
  const clickable = typeof onClick === 'function';
  const Root = clickable ? 'button' : 'div';
  return (
    <Root
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.gradient} p-4 transition-shadow text-left w-full hover:shadow-md ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400' : ''}`}
    >
      {/* Decorative curved wave */}
      <svg className={`absolute -bottom-3 -right-3 w-28 h-28 ${c.wave} opacity-60`} viewBox="0 0 100 100" fill="currentColor">
        <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
        <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
      </svg>
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-extrabold ${c.valueText} mt-1.5 tabular-nums leading-none truncate`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>}
          {clickable && <p className="text-[10px] font-semibold text-slate-500 mt-1.5 inline-flex items-center gap-1">Tap for breakdown <ChevronRight className="w-3 h-3" /></p>}
        </div>
        <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0 ${c.iconText}`}>
          {icon}
        </div>
      </div>
    </Root>
  );
}

// Render a signed rupee amount the same way everywhere: leading unicode minus
// on negatives, no sign on positives, fmt() for the magnitude.
function signedRupee(n) {
  const v = Number.isFinite(n) ? n : 0;
  return (v < 0 ? '−' : '') + fmt(Math.abs(v));
}

/*
 * Opening + Remaining cards for all three Day Book routes.
 *
 *   /daybook        → sum across every mode (cash + bank + cheque + upi + other)
 *                     plus a per-mode breakdown chip row so Main always equals
 *                     the sum of the individual mode totals.
 *   /daybook/cash   → Cash-only opening + remaining.
 *   /daybook/bank   → Bank-only opening + remaining.
 *
 * The "Remaining" figure is recomputed on the client from the server-provided
 * opening plus the day's credits/debits in `entries` (bucketed with the same
 * classifier the backend uses). That means as soon as a debit is added,
 * edited, or deleted, the Remaining figure drops immediately instead of
 * waiting for the next round-trip — which was the "debit not reducing cash"
 * complaint.
 */
function BalanceCards({ isToday, selectedDate, mode = 'all', modeBalance, entries = [] }) {
  // Breakdown modal state — populated when the user clicks a Cash/Bank In or
  // Out card. `detail` holds { direction, label, total, rows } or null.
  const [breakdown, setBreakdown] = useState(null);

  // Live per-bucket day totals — drives the client-side Remaining recompute.
  // SPLIT farmer_payments are routed to cash AND bank buckets by their
  // cash_amount / bank_amount so the client mirrors the backend SQL split
  // (see getModeBalance UNION 3b/3c).
  // Negative credits (refund/reversal rows) are reclassified as outflows and
  // negative debits as inflows, matching the backend accumulator, so the
  // In/Out cards show real gross-flow magnitudes. Net stays the same.
  const liveBuckets = useMemo(() => {
    const m = {};
    for (const b of BUCKETS) m[b] = { c: 0, d: 0 };
    for (const e of entries) {
      if (!isPostedEntry(e)) continue;
      const pmRaw = String(e.payment_mode || '').trim().toUpperCase();
      const cashAmt = parseFloat(e.cash_amount) || 0;
      const bankAmt = parseFloat(e.bank_amount) || 0;
      if (pmRaw === 'SPLIT' && (cashAmt > 0 || bankAmt > 0)) {
        m.cash.d += cashAmt;
        m.bank.d += bankAmt;
        continue;
      }
      const b = classifyPaymentMode(e.payment_mode);
      const cr = parseFloat(e.credit) || 0;
      const dr = parseFloat(e.debit)  || 0;
      if (cr >= 0) m[b].c += cr; else m[b].d += -cr;
      if (dr >= 0) m[b].d += dr; else m[b].c += -dr;
    }
    return m;
  }, [entries]);

  if (!modeBalance) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200/70 flex items-center justify-center shrink-0 text-slate-500">
          <IndianRupee className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Opening / Remaining</p>
          <p className="text-[11px] text-slate-500 mt-1">Loading…</p>
        </div>
      </div>
    );
  }

  // Single-mode slice:
  //   /daybook/cash → just the 'cash' bucket.
  //   /daybook/bank → everything except cash (see NON_CASH_BUCKETS), because
  //                   from the firm's side any non-cash mode settles through a
  //                   bank account.
  if (mode === 'cash' || mode === 'bank') {
    const bucketKeys = mode === 'cash' ? ['cash'] : NON_CASH_BUCKETS;
    const opening = bucketKeys.reduce((s, b) => s + (parseFloat(modeBalance?.[b]?.opening_balance) || 0), 0);
    const liveC   = bucketKeys.reduce((s, b) => s + liveBuckets[b].c, 0);
    const liveD   = bucketKeys.reduce((s, b) => s + liveBuckets[b].d, 0);
    const remaining = opening + liveC - liveD;
    const label = mode === 'cash' ? 'Cash' : 'Bank';
    const openingSub = mode === 'cash'
      ? `Start of ${fmtDate(selectedDate)}`
      : `Start of ${fmtDate(selectedDate)} · Bank + Cheque + UPI + Other`;

    // Merge gross in/out per source across every bucket in this book. Refunds
    // and reversals stay on their normalized opposite side, matching the
    // Dashboard and Balance Sheet; netting a source here made ₹100 received +
    // ₹20 refunded appear as ₹80 In / ₹0 Out.
    const grossRows = (() => {
      const merged = new Map(); // src → { in, out, label }
      for (const b of bucketKeys) {
        const bySrcMap = modeBalance?.[b]?.by_src || {};
        for (const src of Object.keys(bySrcMap)) {
          const row = bySrcMap[src];
          const cur = merged.get(src) || { in: 0, out: 0, label: row?.label || src };
          cur.in  += parseFloat(row?.in)  || 0;
          cur.out += parseFloat(row?.out) || 0;
          merged.set(src, cur);
        }
      }
      if (liveC > 0.001 || liveD > 0.001) {
        merged.set('__live__', { in: liveC, out: liveD, label: `Today's live entries · ${fmtDate(selectedDate)}` });
      }
      const inRows = [];
      const outRows = [];
      for (const [src, { in: gi, out: go, label }] of merged.entries()) {
        if (gi > 0.001) inRows.push({ source: src, label, amount: gi });
        if (go > 0.001) outRows.push({ source: src, label, amount: go });
      }
      inRows.sort((a, b) => b.amount - a.amount);
      outRows.sort((a, b) => b.amount - a.amount);
      return { inRows, outRows };
    })();

    const totalIn  = grossRows.inRows.reduce((s, r) => s + r.amount, 0);
    const totalOut = grossRows.outRows.reduce((s, r) => s + r.amount, 0);
    const flowSub = `Total through ${fmtDate(selectedDate)}${isToday ? ' · Live' : ''}`;

    const openBreakdown = (direction) => {
      setBreakdown({
        direction,
        label: `${label} ${direction === 'in' ? 'In' : 'Out'}`,
        total: direction === 'in' ? totalIn : totalOut,
        rows: direction === 'in' ? grossRows.inRows : grossRows.outRows,
      });
    };

    return (
      <div className="space-y-3">
        <TwoCardLayout
          openingLabel={`${label} Opening Balance`}
          openingValue={opening}
          openingSub={openingSub}
          runningLabel={isToday ? `Current ${label} Balance` : `${label} Closing Balance`}
          runningValue={remaining}
          runningSub={isToday ? 'Live — updates as entries change' : fmtDateLong(selectedDate)}
          isToday={isToday}
          dayCredit={liveC}
          dayDebit={liveD}
        />

        {/* Gross cumulative In / Out through the selected date. Opening and
            Remaining above describe only the selected day's reconciliation. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SummaryCard
            label={`${label} In`}
            value={fmt(totalIn)}
            sub={flowSub}
            color="emerald"
            icon={<ArrowDownRight className="w-4 h-4" />}
            onClick={() => openBreakdown('in')}
          />
          <SummaryCard
            label={`${label} Out`}
            value={fmt(totalOut)}
            sub={flowSub}
            color="red"
            icon={<ArrowUpRight className="w-4 h-4" />}
            onClick={() => openBreakdown('out')}
          />
        </div>

        <FlowBreakdownDialog
          detail={breakdown}
          onClose={() => setBreakdown(null)}
          selectedDate={selectedDate}
          mode={mode}
        />

        {/* For /daybook/bank, expose the per-sub-mode breakdown so the user
            can see how Bank, Cheque, UPI and Other each contribute. */}
        {mode === 'bank' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {bucketKeys.map((b) => {
              const op = parseFloat(modeBalance?.[b]?.opening_balance) || 0;
              const rem = op + liveBuckets[b].c - liveBuckets[b].d;
              const positive = rem >= 0;
              return (
                <div key={b} className={`rounded-xl border ${positive ? 'border-slate-200 bg-white' : 'border-red-100 bg-red-50/40'} p-2.5`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{BUCKET_LABELS[b]}</p>
                  <p className={`text-sm font-extrabold tabular-nums leading-tight mt-0.5 ${positive ? 'text-slate-800' : 'text-red-700'}`}>
                    {signedRupee(rem)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    Op {signedRupee(op)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Main Day Book — opening = site balance at the START of the selected date
  // (historical view). Remaining = opening + that day's live credit/debit
  // flows. Applies uniformly to today and past dates so the Main card
  // reconciles with Cash + Bank; previously the today branch used an all-time
  // "current_balance" that silently folded in FUTURE-dated entries, which made
  // Main disagree with Cash/Bank whenever someone post-dated an expense.
  const siteOpeningRaw = modeBalance?.site?.opening_balance;
  const fallbackOpening = BUCKETS.reduce((s, b) => s + (parseFloat(modeBalance?.[b]?.opening_balance) || 0), 0);
  const liveCreditTotal = BUCKETS.reduce((s, b) => s + liveBuckets[b].c, 0);
  const liveDebitTotal  = BUCKETS.reduce((s, b) => s + liveBuckets[b].d, 0);

  const openingTotal   = siteOpeningRaw != null ? (parseFloat(siteOpeningRaw) || 0) : fallbackOpening;
  const remainingTotal = openingTotal + liveCreditTotal - liveDebitTotal;

  return (
    <div className="space-y-3">
      <TwoCardLayout
        openingLabel="Opening Balance"
        openingValue={openingTotal}
        openingSub={`Start of ${fmtDate(selectedDate)} · Site Balance (Incoming − Expenses − Imprest)`}
        runningLabel={isToday ? 'Remaining Balance' : 'Closing Balance'}
        runningValue={remainingTotal}
        runningSub={isToday ? 'Live — updates as entries change' : fmtDateLong(selectedDate)}
        isToday={isToday}
        dayCredit={liveCreditTotal}
        dayDebit={liveDebitTotal}
      />

      {/* Per-mode breakdown — makes it obvious why the total is what it is
          and that Main = Σ(mode totals). */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {BUCKETS.map((b) => {
          const op = parseFloat(modeBalance?.[b]?.opening_balance) || 0;
          const rem = op + liveBuckets[b].c - liveBuckets[b].d;
          const positive = rem >= 0;
          return (
            <div key={b} className={`rounded-xl border ${positive ? 'border-slate-200 bg-white' : 'border-red-100 bg-red-50/40'} p-2.5`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{BUCKET_LABELS[b]}</p>
              <p className={`text-sm font-extrabold tabular-nums leading-tight mt-0.5 ${positive ? 'text-slate-800' : 'text-red-700'}`}>
                {signedRupee(rem)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                Op {signedRupee(op)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shared two-card layout — Opening on the left, Remaining/Closing on the right.
function TwoCardLayout({ openingLabel, openingValue, openingSub, runningLabel, runningValue, runningSub, isToday, dayCredit = 0, dayDebit = 0 }) {
  const runningPositive = (runningValue ?? 0) >= 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 p-4">
        <svg className="absolute -bottom-3 -right-3 w-28 h-28 text-sky-100 opacity-60" viewBox="0 0 100 100" fill="currentColor">
          <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
          <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
        </svg>
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{openingLabel}</p>
            <p className="text-2xl font-extrabold text-sky-800 mt-1.5 tabular-nums leading-none truncate">
              {signedRupee(openingValue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">{openingSub}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-sky-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border ${runningPositive ? 'border-emerald-100' : 'border-red-100'} bg-gradient-to-br ${runningPositive ? 'from-emerald-50 via-green-50 to-teal-50' : 'from-red-50 via-rose-50 to-orange-50'} p-4`}>
        <svg className={`absolute -bottom-3 -right-3 w-28 h-28 ${runningPositive ? 'text-emerald-100' : 'text-red-100'} opacity-60`} viewBox="0 0 100 100" fill="currentColor">
          <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
          <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
        </svg>
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{runningLabel}</p>
              {isToday && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white"><span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE</span>}
            </div>
            <p className={`text-2xl font-extrabold mt-1.5 tabular-nums leading-none truncate ${runningPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {signedRupee(runningValue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {runningSub}
              {(dayCredit || dayDebit) ? (
                <span className="ml-1 text-slate-400">
                  · +{fmt(dayCredit)} / −{fmt(dayDebit)} today
                </span>
              ) : null}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${runningPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} flex items-center justify-center shrink-0`}>
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   CASH/BANK IN-OUT DETAIL MODAL
   Opened when the user taps a "Cash In / Out" or "Bank In / Out"
   summary card. Explains which source modules contribute to the
   number and — for Bank — how the non-cash sub-buckets break down.
   ═══════════════════════════════════════════════════════════ */
function FlowBreakdownDialog({ detail, onClose, selectedDate, mode }) {
  const open = !!detail;
  const direction = detail?.direction || 'in';
  const rows = detail?.rows || [];
  const total = detail?.total || 0;
  const sumOfRows = rows.reduce((s, r) => s + r.amount, 0);
  const unexplained = total - sumOfRows;

  const blurb = direction === 'in'
    ? (mode === 'bank'
        ? 'Total non-cash money received by this site through the selected date. Includes bank transfers, UPI, IMPS, NEFT, RTGS, cheques, and any unclassified-mode inflows.'
        : 'Total cash received by this site through the selected date. Includes plot-sale cash, cash loans from persons, imprest money returned to the cash box, and any refunds booked against cash outflows.')
    : (mode === 'bank'
        ? 'Total non-cash money paid out by this site through the selected date. Includes bank transfers, UPI, IMPS, NEFT, RTGS, cheques, and any unclassified-mode outflows.'
        : 'Total cash paid out by this site through the selected date. Includes farmer/vendor/commission cash payments, direct expenses, cash loans given to persons, and imprest allocations to sub-admins.');

  const colorText = direction === 'in' ? 'text-emerald-700' : 'text-red-700';
  const colorBg   = direction === 'in' ? 'bg-emerald-50' : 'bg-red-50';
  const colorBorder = direction === 'in' ? 'border-emerald-100' : 'border-red-100';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {direction === 'in'
              ? <ArrowDownRight className="w-5 h-5 text-emerald-600" />
              : <ArrowUpRight   className="w-5 h-5 text-red-600" />}
            {detail?.label} · through {fmtDate(selectedDate)}
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-xl border ${colorBorder} ${colorBg} p-3`}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
          <p className={`text-2xl font-extrabold tabular-nums mt-0.5 ${colorText}`}>{fmt(total)}</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{blurb}</p>
        </div>

        <div className="mt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Where it comes from</p>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No {direction === 'in' ? 'inflows' : 'outflows'} yet for the selected cutoff.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <span className="text-xs text-slate-700 font-medium truncate pr-3">{r.label}</span>
                  <span className={`text-xs font-bold tabular-nums ${colorText}`}>{fmt(r.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Sum</span>
                <span className={`text-xs font-extrabold tabular-nums ${colorText}`}>{fmt(sumOfRows)}</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 italic leading-snug">
          <b>Farmer / Plot / Commission / Vendor / Expense</b> rows are <i>net</i> of refund reversals (matching Farmers page, Plot Payments page, etc.). <b>Personal Ledger</b> and <b>Imprest</b> show their gross flow on each side — "given" and "returned" are independent transactions, so the Personal Ledgers page splits them into CASH GIVEN / CASH RECV columns and Day Book mirrors that.
        </p>
        {Math.abs(unexplained) > 0.5 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 leading-snug">
            Note: breakdown rows sum to <b>{fmt(sumOfRows)}</b> vs card <b>{fmt(total)}</b> — diff <b>{fmt(Math.abs(unexplained))}</b>. This usually comes from the Personal Ledger accounting double-entry (loans-given leg counted once as outstanding, once as expense) — it keeps Cash + Bank = Site Balance reconciled but does not represent extra cash movement.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FilterSelect({ label, value, onChange, allLabel, options, displayMap }) {
  return (
    <div>
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map(o => <SelectItem key={o} value={o}>{displayMap?.[o] || o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function BreakdownRow({ label, count, dr, cr, badge, typeBadge }) {
  const ts = TYPE_STYLE[label] || TYPE_STYLE.GENERAL;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
      {typeBadge ? (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
          {label}
        </span>
      ) : badge ? (
        <Badge variant="outline" className={`text-[10px] font-semibold px-2 ${MODE_STYLE[label] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{label}</Badge>
      ) : (
        <span className="text-xs font-semibold text-slate-700 min-w-0 truncate">{label}</span>
      )}
      <span className="text-[11px] text-slate-400 flex-1">{count} entr{count === 1 ? 'y' : 'ies'}</span>
      <span className="text-[11px] font-bold text-red-600 tabular-nums">DR {fmt(dr)}</span>
      <span className="text-[11px] font-bold text-emerald-600 tabular-nums">CR {fmt(cr)}</span>
    </div>
  );
}
