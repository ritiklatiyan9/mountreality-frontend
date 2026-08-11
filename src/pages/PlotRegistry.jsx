import { writePrintDocument } from '../lib/safePrint';
import { createElement, useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { SitePolicyContext } from '../context/SitePolicyContext';
import api from '../api/api';
import { apolloClient } from '../graphql/client';
import { GET_REGISTRY_BANK_CHEQUE_PAYMENTS } from '../graphql/queries';
import ChequeStatusControl from '../components/ChequeStatusControl';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '../components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Building2, MapPin, Plus, Search, Edit2, Trash2, ArrowLeft,
  Download, Eye, IndianRupee, Percent, Hash, Calendar, FileText, Printer,
  Ruler, Check, AlertCircle, Loader2, X, ChevronsUpDown, User, Users, UserPlus,
  Banknote, ClipboardList, ArrowUpDown, Filter, ScrollText,
  Library, BadgeCheck, Landmark, Wallet, CreditCard, PenLine,
  ShieldCheck, LockKeyhole,
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import CameraCapture from '../components/CameraCapture';
import { printCashReceipt } from '../lib/cashReceipt';
import { customerSigImg, authoritySigHtml, nameSignOn, CUSTOMER_SIGN_CSS } from '../lib/receiptSignature';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import RegistryDocuments from '../components/RegistryDocuments';
import { useDocViewer } from '../components/DocViewer';
import BankAccountSelect from '../components/BankAccountSelect';

// ── Helpers ──
const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const escHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const PAYMENT_MODE_OPTIONS = ['CASH', 'BANK', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'TRANSFER'];

// Compact label/value row for the Registry Details rail card.
const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2">
    <dt className="text-slate-400 shrink-0">{label}</dt>
    <dd className="font-semibold text-slate-700 text-right truncate">{value || '—'}</dd>
  </div>
);
const todayISO = () => new Date().toISOString().split('T')[0];
const createEmptyAutocomplete = () => ({
  customerNames: [],
  farmerNames: [],
  paymentModes: [],
  plotOptions: [],
  clientNames: [],
  firmNames: [],
  clientUsers: [],
  recentBankPlotPayments: [],
});

const parsePlotNo = (value) => {
  const text = String(value || '').trim().toUpperCase();
  const match = text.match(/^([A-Z]+)?\s*[-_/]?\s*(\d+)?\s*(.*)$/);
  if (!match) {
    return { block: text, number: Number.MAX_SAFE_INTEGER, suffix: '' };
  }
  return {
    block: (match[1] || '').trim(),
    number: match[2] ? parseInt(match[2], 10) : Number.MAX_SAFE_INTEGER,
    suffix: (match[3] || '').trim(),
  };
};

const comparePlotNo = (a, b) => {
  const pa = parsePlotNo(a);
  const pb = parsePlotNo(b);
  const blockCmp = pa.block.localeCompare(pb.block, 'en', { sensitivity: 'base' });
  if (blockCmp !== 0) return blockCmp;
  if (pa.number !== pb.number) return pa.number - pb.number;
  const suffixCmp = pa.suffix.localeCompare(pb.suffix, 'en', { sensitivity: 'base', numeric: true });
  if (suffixCmp !== 0) return suffixCmp;
  return String(a || '').localeCompare(String(b || ''), 'en', { sensitivity: 'base', numeric: true });
};

const getRegistryPaymentStatus = (registry) => {
  const rp = parseFloat(registry?.registry_payment) || 0;
  const tp = parseFloat(registry?.total_paid) || 0;
  if (rp > 0 && tp <= 0) return 'pending';
  if (rp > 0 && tp >= rp) return 'paid';
  if (rp > 0 && tp > 0 && tp < rp) return 'partial';
  return 'other';
};

const normalizeSearchText = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const matchesSearchText = (value, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(value).includes(normalizedQuery);
};

const SearchableCombo = ({
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  getKey,
  getLabel,
  getSearchText,
  onSelect,
  searchValue,
  setSearchValue,
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => normalizeSearchText(getKey(option)) === normalizeSearchText(value)) || null;
  const filteredOptions = useMemo(() => {
    if (!searchValue?.trim()) return options;
    return options.filter((option) => matchesSearchText(getSearchText(option), searchValue));
  }, [options, searchValue, getSearchText]);

  useEffect(() => {
    if (!open) setSearchValue('');
  }, [open, setSearchValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`h-9 w-full justify-between rounded-md border-slate-200 bg-white px-3 font-normal text-left shadow-sm hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-slate-400 ${triggerClassName}`}
        >
          <span className="min-w-0 truncate text-sm text-slate-700">
            {selectedOption ? getLabel(selectedOption) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-[--radix-popover-trigger-width] p-0 ${menuClassName}`} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={searchValue} onValueChange={setSearchValue} />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-slate-400">{emptyText}</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {filteredOptions.map((option) => {
                const key = getKey(option);
                return (
                  <CommandItem
                    key={key}
                    value={getSearchText(option)}
                    onSelect={() => {
                      onSelect(option);
                      setOpen(false);
                      setSearchValue('');
                    }}
                    className="flex items-start gap-2 px-3 py-2"
                  >
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${normalizeSearchText(value) === normalizeSearchText(key) ? 'opacity-100' : 'opacity-0'}`} />
                    <div className="min-w-0 flex-1">
                      {getLabel(option)}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ── Filter chip styles (shared by every filter control in the registry list) ──
const chipBase = 'h-7 rounded-full text-xs gap-1.5 font-normal px-3 w-auto transition-colors';
const chipOn = 'border-primary/30 bg-primary/10 text-primary font-medium';
const chipOff = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

// ── Multi-select dropdown filter — a Set of active values; clicking an item
// toggles it in/out so several values can be active in the same filter at once. ──
const MultiSelectFilter = ({ label, icon, options, selected, onToggle, onClear, open, onOpenChange, search, onSearchChange }) => {
  const count = selected.size;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`${chipBase} ${count > 0 ? chipOn : chipOff}`}>
          {createElement(icon, { className: 'h-3 w-3 opacity-60' })}
          {count === 0 ? label : count === 1 ? [...selected][0] : `${label} (${count})`}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." value={search} onValueChange={onSearchChange} className="text-xs h-8" />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={onClear}>
                <Check className={`mr-2 h-3.5 w-3.5 ${count === 0 ? 'opacity-100' : 'opacity-0'}`} />
                All {label}
              </CommandItem>
              {options.map((name) => (
                <CommandItem key={name} value={name} onSelect={() => onToggle(name)}>
                  <Check className={`mr-2 h-3.5 w-3.5 ${selected.has(name) ? 'opacity-100' : 'opacity-0'}`} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const PlotRegistry = () => {
  const navigate = useNavigate();
  const openDoc = useDocViewer();
  const { id: registryIdParam } = useParams();
  const { currentSite, canManage, user, isAdmin, hasPermission } = useAuth();
  const sitePolicy = useContext(SitePolicyContext);
  const registryLabel = sitePolicy?.getTerm?.('conveyance_module', 'Plot Registry') || 'Plot Registry';
  const canWrite  = canManage && hasPermission('plot_registry', 'write');
  const canUpdate = canManage && hasPermission('plot_registry', 'update');
  const canDelete = canManage && hasPermission('plot_registry', 'delete');
  // Registry documents use registry-owned endpoints and the same permission
  // contract as the rest of this module.
  const canDocWrite = canWrite;
  const canDocDelete = canDelete;
  const siteId = currentSite?.id;

  // ── State ──
  const [registries, setRegistries] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState(null);
  const [registryMeta, setRegistryMeta] = useState(null);
  const [payments, setPayments] = useState([]);
  const [signEntry, setSignEntry] = useState(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [autocomplete, setAutocomplete] = useState(createEmptyAutocomplete);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState([]);

  // Payments-clear check for the plot picked in the create form
  const [plotClearance, setPlotClearance] = useState(null);
  // Document handover timeline (detail view)
  const [handovers, setHandovers] = useState([]);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ given_to: '', notes: '' });
  const [handoverPhoto, setHandoverPhoto] = useState(null);
  const [savingHandover, setSavingHandover] = useState(false);
  const [workflowUnlocked, setWorkflowUnlocked] = useState(false);
  const [registryDocumentCount, setRegistryDocumentCount] = useState(null);
  const registryListRequestRef = useRef(0);
  const paymentRequestRef = useRef(0);
  const handoverRequestRef = useRef(0);
  const autocompleteRequestRef = useRef(0);
  const approverRequestRef = useRef(0);
  const memberTeamRequestRef = useRef(0);
  const editPaymentsRequestRef = useRef(0);
  const activeSiteIdRef = useRef(siteId);
  const selectedRegistryIdRef = useRef(selectedRegistry?.id);
  activeSiteIdRef.current = siteId;
  selectedRegistryIdRef.current = selectedRegistry?.id;
  const registryDetail = selectedRegistry
    && registryMeta
    && String(registryMeta.id) === String(selectedRegistry.id)
    ? registryMeta
    : selectedRegistry;

  // Dialogs
  const [registryDialogOpen, setRegistryDialogOpen] = useState(false);
  const [editingRegistry, setEditingRegistry] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [financeWarningOpen, setFinanceWarningOpen] = useState(false);

  // Filters - list. Each is a Set of active values (empty = no filter) so
  // several options in the same filter can be active at once.
  const [listSearch, setListSearch] = useState('');
  const [filterFarmer, setFilterFarmer] = useState(() => new Set());
  const [filterPaymentStatus, setFilterPaymentStatus] = useState(() => new Set());
  // Team filter — matches the plot's team or the team of the registry's
  // farmer/customer/seller (via members.team).
  const [filterTeam, setFilterTeam] = useState(() => new Set());
  const [filterUser, setFilterUser] = useState(() => new Set()); // customer_name
  const [filterAgent, setFilterAgent] = useState(() => new Set()); // plot's booking_by
  const [memberTeamMap, setMemberTeamMap] = useState({});

  const [filterFarmerOpen, setFilterFarmerOpen] = useState(false);
  const [filterFarmerSearch, setFilterFarmerSearch] = useState('');
  const [filterPaymentStatusOpen, setFilterPaymentStatusOpen] = useState(false);
  const [filterPaymentStatusSearch, setFilterPaymentStatusSearch] = useState('');
  const [filterTeamOpen, setFilterTeamOpen] = useState(false);
  const [filterTeamSearch, setFilterTeamSearch] = useState('');
  const [filterUserOpen, setFilterUserOpen] = useState(false);
  const [filterUserSearch, setFilterUserSearch] = useState('');
  const [filterAgentOpen, setFilterAgentOpen] = useState(false);
  const [filterAgentSearch, setFilterAgentSearch] = useState('');

  // Toggles `value` in/out of a Set-based filter.
  const toggleSetFilter = (setter, value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };
  // Selected registry-row ids — when non-empty, the Excel export outputs only these.
  const [selectedRegs, setSelectedRegs] = useState(() => new Set());

  // Filters - detail
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortOrderRegistries, setSortOrderRegistries] = useState('asc');
  const [sortOrderPayments, setSortOrderPayments] = useState('desc');

  // Registry form
  const [regForm, setRegForm] = useState({
    plot_id: '',
    plot_no: '', customer_name: '', size_meter: '', size_sqyard: '',
    circle_rate: '', registry_date: todayISO(), created_entry_date: todayISO(),
    farmer_name: '', seller_name: '', firm_name: '',
    bank_amount: '', registry_payment: '', notes: '',
    assigned_admin_id: null,
  });

  // Payment form
  const [payForm, setPayForm] = useState({
    payment_date: todayISO(),
    amount: '', payment_mode: '', bank_account_id: '', tally_date: todayISO(), tally_amount: '', notes: '',
    cheque_no: '',
    assigned_admin_id: null,
  });

  const [inlinePayments, setInlinePayments] = useState([]);
  const [linkedPlotPayments, setLinkedPlotPayments] = useState([]);
  const [existingRegistryPayments, setExistingRegistryPayments] = useState([]);
  const [recentPaymentSelect, setRecentPaymentSelect] = useState('');
  const [plotSearch, setPlotSearch] = useState('');
  const [farmerUserSearch, setFarmerUserSearch] = useState('');
  const [sellerUserSearch, setSellerUserSearch] = useState('');

  const addInlinePaymentRow = () => {
    setInlinePayments((prev) => ([
      ...prev,
      { payment_date: todayISO(), amount: '', payment_mode: 'CASH', bank_account_id: '', notes: '' },
    ]));
  };

  const addRecentBankPayment = () => {
    if (!recentPaymentSelect) return;
    const selected = (autocomplete.recentBankPlotPayments || []).find((p) => String(p.id) === String(recentPaymentSelect));
    if (!selected) return;
    if (selected.mapped_registry_payment_id) return;
    if (linkedPlotPayments.some((p) => String(p.id) === String(selected.id))) return;
    setLinkedPlotPayments((prev) => [...prev, selected]);
    setRecentPaymentSelect('');
  };

  const removeRecentBankPayment = (paymentId) => {
    setLinkedPlotPayments((prev) => prev.filter((p) => String(p.id) !== String(paymentId)));
  };

  const removeInlinePaymentRow = (idx) => {
    setInlinePayments((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateInlinePaymentRow = (idx, field, value) => {
    setInlinePayments((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const handlePlotSelect = (plotIdValue) => {
    const selected = autocomplete.plotOptions?.find((p) => String(p.id) === String(plotIdValue));
    if (!selected) {
      setRegForm((prev) => ({ ...prev, plot_id: '', plot_no: '' }));
      setLinkedPlotPayments([]);
      setRecentPaymentSelect('');
      setPlotSearch('');
      setFarmerUserSearch('');
      setSellerUserSearch('');
      return;
    }

    const sizeSqyard = selected.plot_size != null ? String(selected.plot_size) : '';
    const sizeMeter = selected.plot_size != null ? (parseFloat(selected.plot_size || 0) * 0.8364).toFixed(2) : '';
    setRegForm((prev) => ({
      ...prev,
      plot_id: String(selected.id),
      plot_no: selected.plot_no || '',
      customer_name: selected.buyer_name || prev.customer_name,
      size_meter: sizeMeter,
      size_sqyard: sizeSqyard,
      circle_rate: selected.circle_rate != null ? String(selected.circle_rate) : prev.circle_rate,
      bank_amount: selected.to_receive_bank != null ? String(selected.to_receive_bank) : prev.bank_amount,
    }));
    setLinkedPlotPayments((prev) => prev.filter((p) => String(p.plot_id) === String(selected.id)));
    setRecentPaymentSelect('');
    setPlotSearch('');
    setFarmerUserSearch('');
    setSellerUserSearch('');
  };

  const filteredPlotOptions = useMemo(() => {
    const list = [...(autocomplete.plotOptions || [])].sort((a, b) => comparePlotNo(a.plot_no, b.plot_no));
    if (!plotSearch.trim()) return list;
    return list.filter((plot) => matchesSearchText(
      [plot.plot_no, plot.buyer_name, plot.customer_name, plot.farmer_name].filter(Boolean).join(' '),
      plotSearch,
    ));
  }, [autocomplete.plotOptions, plotSearch]);

  const filteredRecentBankPayments = useMemo(() => {
    const selectedPlotId = regForm.plot_id;
    let list = autocomplete.recentBankPlotPayments || [];

    if (selectedPlotId) {
      list = list.filter((p) => String(p.plot_id) === String(selectedPlotId));
    } else {
      list = [];
    }
    return list;
  }, [autocomplete.recentBankPlotPayments, regForm.plot_id]);

  const linkedPaymentsTotal = useMemo(() => {
    return linkedPlotPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [linkedPlotPayments]);

  const inlinePaymentsTotal = useMemo(() => {
    return inlinePayments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  }, [inlinePayments]);

  const allPaymentsTotal = linkedPaymentsTotal + inlinePaymentsTotal;
  const hasAnyPayments = linkedPlotPayments.length > 0 || inlinePayments.some((r) => parseFloat(r.amount) > 0);
  const registryPaymentNum = parseFloat(regForm.registry_payment) || 0;
  const paymentsMatchRegistry = hasAnyPayments && registryPaymentNum > 0 && Math.abs(allPaymentsTotal - registryPaymentNum) < 0.01;
  const financeRemaining = registryPaymentNum - allPaymentsTotal;
  const canCreateRegistry = editingRegistry || (regForm.plot_id && registryPaymentNum > 0);
  // Registry gate: non-admins can only create directly when the plot's bank
  // payments are clear (received >= to_receive_bank); otherwise the create is
  // parked as an edit request for admin approval.
  const needsApproval = !editingRegistry && !isAdmin && !!plotClearance && !plotClearance.clear;

  const filteredFarmerUsers = useMemo(() => {
    const q = normalizeSearchText(farmerUserSearch);
    const users = autocomplete.clientUsers || [];
    if (!q) return users;
    return users.filter((u) =>
      matchesSearchText([u.name, u.phone].filter(Boolean).join(' '), q)
    );
  }, [autocomplete.clientUsers, farmerUserSearch]);

  const filteredSellerUsers = useMemo(() => {
    const q = normalizeSearchText(sellerUserSearch);
    const users = autocomplete.clientUsers || [];
    if (!q) return users;
    return users.filter((u) =>
      matchesSearchText([u.name, u.phone].filter(Boolean).join(' '), q)
    );
  }, [autocomplete.clientUsers, sellerUserSearch]);

  // ── Fetch registries ──
  const fetchRegistries = useCallback(async () => {
    if (!siteId) return;
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
    const requestId = ++registryListRequestRef.current;
    let watchdog;
    try {
      setLoadingList(true);
      // Watchdog so the spinner can never hang on a stalled request.
      watchdog = setTimeout(() => {
        if (requestId === registryListRequestRef.current) setLoadingList(false);
      }, 15000);
      const { data } = await api.get('/registries', { params: { site_id: siteId } });
      if (requestId !== registryListRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setRegistries(data.registries || []);
    } catch (err) {
      if (requestId !== registryListRequestRef.current) return;
      console.error('Failed to fetch registries:', err);
      toast.error('Failed to load registries');
    } finally {
      clearTimeout(watchdog);
      if (requestId === registryListRequestRef.current) setLoadingList(false);
    }
  }, [siteId]);

  // Background refresh — does NOT toggle the page loader.
  const refreshRegistries = useCallback(async () => {
    if (!siteId) return;
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
    const requestId = ++registryListRequestRef.current;
    try {
      const { data } = await api.get('/registries', { params: { site_id: siteId } });
      if (requestId !== registryListRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setRegistries(data.registries || []);
    } catch { /* keep current */ }
  }, [siteId]);

  const fetchAutocomplete = useCallback(async () => {
    if (!siteId) return;
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
    const requestId = ++autocompleteRequestRef.current;
    try {
      const { data } = await api.get('/registries/autocomplete', { params: { site_id: siteId } });
      if (requestId !== autocompleteRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setAutocomplete({ ...createEmptyAutocomplete(), ...data, recentBankPlotPayments: [] });
    } catch (err) {
      if (requestId !== autocompleteRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      console.error('Failed to fetch autocomplete:', err);
    }
    // Fetch bank/cheque payments via GraphQL
    try {
      const { data: gqlData } = await apolloClient.query({
        query: GET_REGISTRY_BANK_CHEQUE_PAYMENTS,
        variables: { siteId: String(siteId) },
        fetchPolicy: 'network-only',
      });
      if (requestId !== autocompleteRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setAutocomplete(prev => ({ ...prev, recentBankPlotPayments: gqlData.registryBankChequePayments || [] }));
    } catch (err) {
      if (requestId !== autocompleteRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      console.error('Failed to fetch bank/cheque payments via GraphQL:', err);
    }
  }, [siteId]);

  const fetchApprovers = useCallback(async () => {
    if (!siteId) return;
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
    const requestId = ++approverRequestRef.current;
    try {
      const url = `/admin/approvers?site_id=${siteId}`;
      const { data } = await api.get(url);
      if (requestId !== approverRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setApprovers(data.approvers || data || []);
    } catch (err) {
      if (requestId !== approverRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      console.error('Failed to fetch approvers:', err);
    }
  }, [siteId]);

  // Members feed the name → team map for the Team filter; failure just leaves
  // the filter hidden, so it must never block the page.
  const fetchMemberTeams = useCallback(async () => {
    if (!siteId) return;
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
    const requestId = ++memberTeamRequestRef.current;
    try {
      const res = await api.get('/members', { params: { site_id: siteId } });
      if (requestId !== memberTeamRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      const map = {};
      (res.data.members || []).forEach(m => {
        if (m.full_name && m.team) map[m.full_name.toUpperCase()] = m.team.toUpperCase();
      });
      setMemberTeamMap(map);
    } catch (err) {
      if (requestId !== memberTeamRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      console.error('Failed to fetch member teams:', err);
      setMemberTeamMap({});
    }
  }, [siteId]);

  useEffect(() => {
    // Invalidate in-flight list/detail requests before exposing the next site's
    // workspace. Late responses must never repopulate it with the prior site.
    registryListRequestRef.current += 1;
    paymentRequestRef.current += 1;
    handoverRequestRef.current += 1;
    autocompleteRequestRef.current += 1;
    approverRequestRef.current += 1;
    memberTeamRequestRef.current += 1;
    editPaymentsRequestRef.current += 1;
    setSelectedRegistry(null);
    setRegistryMeta(null);
    setRegistries([]);
    setPayments([]);
    setHandovers([]);
    setRegistryDocumentCount(null);
    setLoadingPayments(false);
    setAutocomplete(createEmptyAutocomplete());
    setApprovers([]);
    setExistingRegistryPayments([]);
    setLinkedPlotPayments([]);
    setInlinePayments([]);
    setEditingRegistry(null);
    setEditingPaymentId(null);
    setRegistryDialogOpen(false);
    setPaymentDialogOpen(false);
    setSelectedRegs(new Set());
    setFilterFarmer(new Set());
    setFilterPaymentStatus(new Set());
    setFilterTeam(new Set());
    setFilterUser(new Set());
    setFilterAgent(new Set());
    setMemberTeamMap({});
    fetchRegistries();
    fetchAutocomplete();
    fetchApprovers();
    fetchMemberTeams();
  }, [siteId, fetchRegistries, fetchAutocomplete, fetchApprovers, fetchMemberTeams]);

  useEffect(() => {
    let active = true;
    setWorkflowUnlocked(false);
    if (!siteId) return () => { active = false; };

    api.get('/settings/features', { params: { site_id: siteId } })
      .then(({ data }) => {
        if (active) setWorkflowUnlocked(Boolean(data.features?.plot_registry_workflow_unlocked));
      })
      .catch(() => {
        // Fail closed: if settings cannot be read, preserve sequential rules.
        if (active) setWorkflowUnlocked(false);
      });

    return () => { active = false; };
  }, [siteId]);

  // ── Fetch payments when registry selected ──
  const fetchPayments = useCallback(async (regId) => {
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
        || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
    const requestId = ++paymentRequestRef.current;
    let watchdog;
    try {
      setLoadingPayments(true);
      watchdog = setTimeout(() => {
        if (requestId === paymentRequestRef.current) setLoadingPayments(false);
      }, 15000);
      const { data } = await api.get('/registries/payments/list', { params: { registry_id: regId } });
      if (requestId !== paymentRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
          || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
      setPayments(data.payments || []);
      setRegistryMeta(
        data.registry && String(data.registry.id) === String(regId) ? data.registry : null
      );
    } catch (err) {
      if (requestId !== paymentRequestRef.current) return;
      console.error('Failed to fetch payments:', err);
    } finally {
      clearTimeout(watchdog);
      if (requestId === paymentRequestRef.current) setLoadingPayments(false);
    }
  }, [siteId]);

  // Background refresh — does NOT toggle the loader.
  const refreshPayments = useCallback(async (regId) => {
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
        || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
    const requestId = ++paymentRequestRef.current;
    try {
      const { data } = await api.get('/registries/payments/list', { params: { registry_id: regId } });
      if (requestId !== paymentRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
          || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
      setPayments(data.payments || []);
      setRegistryMeta(
        data.registry && String(data.registry.id) === String(regId) ? data.registry : null
      );
    } catch { /* keep current */ }
  }, [siteId]);

  useEffect(() => {
    paymentRequestRef.current += 1;
    setRegistryDocumentCount(null);
    setRegistryMeta(null);
    setPayments([]);
    setLoadingPayments(Boolean(selectedRegistry));
    if (selectedRegistry) fetchPayments(selectedRegistry.id);
  }, [selectedRegistry, fetchPayments]);

  const handleRegistryDocumentsChange = useCallback((documents) => {
    setRegistryDocumentCount(
      (documents || []).filter((document) => String(document.category || '').toUpperCase() === 'REGISTRY').length
    );
  }, []);

  // ── Payments-clear check whenever a plot is picked in the create form ──
  useEffect(() => {
    setPlotClearance(null); // never let the previous plot's clearance linger
    if (!regForm.plot_id || editingRegistry) return;
    let stale = false;
    api.get('/registries/plot-clearance', { params: { plot_id: regForm.plot_id } })
      .then(({ data }) => { if (!stale) setPlotClearance(data.clearance || null); })
      .catch(() => { if (!stale) setPlotClearance(null); });
    return () => { stale = true; };
  }, [regForm.plot_id, editingRegistry]);

  // ── Handover timeline for the open registry ──
  const fetchHandovers = useCallback(async (regId) => {
    const requestedSiteId = siteId;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
        || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
    const requestId = ++handoverRequestRef.current;
    try {
      const { data } = await api.get(`/registries/${regId}/handovers`);
      if (requestId !== handoverRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
          || String(selectedRegistryIdRef.current || '') !== String(regId)) return;
      setHandovers(data.handovers || []);
    } catch {
      if (requestId === handoverRequestRef.current) setHandovers([]);
    }
  }, [siteId]);

  useEffect(() => {
    handoverRequestRef.current += 1;
    setHandovers([]);
    if (selectedRegistry) fetchHandovers(selectedRegistry.id);
  }, [selectedRegistry, fetchHandovers]);

  const getAssignedAdminLabel = (record) => {
    if (record?.assigned_admin_name) return record.assigned_admin_name;
    const assignedId = record?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  // ── Registry form handlers ──
  const resetRegForm = () => {
    editPaymentsRequestRef.current += 1;
    setRegForm({
      plot_id: '',
      plot_no: '', customer_name: '', size_meter: '', size_sqyard: '',
      circle_rate: '', registry_date: todayISO(), created_entry_date: todayISO(),
      farmer_name: '', seller_name: '', firm_name: '',
      bank_amount: '', registry_payment: '', notes: '',
      assigned_admin_id: null,
    });
    setInlinePayments([]);
    setLinkedPlotPayments([]);
    setExistingRegistryPayments([]);
    setRecentPaymentSelect('');
    setPlotSearch('');
    setFarmerUserSearch('');
    setSellerUserSearch('');
    setEditingRegistry(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateRegistry = () => { resetRegForm(); setRegistryDialogOpen(true); };

  const handleOpenEditRegistry = (r) => {
    const requestedSiteId = siteId;
    const requestedRegistryId = r.id;
    const requestId = ++editPaymentsRequestRef.current;
    setRegForm({
      plot_id: r.plot_id ? String(r.plot_id) : '',
      plot_no: r.plot_no || '',
      customer_name: r.customer_name || '',
      size_meter: r.size_meter ? String(r.size_meter) : '',
      size_sqyard: r.size_sqyard ? String(r.size_sqyard) : '',
      circle_rate: r.circle_rate != null ? String(r.circle_rate) : '',
      registry_date: r.registry_date ? r.registry_date.split('T')[0] : todayISO(),
      created_entry_date: r.created_entry_date ? r.created_entry_date.split('T')[0] : (r.created_at ? r.created_at.split('T')[0] : todayISO()),
      farmer_name: r.farmer_name || '',
      seller_name: r.seller_name || '',
      firm_name: r.firm_name || '',
      bank_amount: r.bank_amount != null ? String(r.bank_amount) : '',
      registry_payment: r.registry_payment ? String(r.registry_payment) : '',
      notes: r.notes || '',
      assigned_admin_id: r.assigned_admin_id || null,
    });
    setInlinePayments([]);
    setLinkedPlotPayments([]);
    setExistingRegistryPayments([]);
    setRecentPaymentSelect('');
    setPlotSearch('');
    setFarmerUserSearch('');
    setSellerUserSearch('');
    setEditingRegistry(r);
    // Load existing payments for unlinking
    api.get('/registries/payments/list', { params: { registry_id: r.id } })
      .then(({ data }) => {
        if (requestId !== editPaymentsRequestRef.current
            || String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')
            || String(data.registry?.id || requestedRegistryId) !== String(requestedRegistryId)) return;
        setExistingRegistryPayments(data.payments || []);
      })
      .catch(() => {});
    setRegistryDialogOpen(true);
  };

  // Sub-admin path: payments not clear — park the full create payload as an
  // edit request (module plot_registry_create, record_id = plot_id) for an
  // admin to approve. Approval executes the actual create server-side.
  const submitRegistryApproval = async (createPayload) => {
    // Plain JSON — no proof photo, so FormData (and its axios content-type
    // pitfalls) is unnecessary.
    await api.post('/edit-requests', {
      module: 'plot_registry_create',
      record_id: createPayload.plot_id,
      site_id: siteId || null,
      proposed_data: JSON.stringify(createPayload),
    });
    toast.success('Registry sent for admin approval — it will be created once an admin approves');
  };

  const executeRegistrySave = async () => {
    setFinanceWarningOpen(false);
    setMessage({ type: '', text: '' });
    if (!editingRegistry && !regForm.plot_id) {
      setMessage({ type: 'error', text: 'Please select plot number from dropdown' });
      return;
    }
    const unmappedBankRow = inlinePayments.find((row) => (
      parseFloat(row.amount) > 0 && row.payment_mode !== 'CASH' && !row.bank_account_id
    ));
    if (unmappedBankRow) {
      setMessage({ type: 'error', text: 'Select a bank account for every non-cash manual payment.' });
      return;
    }
    setSubmitting(true);
    let createPayload = null;
    try {
      const payload = {
        site_id: siteId,
        plot_id: regForm.plot_id || null,
        plot_no: regForm.plot_no,
        customer_name: regForm.customer_name,
        size_meter: regForm.size_meter,
        size_sqyard: regForm.size_sqyard,
        circle_rate: regForm.circle_rate,
        registry_date: regForm.registry_date || todayISO(),
        created_entry_date: regForm.created_entry_date || todayISO(),
        farmer_name: regForm.farmer_name,
        seller_name: regForm.seller_name,
        firm_name: regForm.firm_name,
        bank_amount: regForm.bank_amount,
        registry_payment: regForm.registry_payment,
        notes: regForm.notes,
        assigned_admin_id: regForm.assigned_admin_id,
      };
      if (editingRegistry) {
        const { data: resData } = await api.put(`/registries/${editingRegistry.id}`, payload);
        if (linkedPlotPayments.length > 0) {
          await Promise.all(linkedPlotPayments.map((row) => api.post('/registries/payments', {
            registry_id: editingRegistry.id,
            source_plot_payment_id: row.id,
          })));
        }
        const validInlineRows = inlinePayments.filter((row) => parseFloat(row.amount) > 0);
        if (validInlineRows.length > 0) {
          await Promise.all(validInlineRows.map((row) => api.post('/registries/payments', {
            registry_id: editingRegistry.id,
            payment_date: row.payment_date || todayISO(),
            amount: row.amount,
            payment_mode: row.payment_mode,
            bank_account_id: row.bank_account_id || null,
            tally_date: row.tally_date || null,
            tally_amount: row.tally_amount,
            notes: row.notes,
          })));
        }
        const msgParts = ['Registry updated'];
        if (resData?.plot_status_updated) {
          msgParts.push('— Plot status auto-updated to REGISTRY in Plot Payments');
        }
        setMessage({ type: 'success', text: msgParts.join(' ') });
      } else {
        // One transactional POST — the backend requires the money mapped
        // up-front and creates registry + payments atomically.
        createPayload = {
          ...payload,
          payments: [
            ...linkedPlotPayments.map((row) => ({ source_plot_payment_id: row.id })),
            ...inlinePayments
              .filter((row) => parseFloat(row.amount) > 0)
              .map((row) => ({
                payment_date: row.payment_date || todayISO(),
                amount: row.amount,
                payment_mode: row.payment_mode,
                bank_account_id: row.bank_account_id || null,
                tally_date: row.tally_date || null,
                tally_amount: row.tally_amount,
                notes: row.notes,
              })),
          ],
        };
        if (needsApproval) {
          if (createPayload.payments.length === 0) {
            setMessage({ type: 'error', text: 'Map at least one payment before submitting for approval — a registry cannot be created without money mapped to it' });
            return;
          }
          await submitRegistryApproval(createPayload);
          setRegistryDialogOpen(false);
          return;
        }
        const created = await api.post('/registries', createPayload);
        const msgParts = ['Registry created'];
        if (created?.data?.plot_status_updated) {
          msgParts.push('— Plot status auto-updated to PENDING NOC in Plot Payments');
        }
        setMessage({ type: 'success', text: msgParts.join(' ') });
      }
      // Close dialog instantly; reconcile in background. The new/edited
      // registry needs server-computed totals (LATERAL aggregate), so we
      // refetch the list rather than splicing a stale temp row.
      setRegistryDialogOpen(false);
      refreshRegistries();
      fetchAutocomplete(); // background, refresh once new firm/farmer/customer name appears
      if (selectedRegistry && editingRegistry) {
        refreshPayments(selectedRegistry.id);
      }
    } catch (err) {
      // Server-side payments-clear gate — fallback when the client pre-check
      // was missing/stale: route the same payload to admin approval.
      if (err.response?.data?.code === 'PAYMENTS_NOT_CLEAR' && createPayload) {
        try {
          await submitRegistryApproval(createPayload);
          setRegistryDialogOpen(false);
          return;
        } catch (e2) {
          setMessage({ type: 'error', text: e2.response?.data?.message || 'Failed to submit for admin approval' });
          return;
        } finally {
          setSubmitting(false);
        }
      }
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save registry' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRegistry = (ev) => {
    ev.preventDefault();
    // Show finance warning if payments don't cover registry payment
    if (registryPaymentNum > 0 && Math.abs(financeRemaining) >= 0.01) {
      setFinanceWarningOpen(true);
      return;
    }
    executeRegistrySave();
  };

  // Record an offline handover of the registry papers — receipt-style, with a
  // live photo captured at the moment of handover.
  const handleSubmitHandover = async (ev) => {
    ev.preventDefault();
    if (!selectedRegistry) return;
    setSavingHandover(true);
    try {
      let photoUrl = null;
      if (handoverPhoto) {
        const fd = new FormData();
        fd.append('file', handoverPhoto);
        const up = await api.post('/upload/single?provider=s3', fd);
        photoUrl = up.data?.url || null;
      }
      const { data } = await api.post(`/registries/${selectedRegistry.id}/handovers`, {
        given_to: handoverForm.given_to,
        notes: handoverForm.notes,
        photo_url: photoUrl,
      });
      setHandovers((prev) => [data.handover, ...prev]);
      setHandoverDialogOpen(false);
      setHandoverPhoto(null);
      toast.success('Handover recorded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record handover');
    } finally {
      setSavingHandover(false);
    }
  };

  const openHandoverDialog = () => {
    setHandoverForm({ given_to: registryDetail?.customer_name || '', notes: '' });
    setHandoverPhoto(null);
    setHandoverDialogOpen(true);
  };

  const handleDeleteRegistry = async (r) => {
    if (!window.confirm(`Delete registry for Plot ${r.plot_no}? This will delete all its payments.`)) return;
    // Optimistic removal — instant UI feedback. Roll back on failure.
    const snapshot = registries;
    setRegistries((prev) => prev.filter((x) => x.id !== r.id));
    if (selectedRegistry?.id === r.id) {
      setSelectedRegistry(null);
      setRegistryMeta(null);
      setPayments([]);
      setRegistryDocumentCount(null);
    }
    try {
      await api.delete(`/registries/${r.id}`);
      refreshRegistries();
    } catch (err) {
      setRegistries(snapshot); // rollback
      console.error('Failed to delete registry:', err);
    }
  };

  // ── Payment form handlers ──
  const resetPayForm = () => {
    setPayForm({
      payment_date: todayISO(),
      amount: '', payment_mode: '', bank_account_id: '', tally_date: todayISO(), tally_amount: '', notes: '',
      assigned_admin_id: null,
    });
    setEditingPaymentId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreatePayment = () => { resetPayForm(); setPaymentDialogOpen(true); };

  const handleOpenEditPayment = (p) => {
    setPayForm({
      payment_date: p.payment_date ? p.payment_date.split('T')[0] : todayISO(),
      amount: p.amount ? String(Math.abs(parseFloat(p.amount))) : '',
      payment_mode: p.payment_mode || '',
      bank_account_id: p.bank_account_id ? String(p.bank_account_id) : '',
      tally_date: p.tally_date ? p.tally_date.split('T')[0] : todayISO(),
      tally_amount: p.tally_amount != null ? String(p.tally_amount) : '',
      notes: p.notes || '',
      assigned_admin_id: p.assigned_admin_id || null,
    });
    setEditingPaymentId(p.id);
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });
    if (payForm.payment_mode && payForm.payment_mode !== 'CASH' && !payForm.bank_account_id) {
      setMessage({ type: 'error', text: 'Select the bank account used for this payment.' });
      return;
    }

    const payload = {
      registry_id: selectedRegistry.id,
      payment_date: payForm.payment_date || todayISO(),
      amount: payForm.amount,
      payment_mode: payForm.payment_mode,
      bank_account_id: payForm.bank_account_id || null,
      tally_date: payForm.tally_date || todayISO(),
      tally_amount: payForm.tally_amount,
      notes: payForm.notes,
      cheque_no: payForm.payment_mode === 'CHEQUE' ? (payForm.cheque_no || null) : null,
      assigned_admin_id: payForm.assigned_admin_id,
    };

    // ── Optimistic UI: splice the new/edited payment locally and close
    //    the dialog BEFORE the network call. ──
    const snapshotPayments = payments;
    const snapshotRegistries = registries;
    const targetEditing = editingPaymentId;
    const isCreate = !targetEditing;

    if (isCreate) {
      const tempId = -Date.now();
      setPayments((prev) => [
        ...prev,
        {
          id: tempId,
          registry_id: selectedRegistry.id,
          ...payload,
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      setPayments((prev) => prev.map((p) => (p.id === targetEditing ? { ...p, ...payload } : p)));
    }

    // Bump the selected registry card's total_paid/payment_count locally.
    const newAmt = parseFloat(payload.amount) || 0;
    let oldAmt = 0;
    if (!isCreate) {
      const prev = snapshotPayments.find((p) => p.id === targetEditing);
      oldAmt = parseFloat(prev?.amount) || 0;
    }
    setRegistries((prev) => prev.map((r) =>
      r.id === selectedRegistry.id
        ? {
            ...r,
            total_paid: (parseFloat(r.total_paid) || 0) + (newAmt - oldAmt),
            payment_count: (parseInt(r.payment_count) || 0) + (isCreate ? 1 : 0),
          }
        : r
    ));

    setPaymentDialogOpen(false);

    setSubmitting(true);
    try {
      if (targetEditing) {
        await api.put(`/registries/payments/${targetEditing}`, payload);
        setMessage({ type: 'success', text: 'Payment updated' });
      } else {
        await api.post('/registries/payments', payload);
        setMessage({ type: 'success', text: 'Payment recorded' });
      }
      // Reconcile in background.
      refreshPayments(selectedRegistry.id);
      refreshRegistries();
    } catch (err) {
      setPayments(snapshotPayments);
      setRegistries(snapshotRegistries);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save payment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (p) => {
    if (!window.confirm('Delete this payment?')) return;
    // Optimistic removal — instant UI feedback. Adjust registry totals too.
    const snapshotPayments = payments;
    const snapshotRegistries = registries;
    const removed = payments.find((x) => x.id === p.id);
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
    if (removed && selectedRegistry) {
      const dAmt = parseFloat(removed.amount) || 0;
      setRegistries((prev) => prev.map((r) =>
        r.id === selectedRegistry.id
          ? {
              ...r,
              total_paid: (parseFloat(r.total_paid) || 0) - dAmt,
              payment_count: Math.max(0, (parseInt(r.payment_count) || 0) - 1),
            }
          : r
      ));
    }
    try {
      await api.delete(`/registries/payments/${p.id}`);
      refreshPayments(selectedRegistry.id);
      refreshRegistries();
    } catch (err) {
      setPayments(snapshotPayments);
      setRegistries(snapshotRegistries);
      console.error('Failed to delete payment:', err);
    }
  };

  // ── Auto-calc meter from gaz: mtr = gaz * 0.8364 ──
  const handleGazChange = (val) => {
    const gaz = parseFloat(val) || 0;
    const meter = gaz > 0 ? (gaz * 0.8364).toFixed(2) : '';
    setRegForm({ ...regForm, size_sqyard: val, size_meter: meter });
  };

  // ── Computed values ──
  // Teams a registry belongs to: the plot's own team plus the member team of
  // its farmer / customer / seller (name-matched against members.team).
  const registryTeams = useCallback((r) => {
    const teams = new Set();
    if (r.plot_team) teams.add(String(r.plot_team).toUpperCase());
    [r.farmer_name, r.customer_name, r.seller_name].forEach(n => {
      const t = n && memberTeamMap[String(n).toUpperCase()];
      if (t) teams.add(t);
    });
    return teams;
  }, [memberTeamMap]);

  const uniqueRegTeams = useMemo(() => {
    const set = new Set();
    registries.forEach(r => registryTeams(r).forEach(t => set.add(t)));
    return [...set].sort();
  }, [registries, registryTeams]);

  const filteredRegistries = useMemo(() => {
    let list = [...registries];
    if (filterFarmer.size > 0) list = list.filter(r => filterFarmer.has(r.farmer_name));
    if (filterPaymentStatus.size > 0) {
      list = list.filter((r) => filterPaymentStatus.has(getRegistryPaymentStatus(r)));
    }
    if (filterTeam.size > 0) list = list.filter(r => [...registryTeams(r)].some(t => filterTeam.has(t)));
    if (filterUser.size > 0) list = list.filter(r => filterUser.has(r.customer_name));
    if (filterAgent.size > 0) list = list.filter(r => filterAgent.has(r.agent_name));
    const q = listSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(r =>
        r.plot_no?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.farmer_name?.toLowerCase().includes(q) ||
        r.seller_name?.toLowerCase().includes(q) ||
        r.firm_name?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => comparePlotNo(a.plot_no, b.plot_no));
    if (sortOrderRegistries === 'desc') list.reverse();
    return list;
  }, [registries, listSearch, filterFarmer, filterPaymentStatus, filterTeam, filterUser, filterAgent, registryTeams, sortOrderRegistries]);

  // ── Row selection (selection ∩ current filters is what actually exports) ──
  const selectedVisibleRegs = useMemo(
    () => filteredRegistries.filter(r => selectedRegs.has(r.id)),
    [filteredRegistries, selectedRegs]
  );
  const allFilteredRegsSelected = filteredRegistries.length > 0 && selectedVisibleRegs.length === filteredRegistries.length;

  const toggleSelectReg = (id) => {
    setSelectedRegs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Header checkbox — selects/clears every row matching the current filters.
  const toggleSelectAllRegs = () => {
    setSelectedRegs(prev => {
      const next = new Set(prev);
      if (allFilteredRegsSelected) filteredRegistries.forEach(r => next.delete(r.id));
      else filteredRegistries.forEach(r => next.add(r.id));
      return next;
    });
  };

  const uniqueFarmers = useMemo(() => {
    const set = new Set(registries.map(r => r.farmer_name).filter(Boolean));
    return [...set].sort();
  }, [registries]);

  // Buyers/customers for the User filter dropdown.
  const uniqueUsers = useMemo(() => {
    const set = new Set(registries.map(r => r.customer_name).filter(Boolean));
    return [...set].sort();
  }, [registries]);

  // Booking agents (via the linked plot) for the Agent filter dropdown.
  const uniqueAgents = useMemo(() => {
    const set = new Set(registries.map(r => r.agent_name).filter(Boolean));
    return [...set].sort();
  }, [registries]);

  const filteredPayments = useMemo(() => {
    let list = payments;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = payments.filter(p =>
        p.payment_mode?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
      );
    }
    const res = [...list];
    if (sortOrderPayments === 'asc') res.reverse();
    return res;
  }, [payments, searchQuery, sortOrderPayments]);

  // Detail computed
  const regPayment = parseFloat(registryDetail?.registry_payment) || 0;
  const totalPaid = parseFloat(registryDetail?.total_paid) || 0;
  const balance = regPayment - totalPaid;
  const pctPaid = regPayment > 0 ? (totalPaid / regPayment) * 100 : 0;
  const totalTally = useMemo(() => payments.reduce((s, p) => s + (parseFloat(p.tally_amount) || 0), 0), [payments]);
  const paymentReceivedBreakdown = useMemo(() => {
    return payments.reduce((acc, pay) => {
      const amount = parseFloat(pay.amount) || 0;
      if (String(pay.payment_mode || '').trim().toUpperCase() === 'CASH') {
        acc.cash += amount;
      } else {
        acc.bank += amount;
      }
      return acc;
    }, { cash: 0, bank: 0 });
  }, [payments]);

  useEffect(() => {
    if (!registryIdParam) {
      setSelectedRegistry(null);
      return;
    }
    const found = registries.find((r) => String(r.id) === String(registryIdParam));
    setSelectedRegistry(found || null);
  }, [registryIdParam, registries]);

  // ── Excel export (single registry) ──
  const downloadExcel = () => {
    if (!selectedRegistry) return;
    const r = registryDetail;
    const rows = [
      [`Plot Registry — ${r.plot_no}`],
      [`Customer: ${r.customer_name || 'N/A'}  |  Farmer: ${r.farmer_name || 'N/A'}  |  Size: ${r.size_meter || '-'} m² / ${r.size_sqyard || '-'} sqyd`],
      [`Registry Date: ${fmtDate(r.registry_date)}  |  Registry Payment: ₹${fmt(regPayment)}  |  Total Paid: ₹${fmt(totalPaid)}  |  Balance: ₹${fmt(balance)}`],
      [],
      ['#', 'Registry Date', 'Registry Amount (₹)', 'Mode', 'Tally Date', 'Tally Amount (₹)', 'Notes'],
    ];
    filteredPayments.forEach((t, i) => {
      rows.push([
        i + 1,
        t.payment_date ? fmtDate(t.payment_date) : (t.payment_mode || 'TOKEN'),
        parseFloat(t.amount) || 0,
        t.payment_mode || '',
        fmtDate(t.tally_date),
        t.tally_amount != null ? parseFloat(t.tally_amount) : '',
        t.notes || '',
      ]);
    });
    rows.push([]);
    rows.push(['', 'TOTAL', totalPaid, '', '', totalTally, '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Plot ${r.plot_no}`);
    XLSX.writeFile(wb, `Registry_${r.plot_no}_${currentSite?.name || 'site'}.xlsx`);
  };

  const printPaymentReceipt = (pay) => {
    const r = registryDetail;
    if (!r || !pay) return;

    // CASH mode → clean minimal A5 receipt (no QR / watermark); issuer kept.
    if ((pay.payment_mode || '').toUpperCase() === 'CASH') {
      const cashAbs = Math.abs(parseFloat(pay.amount) || 0);
      printCashReceipt({
        siteName: (currentSite?.name || 'COMPANY').toUpperCase(),
        siteAddr: [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase(),
        docTitle: 'Cash Payment Receipt',
        voucherNo: `REG-${String(pay.id || '').padStart(6, '0')}`,
        dateStr: pay.payment_date ? new Date(pay.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
        printedAt: new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        partyLabel: 'Received From', partyName: (r.buyer_name || r.customer_name || '').toUpperCase(),
        plotNo: r.plot_no || '',
        amount: cashAbs,
        rows: [
          { label: 'Notes', value: pay.notes || '' },
        ],
        signerName: user?.full_name || user?.name || '',
        customerSigLabel: 'Customer Signature',
        row: pay,
      });
      return;
    }

    const receiptWindow = window.open('', '_blank', 'width=1000,height=750');
    if (!receiptWindow) return;

    const amount = parseFloat(pay.amount) || 0;
    const absAmt = Math.abs(amount);
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const siteName = (currentSite?.name || 'COMPANY').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const payDate = pay.payment_date ? new Date(pay.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const tallyDate = pay.tally_date ? new Date(pay.tally_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const signerName = user?.full_name || user?.name || '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'REGISTRY PAYMENT CENTER'}</p>
          </div>
          <div class="doc-type"><h2>Registry Payment Receipt</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> REG-${String(pay.id || '').padStart(6, '0')}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-section">
            <div class="kv-row"><div class="k">Plot No</div><div class="c">:</div><div class="v">${escHtml(r.plot_no || '—')}</div></div>
            <div class="kv-row"><div class="k">Customer</div><div class="c">:</div><div class="v">${escHtml((r.customer_name || '—').toUpperCase())}</div></div>
            <div class="kv-row"><div class="k">Farmer</div><div class="c">:</div><div class="v">${escHtml((r.farmer_name || '—').toUpperCase())}</div></div>
            <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:#059669">RS ${fmtINR(absAmt)}/-</div></div>
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>Payment Date</th><td>${payDate}</td></tr>
            <tr><th>Payment Mode</th><td>${escHtml(pay.payment_mode || '—')}</td></tr>
            <tr><th>Amount</th><td style="color:#059669">RS ${fmtINR(absAmt)}/-</td></tr>
            <tr><th>Tally Date</th><td>${tallyDate}</td></tr>
            <tr><th>Tally Amount</th><td>${pay.tally_amount != null ? 'RS ' + fmtINR(Math.abs(parseFloat(pay.tally_amount))) + '/-' : '—'}</td></tr>
            <tr><th>Notes</th><td>${escHtml(pay.notes || '—')}</td></tr>
          </table>
          <div class="footer">
            <div class="sig-box">${customerSigImg(pay)}<div class="sig-line">Customer Signature</div></div>
            <div class="sig-box">${authoritySigHtml(pay, signerName)}<div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>REGISTRY RECEIPT - Plot ${escHtml(r.plot_no)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 5mm 5mm; overflow: hidden; }
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
    .kv-section { padding: 0 3mm; margin-bottom: 3mm; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .settlement-title { margin: 2mm 3mm 1mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 1.5mm 3mm; text-align: left; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .footer { margin-top: auto; display: flex; justify-content: space-between; padding: 6mm 5mm 2mm; }
    .sig-box { text-align: center; width: 55mm; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 4px; line-height: 1.2; }
    ${CUSTOMER_SIGN_CSS}
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Customer Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="window.print()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    writePrintDocument(receiptWindow, html);
    receiptWindow.document.close();
  };

  const printStatement = () => {
    const r = registryDetail;
    if (!r) return;

    const statementWindow = window.open('', '_blank');
    if (!statementWindow) return;

    const rows = payments.map((pay, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escHtml(fmtDate(pay.payment_date))}</td>
        <td>${escHtml(pay.payment_mode || '-')}</td>
        <td>${escHtml(pay.cheque_no || '-')}</td>
        <td style="text-align: right;">${escHtml(fmt(pay.amount))}</td>
        <td>${escHtml(fmtDate(pay.tally_date))}</td>
        <td style="text-align: right;">${escHtml(pay.tally_amount != null ? fmt(pay.tally_amount) : '-')}</td>
        <td>${escHtml(pay.notes || '-')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Plot Statement - ${escHtml(r.plot_no)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
    .wrap { max-width: 980px; margin: 0 auto; }
    .head { margin-bottom: 14px; }
    h1 { margin: 0; font-size: 24px; }
    .sub { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .meta { margin: 12px 0 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .meta div { border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; }
    .lbl { color: #6b7280; display: block; margin-bottom: 4px; }
    .val { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f8fafc; }
    .tfoot td { font-weight: 700; background: #f8fafc; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>Plot Statement</h1>
      <div class="sub">Plot ${escHtml(r.plot_no)} | Generated on ${escHtml(new Date().toLocaleString('en-IN'))}</div>
    </div>

    <div class="meta">
      <div><span class="lbl">Customer</span><span class="val">${escHtml(r.customer_name || '-')}</span></div>
      <div><span class="lbl">Farmer</span><span class="val">${escHtml(r.farmer_name || '-')}</span></div>
      <div><span class="lbl">Registry Date</span><span class="val">${escHtml(fmtDate(r.registry_date))}</span></div>
      <div><span class="lbl">Registry Amount</span><span class="val">Rs ${escHtml(fmt(regPayment))}</span></div>
      <div><span class="lbl">Total Paid</span><span class="val">Rs ${escHtml(fmt(totalPaid))}</span></div>
      <div><span class="lbl">Balance</span><span class="val">Rs ${escHtml(fmt(balance))}</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Payment Date</th>
          <th>Mode</th>
          <th>Cheque No</th>
          <th style="text-align:right;">Amount (Rs)</th>
          <th>Tally Date</th>
          <th style="text-align:right;">Tally Amount (Rs)</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center; color:#6b7280;">No transactions found</td></tr>'}
      </tbody>
      <tfoot>
        <tr class="tfoot">
          <td colspan="4">Totals</td>
          <td style="text-align:right;">${escHtml(fmt(totalPaid))}</td>
          <td></td>
          <td style="text-align:right;">${escHtml(fmt(totalTally))}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <script>
    window.onload = function () {
      window.print();
    };
  </script>
</body>
</html>`;

    writePrintDocument(statementWindow, html);
    statementWindow.document.close();
  };

  // ── Excel export (all registries) — selected rows only (∩ filters) when a
  //    selection exists; otherwise everything the filtered table shows. ──
  const downloadAllRegistriesExcel = () => {
    const exportList = selectedVisibleRegs.length > 0 ? selectedVisibleRegs : filteredRegistries;
    const headers = ['No', 'Plot No', 'Customer Name', 'Size (m²)', 'Size (sqyd)', 'Registry Date', 'Farmer Name', 'Registry Payment (₹)', 'Total Paid (₹)', 'Balance (₹)', '% Paid', 'Payments'];
    const rows = exportList.map((r, i) => {
      const rp = parseFloat(r.registry_payment) || 0;
      const tp = parseFloat(r.total_paid) || 0;
      const bl = rp - tp;
      const pc = rp > 0 ? ((tp / rp) * 100).toFixed(1) : '0.0';
      return [i + 1, r.plot_no, r.customer_name || '', r.size_meter || '', r.size_sqyard || '', fmtDate(r.registry_date), r.farmer_name || '', rp, tp, bl, pc + '%', r.payment_count || 0];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registries');
    XLSX.writeFile(wb, `Plot_Registries_${currentSite?.name || 'site'}${selectedVisibleRegs.length > 0 ? '_selected' : ''}.xlsx`);
  };

  // ── Print (HTML viewer, same pattern as the commission register) — outputs
  //    ONLY the selected rows (∩ current filters); with no selection it falls
  //    back to everything the filtered table shows. ──
  const printRegistryList = () => {
    const printList = selectedVisibleRegs.length > 0 ? selectedVisibleRegs : filteredRegistries;
    if (printList.length === 0) {
      toast.error('No registries to print for the current filters');
      return;
    }
    const totals = printList.reduce((acc, reg) => {
      const rp = parseFloat(reg.registry_payment) || 0;
      const tp = parseFloat(reg.total_paid) || 0;
      acc.sizeMeter += parseFloat(reg.size_meter) || 0;
      acc.sizeSqyard += parseFloat(reg.size_sqyard) || 0;
      acc.registryAmt += rp;
      acc.paid += tp;
      acc.balance += rp - tp;
      return acc;
    }, { sizeMeter: 0, sizeSqyard: 0, registryAmt: 0, paid: 0, balance: 0 });
    const totalPct = totals.registryAmt > 0 ? (totals.paid / totals.registryAmt) * 100 : 0;

    // Filter context line so the paper says exactly what subset it covers.
    const contextBits = [];
    contextBits.push(`${printList.length}${selectedVisibleRegs.length > 0 ? ' SELECTED' : ''} ${printList.length !== 1 ? 'REGISTRIES' : 'REGISTRY'}`);
    if (listSearch.trim()) contextBits.push(`SEARCH: "${escHtml(listSearch.trim().toUpperCase())}"`);
    if (filterFarmer.size > 0) contextBits.push(`FARMER: ${escHtml([...filterFarmer].join(', '))}`);
    if (filterPaymentStatus.size > 0) contextBits.push(`PAYMENTS: ${[...filterPaymentStatus].join(', ').toUpperCase()}`);
    if (filterTeam.size > 0) contextBits.push(`TEAM: ${escHtml([...filterTeam].join(', '))}`);
    if (filterUser.size > 0) contextBits.push(`USER: ${escHtml([...filterUser].join(', '))}`);
    if (filterAgent.size > 0) contextBits.push(`AGENT: ${escHtml([...filterAgent].join(', '))}`);
    contextBits.push(`GENERATED: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);

    const siteName = escHtml((currentSite?.name || '').toUpperCase());
    const siteAddr = escHtml([currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase());

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>PLOT REGISTRY STATEMENT - ${escHtml(currentSite?.name || '')}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4 landscape; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 10mm; }
    .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 8mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 24px; color: #0f172a; text-transform: uppercase; }
    .header p { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .title { text-align: center; font-family: 'Cinzel', serif; font-size: 14px; margin-bottom: 3mm; letter-spacing: 2px; text-decoration: underline; }
    .context { text-align: center; font-size: 9px; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5mm; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 2.5mm 2mm; text-align: left; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; }
    td { padding: 2.5mm 2mm; border: 1px solid #e2e8f0; }
    .num { text-align: right; }
    .total-row { font-weight: 800; background: #f8fafc; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${siteName}</h1>
    <p>${siteAddr || 'PLOT REGISTRY LEDGER'}</p>
  </div>
  <div class="title">Plot Registry Register</div>
  <div class="context">${contextBits.join(' &nbsp;·&nbsp; ')}</div>
  <table>
    <thead>
      <tr>
        <th>Plot</th>
        <th>Customer</th>
        <th>Farmer</th>
        <th class="num">Size (m²)</th>
        <th class="num">Size (Gaz)</th>
        <th>Registry Date</th>
        <th class="num">Registry Amt</th>
        <th class="num">Paid</th>
        <th class="num">Balance</th>
        <th class="num">% Paid</th>
      </tr>
    </thead>
    <tbody>
      ${printList.map(reg => {
        const rp = parseFloat(reg.registry_payment) || 0;
        const tp = parseFloat(reg.total_paid) || 0;
        const bl = rp - tp;
        const pc = rp > 0 ? (tp / rp) * 100 : 0;
        return `
        <tr>
          <td>${escHtml(reg.plot_no)}</td>
          <td>${escHtml(reg.customer_name || '—')}</td>
          <td>${escHtml(reg.farmer_name || '—')}</td>
          <td class="num">${escHtml(reg.size_meter || '—')}</td>
          <td class="num">${escHtml(reg.size_sqyard || '—')}</td>
          <td>${escHtml(fmtDate(reg.registry_date))}</td>
          <td class="num">₹${escHtml(fmt(rp))}</td>
          <td class="num" style="color:#059669">₹${escHtml(fmt(tp))}</td>
          <td class="num" style="color:${bl <= 0 ? '#059669' : '#dc2626'}">₹${escHtml(fmt(bl))}</td>
          <td class="num">${pc.toFixed(1)}%</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">GRAND TOTALS</td>
        <td class="num">${escHtml(fmt(totals.sizeMeter))}</td>
        <td class="num">${escHtml(fmt(totals.sizeSqyard))}</td>
        <td></td>
        <td class="num">₹${escHtml(fmt(totals.registryAmt))}</td>
        <td class="num" style="color:#059669">₹${escHtml(fmt(totals.paid))}</td>
        <td class="num" style="color:${totals.balance <= 0 ? '#059669' : '#dc2626'}">₹${escHtml(fmt(totals.balance))}</td>
        <td class="num">${totalPct.toFixed(1)}%</td>
      </tr>
    </tbody>
  </table>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print()" style="padding:10px 40px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer;">PRINT REGISTER</button>
  </div>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Popup blocked — allow popups for this site to print');
      return;
    }
    writePrintDocument(w, html);
    w.document.close();
  };

  // ═══════════════════════════════════════════════════
  //  NO SITE GUARD
  // ═══════════════════════════════════════════════════
  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view plot registries</p>
      </div>
    );
  }

  const r = registryDetail;
  // Prefer the live child-document count after its first load. The registry
  // list count is only a bootstrap value and otherwise goes stale after an
  // upload/delete, which used to leave the handover step incorrectly locked.
  const hasRegistryDoc = registryDocumentCount !== null
    ? registryDocumentCount > 0
    : (parseInt(r?.registry_doc_count ?? selectedRegistry?.registry_doc_count, 10) || 0) > 0;

  const scrollToWorkflowSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const workflowSteps = selectedRegistry ? [
    {
      done: true,
      label: 'Registry Entry',
      date: r.created_entry_date || r.registry_date,
      available: true,
      action: canUpdate ? () => handleOpenEditRegistry(r) : null,
    },
    {
      done: Boolean(r.noc_generated_at),
      label: 'NOC Generated',
      date: r.noc_generated_at,
      available: true,
      action: () => navigate(`/plot-registry/${r.id}/noc`),
    },
    {
      done: Boolean(r.noc_approved_at),
      label: 'NOC Approved',
      date: r.noc_approved_at,
      available: Boolean(r.noc_generated_at) || workflowUnlocked,
      action: () => navigate(`/plot-registry/${r.id}/noc`),
    },
    {
      done: hasRegistryDoc,
      label: 'Registry Deed',
      date: null,
      available: Boolean(r.noc_generated_at) || workflowUnlocked,
      action: () => scrollToWorkflowSection('registry-documents-section'),
    },
    {
      done: handovers.length > 0,
      label: 'Handover',
      date: handovers[0]?.given_at,
      available: hasRegistryDoc || workflowUnlocked,
      action: () => scrollToWorkflowSection('registry-handovers-section'),
    },
  ] : [];

  // ═══════════════════════════════════════════════════
  //  SHARED REGISTRY DIALOG (used in both detail & list views)
  // ═══════════════════════════════════════════════════
  const selectedPlot = autocomplete.plotOptions?.find((p) => String(p.id) === String(regForm.plot_id));

  const registryFormDialog = (
    <Dialog open={registryDialogOpen} onOpenChange={(open) => { setRegistryDialogOpen(open); if (!open) resetRegForm(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold">{editingRegistry ? 'Edit Registry' : 'New Registry'}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {editingRegistry ? 'Update registry details below.' : 'Select a plot and fill in registry details.'}
          </DialogDescription>
        </DialogHeader>

        {message.text && (
          <div className={`mx-6 flex gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
              : 'bg-red-50 border border-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmitRegistry} className="space-y-0">
          {/* ── Section 1: Plot Selection ── */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" /> Plot Selection
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Plot (from Plot Payments) *</Label>
                <SearchableCombo
                  value={regForm.plot_id}
                  placeholder="Select plot..."
                  searchPlaceholder="Search plot number or buyer name..."
                  emptyText="No plot found."
                  options={filteredPlotOptions}
                  getKey={(plot) => String(plot.id)}
                  getLabel={(plot) => `${plot.plot_no}${plot.buyer_name ? ` — ${plot.buyer_name}` : ''}`}
                  getSearchText={(plot) => `${plot.plot_no} ${plot.buyer_name || ''} ${plot.customer_name || ''} ${plot.farmer_name || ''}`}
                  onSelect={(plot) => handlePlotSelect(String(plot.id))}
                  searchValue={plotSearch}
                  setSearchValue={setPlotSearch}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plot No</Label>
                <Input placeholder="Auto-filled" value={regForm.plot_no} readOnly disabled className="bg-slate-50" />
              </div>
            </div>

            {/* Auto-filled plot info card */}
            {regForm.plot_id && selectedPlot && (
              <div className="flex items-center gap-4 flex-wrap text-[11px] bg-blue-50/70 border border-blue-100 rounded-lg px-3 py-2">
                <span className="text-blue-600 font-semibold">Auto-filled:</span>
                {selectedPlot.buyer_name && <span className="text-slate-600"><User className="w-3 h-3 inline mr-0.5" />{selectedPlot.buyer_name}</span>}
                {selectedPlot.plot_size && <span className="text-slate-600"><Ruler className="w-3 h-3 inline mr-0.5" />{selectedPlot.plot_size} sq.yd</span>}
                {selectedPlot.to_receive_bank != null && <span className="text-blue-700 font-semibold"><Banknote className="w-3 h-3 inline mr-0.5" />Bank: ₹{fmt(selectedPlot.to_receive_bank)}</span>}
                {selectedPlot.circle_rate != null && <span className="text-slate-600">Circle Rate: {selectedPlot.circle_rate}</span>}
              </div>
            )}

            {/* Payments-clear status — the registry gate */}
            {regForm.plot_id && !editingRegistry && plotClearance && (
              plotClearance.clear ? (
                <div className="flex items-center gap-2 text-[11px] bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-700">
                  <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                  Payments clear — ₹{fmt(plotClearance.received_bank)} received in bank of ₹{fmt(plotClearance.to_receive_bank)} expected.
                </div>
              ) : (
                <div className="flex items-start gap-2 text-[11px] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Payments not clear — ₹{fmt(plotClearance.pending_bank)} still to be received in bank
                    (₹{fmt(plotClearance.received_bank)} of ₹{fmt(plotClearance.to_receive_bank)}).
                    {isAdmin
                      ? ' As admin you can still create this registry.'
                      : ' This registry will be sent for admin approval.'}
                  </span>
                </div>
              )
            )}
          </div>

          <Separator />

          {/* ── Section 2: Registry Details ── */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" /> Registry Details
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Customer Name</Label>
              <Input placeholder="ANUP SINGH S/O MEMBER..."
                value={regForm.customer_name}
                onChange={(e) => setRegForm({ ...regForm, customer_name: e.target.value.toUpperCase() })}
                list="reg-customer-sugg" />
              <datalist id="reg-customer-sugg">
                {autocomplete.customerNames?.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Gaz *</Label>
                <Input type="number" step="0.01" placeholder="205.63"
                  value={regForm.size_sqyard}
                  onChange={(e) => handleGazChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-400">Size (m²) <span className="text-[9px] font-normal italic">auto</span></Label>
                <Input type="number" step="0.01" placeholder="171.89"
                  value={regForm.size_meter}
                  readOnly
                  className="bg-slate-50 text-slate-500 cursor-default"
                  tabIndex={-1} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Circle Rate</Label>
                <Input type="number" step="0.01" placeholder="7000"
                  value={regForm.circle_rate}
                  onChange={(e) => setRegForm({ ...regForm, circle_rate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Registry Date</Label>
                <Input type="date" value={regForm.registry_date}
                  onChange={(e) => setRegForm({ ...regForm, registry_date: e.target.value })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Section 3: Financial ── */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <IndianRupee className="w-3.5 h-3.5" /> Financial
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Amount (₹)</Label>
                <Input type="number" step="0.01" placeholder="814000"
                  value={regForm.bank_amount}
                  onChange={(e) => setRegForm({ ...regForm, bank_amount: e.target.value })}
                  className={regForm.bank_amount ? 'border-blue-200 bg-blue-50/30' : ''} />
                {regForm.bank_amount && <p className="text-[10px] text-blue-500">Auto-filled from plot</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  Registry Payment (₹) *
                  {!editingRegistry && linkedPlotPayments.length > 0 && registryPaymentNum > 0 && (
                    paymentsMatchRegistry
                      ? <span className="text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Matched</span>
                      : <span className="text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Mismatch</span>
                  )}
                </Label>
                <Input type="number" step="0.01" placeholder="1238000"
                  value={regForm.registry_payment}
                  onChange={(e) => setRegForm({ ...regForm, registry_payment: e.target.value })}
                  className={!editingRegistry && linkedPlotPayments.length > 0 && registryPaymentNum > 0
                    ? (paymentsMatchRegistry ? 'border-emerald-300 focus-visible:ring-emerald-400' : 'border-amber-300 focus-visible:ring-amber-400')
                    : ''}
                  required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Entry Date</Label>
                <Input type="date" value={regForm.created_entry_date}
                  onChange={(e) => setRegForm({ ...regForm, created_entry_date: e.target.value })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Section 4: People ── */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" /> People
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Farmer Name</Label>
                <div className="flex items-center gap-1.5">
                  <SearchableCombo
                    value={regForm.farmer_name}
                    placeholder="Select farmer..."
                    searchPlaceholder="Search farmer name or phone..."
                    emptyText="No farmer found."
                    options={filteredFarmerUsers}
                    getKey={(u) => u.name || u.phone || ''}
                    getLabel={(u) => u.phone ? `${u.name} (${u.phone})` : u.name}
                    getSearchText={(u) => `${u.name || ''} ${u.phone || ''}`}
                    onSelect={(u) => setRegForm({ ...regForm, farmer_name: (u.name || '').toUpperCase() })}
                    searchValue={farmerUserSearch}
                    setSearchValue={setFarmerUserSearch}
                    triggerClassName="flex-1"
                  />
                  {regForm.farmer_name && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 hover:bg-red-50" onClick={() => setRegForm({ ...regForm, farmer_name: '' })}>
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Seller (Client)</Label>
                <div className="flex items-center gap-1.5">
                  <SearchableCombo
                    value={regForm.seller_name}
                    placeholder="Select seller..."
                    searchPlaceholder="Search client name or phone..."
                    emptyText="No client found."
                    options={filteredSellerUsers}
                    getKey={(u) => u.name || u.phone || ''}
                    getLabel={(u) => u.phone ? `${u.name} (${u.phone})` : u.name}
                    getSearchText={(u) => `${u.name || ''} ${u.phone || ''}`}
                    onSelect={(u) => setRegForm({ ...regForm, seller_name: (u.name || '').toUpperCase() })}
                    searchValue={sellerUserSearch}
                    setSearchValue={setSellerUserSearch}
                    triggerClassName="flex-1"
                  />
                  {regForm.seller_name && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 hover:bg-red-50" onClick={() => setRegForm({ ...regForm, seller_name: '' })}>
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Input placeholder="Optional notes..." value={regForm.notes}
                onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })} />
            </div>
          </div>

          {/* ── Section 5: Payment Linking ── */}
          {(
            <>
              <Separator />
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Banknote className="w-3.5 h-3.5" /> Link Payments
                </div>

                {/* Bank payments */}
                <div className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-blue-500" />
                      Bank / Cheque Plot Payments
                    </Label>
                    {linkedPlotPayments.length > 0 && (
                      <span className="text-[11px] font-medium text-blue-600">{linkedPlotPayments.length} linked · ₹{fmt(linkedPaymentsTotal)}</span>
                    )}
                  </div>
                  {/* Existing saved payments (edit mode) — with Unlink button */}
                  {editingRegistry && existingRegistryPayments.length > 0 && (
                    <div className="space-y-1 mb-1">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Saved payments</p>
                      {existingRegistryPayments.map((p) => (
                        <div key={`exist-${p.id}`} className="flex items-center justify-between text-[11px] rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-700">{fmtDate(p.payment_date)}</span>
                            <span className="font-semibold text-emerald-700">₹{fmt(p.amount)}</span>
                            {p.payment_mode && <span className="text-slate-400">{p.payment_mode}</span>}
                            {p.notes && <span className="text-slate-400 truncate max-w-30">{p.notes}</span>}
                          </div>
                          {canDelete && (
                            <Button
                              type="button" variant="ghost" size="sm"
                              className="h-6 px-2 text-[10px] font-medium text-red-500 hover:bg-red-100 hover:text-red-700"
                              onClick={async () => {
                                if (!window.confirm('Unlink this payment from the registry?')) return;
                                try {
                                  await api.delete(`/registries/payments/${p.id}`);
                                  setExistingRegistryPayments(prev => prev.filter(x => x.id !== p.id));
                                } catch (err) {
                                  setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to unlink payment' });
                                }
                              }}
                            >
                              <X className="w-3 h-3 mr-1" /> Unlink
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select value={recentPaymentSelect || '_none'} onValueChange={(v) => setRecentPaymentSelect(v === '_none' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder={regForm.plot_id ? (filteredRecentBankPayments.length > 0 ? 'Select payment to link' : 'No payments for this plot') : 'Select plot first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Select payment...</SelectItem>
                        {filteredRecentBankPayments.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} disabled={!!p.mapped_registry_payment_id || linkedPlotPayments.some((lp) => String(lp.id) === String(p.id))}>
                            {`${p.plot_no || '-'}  | ₹${fmt(p.amount)} | ${(p.payment_type || 'BANK').toUpperCase()}${p.payment_from && p.payment_from !== p.payment_type ? ` (${p.payment_from})` : ''} | ${p.narration || p.bank_details || '-'}${p.mapped_registry_payment_id ? ' ✓ Linked' : ''}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={addRecentBankPayment} className="h-8 text-xs" disabled={!regForm.plot_id || !recentPaymentSelect}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Link
                    </Button>
                  </div>
                  {linkedPlotPayments.length > 0 && (
                    <div className="space-y-1">
                      {linkedPlotPayments.map((p) => (
                        <div key={`lnk-${p.id}`} className="flex items-center justify-between text-[11px] rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <Check className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="text-slate-700">{p.plot_no || '-'} · {fmtDate(p.date)}</span>
                            <span className="font-semibold text-blue-700">₹{fmt(p.amount)}</span>
                            {p.payment_from && <span className="text-slate-400">{p.payment_from}</span>}
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-100" onClick={() => removeRecentBankPayment(p.id)}>
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual Payment Entry — reduces registry pending only; no effect on debit/credit elsewhere */}
                <div className="space-y-2 rounded-lg border border-amber-200 p-3 bg-amber-50/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-amber-600" />
                        Manual Payment Entry
                      </Label>
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">Registry-only · does not touch debit/credit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {inlinePayments.length > 0 && (
                        <span className="text-[11px] font-medium text-amber-700">{inlinePayments.filter(r => parseFloat(r.amount) > 0).length} pending · ₹{fmt(inlinePaymentsTotal)}</span>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={addInlinePaymentRow} className="h-7 text-[11px] gap-1 border-amber-300 text-amber-800 hover:bg-amber-100">
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Use this when money was received outside the system (handed over manually). It only reduces the registry's pending amount — it will not appear in Day Book, Plot Payments, or any cash/bank total.
                  </p>

                  {inlinePayments.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-1">No manual payments added. Click "Add" to enter one.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {inlinePayments.map((row, idx) => (
                        <div key={`inline-${idx}`} className="grid grid-cols-12 gap-1.5 items-start rounded-md border border-amber-200 bg-white px-2 py-1.5">
                          <div className="col-span-3">
                            <Input type="date" value={row.payment_date || ''}
                              onChange={(e) => updateInlinePaymentRow(idx, 'payment_date', e.target.value)}
                              className="h-7 text-[11px]" />
                          </div>
                          <div className="col-span-3">
                            <Input type="number" step="0.01" min="0" placeholder="Amount"
                              value={row.amount}
                              onChange={(e) => updateInlinePaymentRow(idx, 'amount', e.target.value)}
                              className="h-7 text-[11px] tabular-nums" />
                          </div>
                          <div className="col-span-2">
                            <Select value={row.payment_mode || 'BANK'}
                              onValueChange={(v) => updateInlinePaymentRow(idx, 'payment_mode', v)}>
                              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PAYMENT_MODE_OPTIONS.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Input placeholder="Notes (optional)"
                              value={row.notes || ''}
                              onChange={(e) => updateInlinePaymentRow(idx, 'notes', e.target.value)}
                              className="h-7 text-[11px]" />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button type="button" variant="ghost" size="sm"
                              className="h-7 w-7 p-0 hover:bg-red-100"
                              onClick={() => removeInlinePaymentRow(idx)}>
                              <X className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                          <BankAccountSelect
                            className="col-span-12"
                            value={row.bank_account_id}
                            onChange={(value) => updateInlinePaymentRow(idx, 'bank_account_id', value)}
                            paymentMode={row.payment_mode}
                            disabled={submitting}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Match Summary */}
                {hasAnyPayments && registryPaymentNum > 0 && (
                  <div className={`rounded-lg px-3 py-2.5 text-xs font-medium ${
                    paymentsMatchRegistry
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-amber-50 border border-amber-200 text-amber-700'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        {paymentsMatchRegistry ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span>
                          Linked: ₹{fmt(linkedPaymentsTotal)}
                          {' = '}
                          <span className="font-bold">₹{fmt(allPaymentsTotal)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Registry: ₹{fmt(registryPaymentNum)}</span>
                        {!paymentsMatchRegistry && (
                          <span className="text-[11px]">(Diff: ₹{fmt(Math.abs(allPaymentsTotal - registryPaymentNum))})</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Admin Assignment ── */}
          {canManage && approvers.length > 0 && (
            <>
              <Separator />
              <div className="px-6 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assign To Admin</Label>
                  <div className="flex items-center gap-1.5">
                    <Select value={regForm.assigned_admin_id?.toString() || '_none'} onValueChange={(v) => setRegForm({ ...regForm, assigned_admin_id: v === '_none' ? null : parseInt(v) })}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Select approver..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Auto-assign or none —</SelectItem>
                        {approvers.map((app) => (
                          <SelectItem key={app.id} value={app.id.toString()}>
                            {app.full_name || app.name || app.email || `Admin #${app.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {regForm.assigned_admin_id && (
                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 hover:bg-red-50" onClick={() => setRegForm({ ...regForm, assigned_admin_id: null })}>
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/40 flex items-center justify-between gap-2 flex-wrap">
            {registryPaymentNum > 0 && Math.abs(financeRemaining) >= 0.01 && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Remaining balance: ₹{fmt(Math.abs(financeRemaining))} — a warning will appear before saving
              </p>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={() => setRegistryDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={submitting || !canCreateRegistry}>
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingRegistry ? 'Updating...' : needsApproval ? 'Submitting...' : 'Creating...'}</>
                ) : (editingRegistry ? 'Update Registry' : needsApproval ? 'Submit for Admin Approval' : 'Create Registry')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  // ═══════════════════════════════════════════════════
  //  REGISTRY DETAIL VIEW (Payment History)
  // ═══════════════════════════════════════════════════
  if (selectedRegistry) {
    return (
      <>
      <div className="max-w-350 space-y-5">
        {/* ── Hero: identity + money story + NOC pipeline ── */}
        <Motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            {/* Identity + actions */}
            <div className="flex items-start justify-between flex-wrap gap-3 px-5 pt-4 pb-4">
              <div className="flex items-start gap-3 min-w-0">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedRegistry(null); setRegistryMeta(null); setPayments([]); setHandovers([]); setRegistryDocumentCount(null); setSearchQuery(''); navigate('/plot-registry'); }} className="h-8 w-8 p-0 mt-1">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Plot {r.plot_no}</h1>
                    {balance > 0.005 ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-slate-300 text-slate-600 uppercase tracking-wider">Payment Pending</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-900 text-white uppercase tracking-wider"><Check className="w-3 h-3" /> Fully Paid</span>
                    )}
                    {workflowUnlocked && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                        <ShieldCheck className="h-3 w-3" /> Workflow override
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-slate-700 mt-1 truncate">{r.customer_name || 'No customer name'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[
                      r.farmer_name && `Farmer ${r.farmer_name}`,
                      r.firm_name && `Firm ${r.firm_name}`,
                      r.registry_date && `Registered ${fmtDate(r.registry_date)}`,
                    ].filter(Boolean).join('  ·  ') || 'Registry record'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={printStatement} className="text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={downloadExcel} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1" /> Excel
                </Button>
                {canManage && canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditRegistry(r)} className="text-xs">
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                )}
                {canManage && canWrite && (
                  <Button size="sm" onClick={handleOpenCreatePayment}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add Payment
                  </Button>
                )}
              </div>
            </div>

            {/* The money story — one glance, four numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              {[
                { label: 'Registry Value', value: `₹${fmt(regPayment)}`, sub: r.bank_amount != null ? `Bank amount ₹${fmt(r.bank_amount)}` : null },
                { label: 'Received', value: `₹${fmt(totalPaid)}`, sub: `Cash ₹${fmt(paymentReceivedBreakdown.cash)} · Bank ₹${fmt(paymentReceivedBreakdown.bank)}` },
                { label: 'Balance', value: `₹${fmt(balance)}`, sub: balance > 0.005 ? 'still to collect' : 'settled in full', strong: balance > 0.005 },
                { label: 'Progress', value: `${pctPaid.toFixed(1)}%`, sub: `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded` },
              ].map(({ label, value, sub, strong }, i) => (
                <Motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className="px-5 py-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${strong ? 'text-slate-900 underline decoration-2 underline-offset-4' : 'text-slate-900'}`}>{value}</p>
                  {sub && <p className="mt-0.5 text-[11px] text-slate-400 truncate">{sub}</p>}
                </Motion.div>
              ))}
            </div>

            {/* Full-width progress line */}
            <div className="h-1.5 bg-slate-100">
              <Motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pctPaid, 100)}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 22 }}
                className="h-full bg-slate-900"
              />
            </div>

            {/* Registry pipeline: entry → NOC → approval → deed → handover */}
            <div className="flex items-center gap-3 flex-wrap px-5 py-3.5 bg-slate-50/60 border-t border-slate-100">
              <div className="flex items-center flex-1 min-w-[280px]">
                {workflowSteps.map((step, i, arr) => (
                  <div key={step.label} className={`flex items-center ${i < arr.length - 1 ? 'flex-1' : ''}`}>
                    <button
                      type="button"
                      disabled={!step.available || !step.action}
                      onClick={step.action || undefined}
                      title={step.available ? `Open ${step.label}` : `${step.label} is unavailable until the previous step is complete`}
                      className="group flex flex-col items-start rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                        step.done
                          ? 'border-blue-700 bg-blue-700'
                          : step.available
                            ? 'border-blue-300 bg-white group-hover:border-blue-600'
                            : 'border-slate-300 bg-slate-100'
                      }`}>
                        {step.done
                          ? <Check className="w-3 h-3 text-white" />
                          : !step.available
                            ? <LockKeyhole className="h-2.5 w-2.5 text-slate-400" />
                            : null}
                      </span>
                      <span className={`mt-1 text-[10px] font-semibold whitespace-nowrap ${step.done ? 'text-slate-800' : step.available ? 'text-blue-700' : 'text-slate-400'}`}>{step.label}</span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{step.date ? fmtDate(step.date) : '—'}</span>
                    </button>
                    {i < arr.length - 1 && (
                      <div className={`mx-3 mb-7 h-0.5 flex-1 rounded ${arr[i + 1].done ? 'bg-blue-700' : 'bg-slate-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/plot-registry/${r.id}/noc`)} className="text-xs ml-auto">
                <ScrollText className="w-3.5 h-3.5 mr-1" /> Open NOC
              </Button>
            </div>
          </CardContent>
        </Card>
        </Motion.div>

        <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
        {/* ── LEFT: transactions ── */}
        <div className="space-y-5 min-w-0">

        {/* Payments */}
        <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <Banknote className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Payments</h2>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{filteredPayments.length}</Badge>
              <div className="relative flex-1 min-w-40 max-w-64 ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input placeholder="Search mode, notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
              </div>
              {searchQuery && (
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="text-xs text-slate-500 h-8">
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>

        {/* Payments Table */}
        {loadingPayments ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-16">
            <Banknote className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{payments.length === 0 ? 'No payments recorded yet' : 'No payments match your search'}</p>
          </div>
        ) : (
              <div className="overflow-x-auto relative z-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                    <tr>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left">#</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32 sticky left-10 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                        <Button variant="ghost" size="sm" onClick={() => setSortOrderPayments(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                          Registry Date <ArrowUpDown className="w-3 h-3 ml-1" />
                        </Button>
                      </th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 px-3 py-2 text-left">Mode</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Cheque No</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Notes</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32 px-3 py-2">Registry Amount (₹)</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32 px-3 py-2">Cumulative (₹)</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 px-3 py-2 text-left">As Per Tally</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32 px-3 py-2">Tally Amt (₹)</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32 px-3 py-2 text-left">Assigned To</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 px-3 py-2 text-left">Created By</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let cumulative = 0;
                      return filteredPayments.map((pay, i) => {
                        cumulative += parseFloat(pay.amount) || 0;
                        return (
                          <tr key={pay.id} className="group border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                            <td className="sticky left-0 z-10 bg-white px-3 py-2"><span className="text-xs text-slate-400 tabular-nums">{i + 1}</span></td>
                            <td className="sticky left-10 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                              {pay.payment_date ? (
                                <span className="text-sm font-medium text-slate-700 tabular-nums">{fmtDate(pay.payment_date)}</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">TOKEN</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {pay.payment_mode ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                                  {pay.payment_mode === 'CASH' ? <Wallet className="w-2.5 h-2.5" /> : pay.payment_mode === 'CHEQUE' ? <ScrollText className="w-2.5 h-2.5" /> : <Landmark className="w-2.5 h-2.5" />}
                                  {pay.payment_mode}
                                </span>
                              ) : <span className="text-xs text-slate-400">—</span>}
                              <ChequeStatusControl
                                chequeStatus={pay.cheque_status}
                                source="plot_registry_payment"
                                entryId={pay.id}
                                isAdmin={isAdmin}
                                onStatusChange={() => fetchPayments(selectedRegistry.id)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs font-mono text-slate-600">{pay.cheque_no || '—'}</span>
                            </td>
                            <td className="px-3 py-2"><span className="text-xs text-slate-600">{pay.notes || '—'}</span></td>
                            <td className="text-right px-3 py-2">
                              <span className="text-sm font-semibold text-emerald-700 tabular-nums">+₹{fmt(pay.amount)}</span>
                            </td>
                            <td className="text-right px-3 py-2">
                              <span className="text-xs font-medium text-slate-600 tabular-nums">{fmt(cumulative)}</span>
                            </td>
                            <td className="px-3 py-2"><span className="text-xs text-amber-700 tabular-nums">{fmtDate(pay.tally_date)}</span></td>
                            <td className="text-right px-3 py-2">
                              <span className="text-xs font-medium text-amber-700 tabular-nums">{pay.tally_amount != null ? `₹${fmt(pay.tally_amount)}` : '—'}</span>
                            </td>
                            <td className="px-3 py-2">
                              {pay.assigned_admin_id ? (
                                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  {getAssignedAdminLabel(pay) || '—'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-300">Unassigned</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <UserAvatar name={pay.created_by_name} label="Created by" />
                            </td>
                            <td className="text-right px-3 py-2">
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" onClick={() => printPaymentReceipt(pay)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="Print Receipt">
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                                {canUpdate && (
                                  <Button variant="ghost" size="sm" onClick={() => setSignEntry(pay)}
                                    className={`h-7 w-7 p-0 ${pay.customer_signature_url ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-400 hover:text-blue-600'}`}
                                    title={pay.customer_signature_url ? 'Signed — capture again' : 'Capture Signature'}>
                                    <PenLine className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {(canUpdate || canDelete) && (
                                  <>
                                    {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleOpenEditPayment(pay)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>}
                                    {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(pay)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-30 bg-slate-100" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                    <tr className="border-t-2 border-slate-300">
                      <td className="sticky left-0 z-40 bg-slate-100 px-3 py-3 text-xs font-bold text-slate-900 uppercase" colSpan={1}></td>
                      <td className="sticky left-10 z-40 bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Total ({payments.length})</td>
                      <td className="px-3 py-3" colSpan={3}></td>
                      <td className="text-right px-3 py-3"><span className="text-sm font-bold text-emerald-700 tabular-nums">₹{fmt(totalPaid)}</span></td>
                      <td className="px-3 py-3" colSpan={3}></td>
                      <td className="px-3 py-3" colSpan={2}></td>
                      <td className="text-right px-3 py-3">
                        <span className="text-xs text-slate-400">Bal: <span className={`font-bold ${balance <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balance)}</span></span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
        )}
          </CardContent>
        </Card>
        </Motion.div>
        </div>

        {/* ── RIGHT: registry info + documents ── */}
        <div className="space-y-5 min-w-0 xl:sticky xl:top-4">
          <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="shadow-none border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <FileText className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Registry Details</h2>
              </div>
              <dl className="text-xs pb-1">
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">People</p>
                <div className="divide-y divide-slate-50">
                  <DetailRow label="Customer" value={r.customer_name} />
                  <DetailRow label="Farmer" value={r.farmer_name} />
                  <DetailRow label="Seller" value={r.seller_name} />
                  <DetailRow label="Firm" value={r.firm_name} />
                  <DetailRow label="Assigned To" value={getAssignedAdminLabel(r)} />
                </div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-100">Plot & Value</p>
                <div className="divide-y divide-slate-50">
                  <DetailRow label="Size (m²)" value={r.size_meter} />
                  <DetailRow label="Size (sq yd)" value={r.size_sqyard} />
                  {r.circle_rate != null && <DetailRow label="Circle Rate" value={`₹${fmt(r.circle_rate)}`} />}
                  <DetailRow label="Bank Amount" value={r.bank_amount != null ? `₹${fmt(r.bank_amount)}` : null} />
                </div>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-100">Dates & NOC</p>
                <div className="divide-y divide-slate-50">
                  <DetailRow label="Registry Date" value={fmtDate(r.registry_date)} />
                  <DetailRow label="Entry Date" value={fmtDate(r.created_entry_date)} />
                  <DetailRow label="NOC Generated" value={r.noc_generated_at ? fmtDate(r.noc_generated_at) : 'Not yet'} />
                  <DetailRow label="NOC Approved" value={r.noc_approved_at ? fmtDate(r.noc_approved_at) : 'Pending'} />
                </div>
                {r.notes && (
                  <div className="px-4 py-2.5 border-t border-slate-100">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</dt>
                    <dd className="text-slate-600 leading-relaxed">{r.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
          </Motion.div>

          <Motion.div id="registry-documents-section" className="scroll-mt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          {!r.noc_generated_at && !workflowUnlocked && (
            <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              <LockKeyhole className="w-3 h-3 shrink-0" />
              Generate the NOC before uploading the registry deed. An administrator can enable the workflow override in Settings when an exception is required.
            </p>
          )}
          {!r.noc_generated_at && workflowUnlocked && (
            <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              Workflow override is active. You can upload the registry deed before generating the NOC.
            </p>
          )}
          <RegistryDocuments
            plotId={
              r.plot_id ||
              autocomplete.plotOptions?.find(
                (p) => String(p.plot_no || '').trim().toUpperCase() === String(r.plot_no || '').trim().toUpperCase()
              )?.id || null
            }
            plotNo={r.plot_no}
            canWrite={canDocWrite}
            canDelete={canDocDelete}
            registryDeedAllowed={Boolean(r.noc_generated_at) || workflowUnlocked}
            onDocumentsChange={handleRegistryDocumentsChange}
          />
          </Motion.div>

          {/* ── Document handover timeline — offline handovers, receipt-style
              with a live proof photo ── */}
          <Motion.div id="registry-handovers-section" className="scroll-mt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <Card className="shadow-none border-slate-200 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <ClipboardList className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Document Handovers</h2>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{handovers.length}</Badge>
                {canWrite && (
                  <Button
                    size="sm" variant="outline" className="ml-auto h-7 text-xs"
                    disabled={!hasRegistryDoc && !workflowUnlocked}
                    title={hasRegistryDoc || workflowUnlocked ? 'Record a document handover' : 'Upload the registry deed first, or enable the workflow override in Settings'}
                    onClick={openHandoverDialog}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Mark Given
                  </Button>
                )}
              </div>
              {handovers.length === 0 ? (
                <p className="px-4 py-5 text-xs text-slate-400">
                  No handovers recorded yet. When the registry papers are given to the client, record the recipient and a proof photo here.
                </p>
              ) : (
                <ol className="px-4 py-3 text-xs">
                  {handovers.map((h, i) => (
                    <li key={h.id} className="relative pl-5 pb-4 last:pb-1">
                      {i < handovers.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />}
                      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-900" />
                      <p className="font-semibold text-slate-800">Given to {h.given_to}</p>
                      <p className="text-slate-400">{fmtDate(h.given_at)}{h.given_by_name ? ` · by ${h.given_by_name}` : ''}</p>
                      {h.notes && <p className="mt-0.5 text-slate-500">{h.notes}</p>}
                      {h.photo_url && (
                        <button type="button" onClick={() => openDoc({ url: h.photo_url, title: `Handover — ${h.given_to}`, subtitle: fmtDate(h.given_at) })} className="mt-1.5 block w-24 cursor-pointer overflow-hidden rounded-md border border-slate-200">
                          <img src={h.photo_url} alt={`Handover to ${h.given_to}`} className="h-16 w-24 object-cover" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          </Motion.div>

          {totalTally > 0 && (
            <Card className="shadow-none border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <ClipboardList className="w-3.5 h-3.5" /> As Per Tally
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-700">Tally Total</span>
                  <span className="font-bold text-amber-800 tabular-nums">₹{fmt(totalTally)}</span>
                </div>
                {totalTally !== totalPaid && (
                  <div className="flex items-center justify-between">
                    <span className="text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Difference</span>
                    <span className="font-bold text-red-600 tabular-nums">₹{fmt(Math.abs(totalPaid - totalTally))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        </div>

        {/* Payment Dialog */}
        <SignaturePad
          open={!!signEntry}
          onOpenChange={(o) => { if (!o) setSignEntry(null); }}
          onSave={async ({ customer, authority }) => {
            const entry = signEntry;
            const sigPatch = { customer_signature_url: customer };
            if (authority) sigPatch.authority_signature_url = authority;
            await api.put(`/signatures/registry_payment/${entry.id}`, sigPatch);
            setSignEntry(null);
            if (selectedRegistry?.id) refreshPayments(selectedRegistry.id);
            printPaymentReceipt({ ...entry, ...sigPatch });
          }}
          askAuthority={!nameSignOn()}
          signeeLabel={signEntry ? `Registry Payment #${signEntry.id} · ₹${parseFloat(signEntry.amount || 0).toLocaleString('en-IN')}` : ''}
        />

        {/* Handover dialog — receipt-style: capture a live photo of the moment */}
        <Dialog open={handoverDialogOpen} onOpenChange={(o) => { setHandoverDialogOpen(o); if (!o) setHandoverPhoto(null); }}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Record Document Handover</DialogTitle>
              <DialogDescription className="text-sm">
                Registry papers for Plot {r.plot_no} given offline to the client — click a photo as proof.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitHandover} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Given To *</Label>
                <Input
                  value={handoverForm.given_to}
                  onChange={(e) => setHandoverForm({ ...handoverForm, given_to: e.target.value.toUpperCase() })}
                  placeholder="Client name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea
                  rows={2}
                  value={handoverForm.notes}
                  onChange={(e) => setHandoverForm({ ...handoverForm, notes: e.target.value })}
                  placeholder="Original deed + 2 copies handed over..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Proof Photo</Label>
                <CameraCapture photo={handoverPhoto} onCapture={setHandoverPhoto} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setHandoverDialogOpen(false)} disabled={savingHandover}>Cancel</Button>
                <Button type="submit" size="sm" disabled={savingHandover || !handoverForm.given_to.trim()}>
                  {savingHandover ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</>
                  ) : 'Save Handover'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) resetPayForm(); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
              <DialogDescription className="text-sm">
                {editingPaymentId ? 'Update payment details.' : `Registry payment for Plot ${selectedRegistry.plot_no}`}
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

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Registry Date</Label>
                  <Input
                    type="date"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400">Leave empty for token/cash advance</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Registry Amount (₹) *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="20000"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    required className="font-semibold tabular-nums" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Mode</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_MODE_OPTIONS.map((m) => (
                    <button key={m} type="button"
                      onClick={() => setPayForm({ ...payForm, payment_mode: payForm.payment_mode === m ? '' : m })}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${
                        payForm.payment_mode === m
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>

              <BankAccountSelect
                value={payForm.bank_account_id}
                onChange={(value) => setPayForm((current) => ({ ...current, bank_account_id: value }))}
                paymentMode={payForm.payment_mode}
                disabled={submitting}
                required
              />

              {payForm.payment_mode === 'CHEQUE' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cheque No</Label>
                  <Input placeholder="Enter cheque number"
                    value={payForm.cheque_no || ''}
                    onChange={(e) => setPayForm({ ...payForm, cheque_no: e.target.value })}
                    className="h-9" />
                </div>
              )}

              <Separator />
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> As Per Tally
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tally Date</Label>
                  <Input
                    type="date"
                    value={payForm.tally_date}
                    onChange={(e) => setPayForm({ ...payForm, tally_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tally Amount (₹)</Label>
                  <Input type="number" step="0.01" placeholder="Same as amount or different"
                    value={payForm.tally_amount}
                    onChange={(e) => setPayForm({ ...payForm, tally_amount: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea placeholder="Optional notes..."
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value.toUpperCase() })}
                  rows={2} />
              </div>

              {canManage && approvers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assign To Admin</Label>
                  <Select value={payForm.assigned_admin_id?.toString() || '_none'} onValueChange={(v) => setPayForm({ ...payForm, assigned_admin_id: v === '_none' ? null : parseInt(v) })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Auto-assign or none —</SelectItem>
                      {approvers.map((app) => (
                        <SelectItem key={app.id} value={app.id.toString()}>
                          {app.full_name || app.name || app.email || `Admin #${app.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>Cancel</Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingPaymentId ? 'Updating...' : 'Recording...'}</>
                  ) : (editingPaymentId ? 'Update' : 'Record Payment')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {registryFormDialog}

        {/* Finance Warning Modal */}
        <Dialog open={financeWarningOpen} onOpenChange={setFinanceWarningOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" /> Finance Mismatch Warning
              </DialogTitle>
              <DialogDescription className="text-sm">
                The linked payments don't fully cover the Registry Payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm space-y-2">
                <div className="flex justify-between text-amber-800">
                  <span>Registry Payment</span>
                  <span className="font-bold">₹{fmt(registryPaymentNum)}</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>Linked Payments</span>
                  <span className="font-bold">₹{fmt(allPaymentsTotal)}</span>
                </div>
                <div className="border-t border-amber-200 pt-2 flex justify-between">
                  <span className="text-red-700 font-semibold">Remaining Balance</span>
                  <span className="font-bold text-red-700">₹{fmt(Math.abs(financeRemaining))}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                This remaining balance will appear in the{' '}
                <span className="font-semibold text-slate-700">Total Balance</span> ribbon on the registry list.
                You can add more payments later.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setFinanceWarningOpen(false)} disabled={submitting}>
                Go Back &amp; Fix
              </Button>
              <Button size="sm" onClick={executeRegistrySave} disabled={submitting}>
                {submitting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</>
                  : 'Save Anyway'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════
  //  REGISTRY LIST VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="max-w-350 space-y-3">
      {/* Header + Filters (redesigned) */}
      <div className="sticky -top-3 md:-top-6 z-30 bg-white border-b border-slate-200 -mx-3 md:-mx-6 -mt-3 md:-mt-6 px-3 md:px-6 pt-3 md:pt-6 pb-2.5">
        {/* Row 1 — title + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 text-white shadow-sm shadow-blue-200">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 leading-tight">{registryLabel}</h1>
                <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium tabular-nums">{filteredRegistries.length} registries</Badge>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Registry tracking for <span className="font-medium text-slate-700">{currentSite.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => navigate('/customer-inventory')} className="text-xs h-8 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50">
              <Landmark className="mr-1 h-3.5 w-3.5" /> Customer lifecycle
            </Button>
            {selectedVisibleRegs.length > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 pl-3 pr-1 py-0.5">
                <span className="text-[11px] font-semibold text-sky-700">{selectedVisibleRegs.length} selected</span>
                <button
                  onClick={() => setSelectedRegs(new Set())}
                  className="text-[11px] font-medium text-sky-600 px-1.5 py-0.5 rounded-full hover:bg-sky-100"
                >
                  Clear
                </button>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={printRegistryList} className="text-xs h-8 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50" disabled={filteredRegistries.length === 0}>
              <Printer className="w-3.5 h-3.5 mr-1" /> {selectedVisibleRegs.length > 0 ? `Print (${selectedVisibleRegs.length})` : 'Print'}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadAllRegistriesExcel} className="text-xs h-8 rounded-lg" disabled={filteredRegistries.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1" /> {selectedVisibleRegs.length > 0 ? `Excel (${selectedVisibleRegs.length})` : 'Excel'}
            </Button>
            {canWrite && (
              <Button size="sm" onClick={handleOpenCreateRegistry} className="h-8 rounded-lg">
                <Plus className="w-4 h-4 mr-1.5" /> Add Registry
              </Button>
            )}
          </div>
        </div>

        {/* Row 2 — filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          <div className="relative w-full sm:w-64 mr-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Search plot no, customer, farmer…"
              value={listSearch} onChange={(e) => setListSearch(e.target.value)}
              className="pl-8 h-7 text-xs rounded-full bg-slate-50/80 border-slate-200 focus-visible:bg-white" />
          </div>
          <Filter className="h-3.5 w-3.5 text-slate-300 hidden sm:block" />
          <MultiSelectFilter
            label="User" icon={User}
            options={uniqueUsers} selected={filterUser}
            onToggle={(u) => toggleSetFilter(setFilterUser, u)}
            onClear={() => setFilterUser(new Set())}
            open={filterUserOpen} onOpenChange={setFilterUserOpen}
            search={filterUserSearch} onSearchChange={setFilterUserSearch}
          />
          {uniqueAgents.length > 0 && (
            <MultiSelectFilter
              label="Agent" icon={UserPlus}
              options={uniqueAgents} selected={filterAgent}
              onToggle={(a) => toggleSetFilter(setFilterAgent, a)}
              onClear={() => setFilterAgent(new Set())}
              open={filterAgentOpen} onOpenChange={setFilterAgentOpen}
              search={filterAgentSearch} onSearchChange={setFilterAgentSearch}
            />
          )}
          <MultiSelectFilter
            label="Farmer" icon={User}
            options={uniqueFarmers} selected={filterFarmer}
            onToggle={(f) => toggleSetFilter(setFilterFarmer, f)}
            onClear={() => setFilterFarmer(new Set())}
            open={filterFarmerOpen} onOpenChange={setFilterFarmerOpen}
            search={filterFarmerSearch} onSearchChange={setFilterFarmerSearch}
          />
          <MultiSelectFilter
            label="Payments" icon={IndianRupee}
            options={['pending', 'paid', 'partial', 'other']} selected={filterPaymentStatus}
            onToggle={(s) => toggleSetFilter(setFilterPaymentStatus, s)}
            onClear={() => setFilterPaymentStatus(new Set())}
            open={filterPaymentStatusOpen} onOpenChange={setFilterPaymentStatusOpen}
            search={filterPaymentStatusSearch} onSearchChange={setFilterPaymentStatusSearch}
          />
          {uniqueRegTeams.length > 0 && (
            <MultiSelectFilter
              label="Team" icon={Users}
              options={uniqueRegTeams} selected={filterTeam}
              onToggle={(t) => toggleSetFilter(setFilterTeam, t)}
              onClear={() => setFilterTeam(new Set())}
              open={filterTeamOpen} onOpenChange={setFilterTeamOpen}
              search={filterTeamSearch} onSearchChange={setFilterTeamSearch}
            />
          )}
          {(listSearch || filterFarmer.size > 0 || filterPaymentStatus.size > 0 || filterTeam.size > 0 || filterUser.size > 0 || filterAgent.size > 0) && (
            <Button variant="ghost" size="sm" onClick={() => { setListSearch(''); setFilterFarmer(new Set()); setFilterPaymentStatus(new Set()); setFilterTeam(new Set()); setFilterUser(new Set()); setFilterAgent(new Set()); }} className="h-7 rounded-full px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      {filteredRegistries.length > 0 && (
        <Card className="shadow-none border-slate-200 bg-slate-50/60">
          <CardContent className="p-3">
            <div className="flex items-center gap-6 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Registries:</span>
                <span className="font-bold text-slate-700">{filteredRegistries.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-500">Total Registry:</span>
                <span className="font-bold text-blue-700">₹{fmt(filteredRegistries.reduce((s, r) => s + (parseFloat(r.registry_payment) || 0), 0))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-500">Total Paid:</span>
                <span className="font-bold text-emerald-700">₹{fmt(filteredRegistries.reduce((s, r) => s + (parseFloat(r.total_paid) || 0), 0))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-red-500" />
                <span className="text-slate-500">Total Balance:</span>
                <span className="font-bold text-red-600">₹{fmt(filteredRegistries.reduce((s, r) => s + ((parseFloat(r.registry_payment) || 0) - (parseFloat(r.total_paid) || 0)), 0))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registries Table */}
      {loadingList ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : filteredRegistries.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{registries.length === 0 ? 'No registries created yet' : 'No registries match your filters'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{registries.length === 0 ? 'Create a registry entry to start tracking' : 'Try different search criteria'}</p>
          {registries.length === 0 ? (
            canWrite && (
              <Button variant="outline" size="sm" onClick={handleOpenCreateRegistry} className="mt-3 h-8 rounded-lg text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Registry
              </Button>
            )
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setListSearch(''); setFilterFarmer(new Set()); setFilterPaymentStatus(new Set()); setFilterTeam(new Set()); setFilterUser(new Set()); setFilterAgent(new Set()); }} className="mt-3 h-8 rounded-lg text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50">
              <X className="w-3.5 h-3.5 mr-1" /> Clear filters
            </Button>
          )}
        </div>
      ) : (
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            {/* Row-colour legend: doc + payment health */}
            <div className="flex items-center gap-4 flex-wrap px-4 py-2 border-b border-slate-100 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-50 border border-red-200" /> Registry document not uploaded</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-50 border border-amber-200" /> Document uploaded · payment pending</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 border border-emerald-200" /> Document uploaded · fully paid</span>
            </div>
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 180px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    <TableHead className="w-8 sticky left-0 z-40 bg-slate-50">
                      <Checkbox
                        checked={allFilteredRegsSelected ? true : selectedVisibleRegs.length > 0 ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAllRegs}
                        aria-label="Select all filtered registries"
                        className="align-middle bg-white"
                      />
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-16 sticky left-8 z-40 bg-slate-50" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSortOrderRegistries(prev => prev === 'asc' ? 'desc' : 'asc')} className="h-6 px-1 -ml-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700" title="Sort by plot order">
                        Plot No <ArrowUpDown className="w-3 h-3 ml-1" />
                        <span className="text-[9px] ml-0.5">{sortOrderRegistries === 'asc' ? '▲' : '▼'}</span>
                      </Button>
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Customer Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project / Phase</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 text-right">Size (m²)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 text-right">Size (sqyd)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32">Registry Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Farmer Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32">Registry Amt (₹)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Paid (₹)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Balance (₹)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">% Paid</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32">Assigned To</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Lifecycle</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Possession</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistries.map((reg) => {
                    const rp = parseFloat(reg.registry_payment) || 0;
                    const tp = parseFloat(reg.total_paid) || 0;
                    const bl = rp - tp;
                    const pc = rp > 0 ? (tp / rp) * 100 : 0;
                    // Row health: red = registry document not uploaded;
                    // yellow = document uploaded but payment incomplete;
                    // green = document uploaded and fully paid.
                    const hasRegistryDoc = (parseInt(reg.registry_doc_count) || 0) > 0;
                    const isSelected = selectedRegs.has(reg.id);
                    const payStatus = getRegistryPaymentStatus(reg);
                    const rowTone = !hasRegistryDoc
                      ? 'bg-red-50/70 hover:bg-red-100/70'
                      : bl > 0.005
                        ? 'bg-amber-50/70 hover:bg-amber-100/70'
                        : 'bg-emerald-50/60 hover:bg-emerald-100/60';
                    // Opaque variant of the same tone for the frozen columns — they need a solid
                    // backing (to occlude scrolling content behind them), so the translucent rowTone
                    // won't do. group-hover mirrors the row's own hover: since "group" is on the <tr>.
                    const stickyTone = isSelected
                      ? 'bg-blue-50 group-hover:bg-blue-100'
                      : !hasRegistryDoc
                        ? 'bg-red-50 group-hover:bg-red-100'
                        : bl > 0.005
                          ? 'bg-amber-50 group-hover:bg-amber-100'
                          : 'bg-emerald-50 group-hover:bg-emerald-100';

                    return (
                      <TableRow
                        key={reg.id}
                        className={`group cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70 hover:bg-blue-100/70 ring-1 ring-inset ring-blue-300' : rowTone}`}
                        onClick={() => navigate(`/plot-registry/${reg.id}`)}
                      >
                        <TableCell className={`w-8 cursor-default sticky left-0 z-10 ${stickyTone}`} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedRegs.has(reg.id)}
                            onCheckedChange={() => toggleSelectReg(reg.id)}
                            aria-label={`Select plot ${reg.plot_no}`}
                            className="align-middle bg-white/80"
                          />
                        </TableCell>
                        <TableCell className={`sticky left-8 z-10 ${stickyTone}`} style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                          <span className="text-sm font-bold text-blue-700">{reg.plot_no}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-800">{reg.customer_name || '—'}</span>
                            <Badge variant="outline" className={`h-4 rounded-full px-1.5 text-[9px] font-semibold ${
                              payStatus === 'paid'
                                ? 'border-emerald-300 text-emerald-700'
                                : payStatus === 'partial'
                                  ? 'border-amber-300 text-amber-700'
                                  : 'border-slate-300 text-slate-500'
                            }`}>
                              {payStatus === 'paid' ? 'PAID' : payStatus === 'partial' ? 'PARTIAL' : 'PENDING'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-36 truncate text-xs font-medium text-slate-700">{reg.project_name || 'Legacy / unmapped'}</p>
                          <p className="max-w-36 truncate text-[10px] text-slate-400">{reg.phase_name || 'No phase'}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs text-slate-600 tabular-nums">{reg.size_meter || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs text-slate-600 tabular-nums">{reg.size_sqyard || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600 tabular-nums">{fmtDate(reg.registry_date)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-slate-700">{reg.farmer_name || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">₹{fmt(rp)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold text-emerald-700 tabular-nums">₹{fmt(tp)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold tabular-nums ${bl <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(bl)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pc >= 100 ? 'bg-emerald-500' : pc >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(pc, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-semibold tabular-nums ${pc >= 100 ? 'text-emerald-700' : pc >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {pc.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {reg.assigned_admin_id ? (
                            <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              {getAssignedAdminLabel(reg) || '—'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="h-5 whitespace-nowrap rounded-full px-2 text-[9px] font-semibold">
                            {String(reg.lifecycle_status || 'NOT_READY').replaceAll('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`h-5 whitespace-nowrap rounded-full px-2 text-[9px] font-semibold ${reg.possession_lifecycle_status === 'POSSESSED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                            {String(reg.possession_lifecycle_status || reg.possession_status || 'PENDING').replaceAll('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/plot-registry/${reg.id}`); }} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="View Payments">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/plot-registry/${reg.id}/noc`); }} className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-600" title="NOC Certificate">
                              <ScrollText className="w-3.5 h-3.5" />
                            </Button>
                            {(canUpdate || canDelete) && (
                              <>
                                {canUpdate && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEditRegistry(reg); }} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>}
                                {canDelete && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteRegistry(reg); }} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {/* Totals Footer — sticky at the bottom of the scroll container */}
                {filteredRegistries.length > 0 && (() => {
                  const totals = filteredRegistries.reduce((acc, reg) => {
                    const rp = parseFloat(reg.registry_payment) || 0;
                    const tp = parseFloat(reg.total_paid) || 0;
                    acc.sizeMeter += parseFloat(reg.size_meter) || 0;
                    acc.sizeSqyard += parseFloat(reg.size_sqyard) || 0;
                    acc.registryAmt += rp;
                    acc.paid += tp;
                    acc.balance += (rp - tp);
                    return acc;
                  }, { sizeMeter: 0, sizeSqyard: 0, registryAmt: 0, paid: 0, balance: 0 });
                  const pctPaid = totals.registryAmt > 0 ? (totals.paid / totals.registryAmt) * 100 : 0;
                  return (
                    <tfoot className="sticky bottom-0 z-30 bg-slate-100" style={{ boxShadow: '0 -1px 0 0 #cbd5e1' }}>
                      <tr className="border-t-2 border-slate-300 font-semibold">
                        <TableCell className="w-8 sticky left-0 z-40 bg-slate-100" />
                        <TableCell className="sticky left-8 z-40 bg-slate-100 whitespace-nowrap" style={{ boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)' }}>
                          <span className="text-xs font-bold text-slate-700 uppercase">Total ({filteredRegistries.length})</span>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(totals.sizeMeter)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(totals.sizeSqyard)}</span>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">₹{fmt(totals.registryAmt)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{fmt(totals.paid)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-bold tabular-nums ${totals.balance <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(totals.balance)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pctPaid >= 100 ? 'bg-emerald-500' : pctPaid >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(pctPaid, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-bold tabular-nums ${pctPaid >= 100 ? 'text-emerald-700' : pctPaid >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {pctPaid.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {registryFormDialog}

      {/* Finance Warning Modal */}
      <Dialog open={financeWarningOpen} onOpenChange={setFinanceWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-5 h-5" /> Finance Mismatch Warning
            </DialogTitle>
            <DialogDescription className="text-sm">
              The linked payments don't fully cover the Registry Payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm space-y-2">
              <div className="flex justify-between text-amber-800">
                <span>Registry Payment</span>
                <span className="font-bold">₹{fmt(registryPaymentNum)}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>Linked Payments</span>
                <span className="font-bold">₹{fmt(allPaymentsTotal)}</span>
              </div>
              <div className="border-t border-amber-200 pt-2 flex justify-between">
                <span className="text-red-700 font-semibold">Remaining Balance</span>
                <span className="font-bold text-red-700">₹{fmt(Math.abs(financeRemaining))}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              This remaining balance will appear in the{' '}
              <span className="font-semibold text-slate-700">Total Balance</span> ribbon on the registry list.
              You can add more payments later.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFinanceWarningOpen(false)} disabled={submitting}>
              Go Back &amp; Fix
            </Button>
            <Button size="sm" onClick={executeRegistrySave} disabled={submitting}>
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</>
                : 'Save Anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlotRegistry;
