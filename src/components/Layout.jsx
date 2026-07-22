import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import {
  LogOut, Settings, Home, Users, MapPin,
  Building2, UserCog, ChevronRight, ChevronDown, ChevronLeft, PanelLeftClose, PanelLeft,
  ChevronsUpDown, Tractor, Landmark, Wallet, Banknote, LayoutGrid, CreditCard, FileBox,
  ClipboardList, BookOpen, ShieldCheck, Shield, ListChecks,
  UserPlus, Tags, Sheet, FilePlus2, FolderOpen, FolderArchive, CalendarClock, MessageSquare, KeyRound,
  Plus, BarChart3, Search,
  Store, Menu, X, HardHat, Boxes,
  Bell, Clock, CheckCircle2, XCircle, FileEdit, Send, Inbox, ExternalLink, Loader2,
  LayoutDashboard,
  // Upgraded icons
  Sprout, HandCoins, Briefcase, Library, UsersRound, ShoppingBag, NotebookPen,
  Sparkles, SearchX, QrCode, FileSearch, CircleDollarSign, Crown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { MAC_APP_ICONS, DefaultAppIcon } from './macAppIcons';
import LanguageSwitcher from './LanguageSwitcher';
import { useDocViewer } from './DocViewer';

// ── Sidebar app icons — same hand-crafted squircles as the Home launcher ──
const PATH_APP_KEY = {
  '/dashboard': 'dashboard',
  '/farmers': 'farmers',
  '/daybook': 'daybook',
  '/cashflow': 'cashflow',
  '/firm-transactions': 'firm_transactions',
  '/imprest': 'imprest',
  '/document-imprest': 'document_imprest',
  '/chat': 'chat',
  '/clients': 'clients',
  '/vendors': 'vendors',
  '/plot-commission': 'plot_commission',
  '/receive-payments': 'upi_collect',
  '/expenses': 'expenses',
  '/plot-payments': 'plot_payments',
  '/plot-documents': 'plot_documents',
  '/payment-management': 'payment_management',
  '/payment-analytics': 'payment_analytics',
  '/plot-registry': 'plot_registry',
  '/plot-registry/documents': 'registry_documents',
  '/excel/files': 'excel',
  '/reports': 'reports',
  '/sites': 'sites',
  '/sub-admins': 'sub_admins',
  '/pending-approvals': 'pending_approvals',
  '/imprest-management': 'imprest_management',
  '/permissions': 'permissions',
  '/dashboard-management': 'dashboard_management',
};

const AppIcon = ({ path, fallback, className = 'w-6 h-6' }) => {
  const key = PATH_APP_KEY[(path || '').split('?')[0]];
  const Ico = key ? MAC_APP_ICONS[key] : null;
  const cls = `${className} rounded-[7px] shadow-sm shadow-slate-900/10 shrink-0`;
  return Ico ? <Ico className={cls} /> : <DefaultAppIcon icon={fallback} className={cls} />;
};

// ── Notification helpers ────────────────────────────────────────────
const NOTIF_APPROVAL_MODULE = {
  farmer_payment:     { label: 'Farmer Payment',  cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payment: { label: 'Plot Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Personal Ledger',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Bank Statement Reconciliation', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Plot Payment',     cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense:            { label: 'Expense',          cls: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer:     { label: 'Farmer Payment',   cls: 'bg-green-50 text-green-700 border-green-200' },
  daybook_commission: { label: 'Plot Commission',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  daybook_expense:    { label: 'Expense',          cls: 'bg-red-50 text-red-700 border-red-200' },
  imprest:            { label: 'Imprest Request',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const NOTIF_APPROVAL_GROUPS = {
  farmer_payment: 'farmer_payment', daybook_farmer: 'farmer_payment',
  plot_commission: 'plot_commission', plot_commission_payment: 'plot_commission', daybook_commission: 'plot_commission',
  expense: 'expense', daybook_expense: 'expense',
};

const getNotifApprovalGroup = (source) => NOTIF_APPROVAL_GROUPS[source] || source;
const getNotifLedger = (entry) => {
  const debit = Math.abs(Number(entry.debit) || 0);
  const credit = Math.abs(Number(entry.credit) || 0);
  if (debit || credit) return { debit, credit };
  const amount = Math.abs(Number(entry.amount) || 0);
  return getNotifApprovalGroup(entry.source) === 'plot_payment'
    ? { debit: 0, credit: amount }
    : { debit: amount, credit: 0 };
};

const getNotifRequestDetails = (entry) => {
  const source = getNotifApprovalGroup(entry.source);
  const module = NOTIF_APPROVAL_MODULE[source] || NOTIF_APPROVAL_MODULE[entry.source] || { label: 'Approval', cls: 'bg-slate-50 text-slate-700 border-slate-200' };
  const entityName = entry.entity_name || entry.farmer_name || entry.agent_name || entry.linked_user_name
    || entry.buyer_name || entry.to_entity || entry.from_entity || entry.to_name || entry.name
    || entry.firm_name || entry.ledger_name || entry.payment_from || entry.created_by_name || 'Recorded entity unavailable';
  const entityType = entry.entity_type
    || (entry.farmer_name ? 'Farmer / land owner' : null)
    || (entry.agent_name ? 'Commission agent' : null)
    || (entry.linked_user_name ? 'Mapped ledger user' : null)
    || (entry.buyer_name ? 'Plot buyer / payer' : null)
    || (entry.firm_name ? 'Firm / account' : null)
    || (entry.ledger_name ? 'Personal ledger' : null)
    || 'Recorded party';
  const plotNo = entry.entity_plot_no || entry.plot_no;
  const entityDetails = [
    plotNo ? `Plot ${plotNo}` : null,
    entry.entity_secondary && entry.entity_secondary !== entityName ? entry.entity_secondary : null,
    entry.buyer_name && entry.buyer_name !== entityName ? `Buyer: ${entry.buyer_name}` : null,
    entry.firm_name && entry.firm_name !== entityName ? `Firm: ${entry.firm_name}` : null,
    entry.ledger_name && entry.ledger_name !== entityName ? `Ledger: ${entry.ledger_name}` : null,
    entry.payment_from && entry.payment_from !== entityName ? `From: ${entry.payment_from}` : null,
    entry.entity_phone ? `Phone: ${entry.entity_phone}` : null,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  return {
    module,
    entityName,
    entityType,
    entityDetails,
    purpose: entry.particular || entry.description || entry.reason || entry.remarks || entry.remark || entry.entry_label || '—',
  };
};

const NOTIF_EDIT_MODULE_LABELS = {
  farmer: 'Farmer', farmer_payment: 'Farmer Payment', plot: 'Plot',
  plot_payment: 'Plot Payment', daybook: 'Day Book',
  daybook_expense: 'Expense', daybook_farmer_payment: 'Farmer Payment',
  daybook_commission: 'Commission', daybook_cashflow: 'Personal Ledger',
  daybook_firm_transaction: 'Bank Statement Reconciliation', daybook_plot_payment: 'Plot Payment',
};

const NOTIF_STATUS_BADGE = {
  pending:  { label: 'Pending',  icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200' },
};

const notifFmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const notifFmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ── Polished brand logo ─────────────────────────────────────────────
const BrandLogo = ({ compact = false }) => (
  <div className="flex items-center gap-2.5 pl-1 min-w-0">
    <div className="relative w-9 h-9 rounded-xl bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center shadow-sm shadow-blue-500/25 ring-1 ring-inset ring-white/25 shrink-0">
      <Building2 className="w-4 h-4 text-white drop-shadow-sm" />
      <Sparkles className="w-2 h-2 text-white/80 absolute top-1 right-1" />
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-t from-transparent to-white/15" />
    </div>
    {!compact && (
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[13px] font-semibold text-slate-900 tracking-tight truncate">Mount Reality</span>
        <span className="text-[9px] font-medium text-slate-400 tracking-[0.14em] uppercase truncate">Management Suite</span>
      </div>
    )}
  </div>
);

// ── Site selector — small gradient initial avatar per site, used by both
// the mobile drawer and the desktop sidebar (previously duplicated as a
// plain text-only <Select>, now a single shared, richer implementation). ──
const SITE_AVATAR_GRADIENTS = [
  'from-blue-700 via-blue-600 to-cyan-500',
  'from-emerald-600 via-emerald-500 to-teal-500',
  'from-amber-600 via-amber-500 to-orange-500',
  'from-blue-800 via-blue-600 to-sky-500',
  'from-sky-600 via-sky-500 to-cyan-500',
];
const siteAvatarGradient = (id) => SITE_AVATAR_GRADIENTS[id % SITE_AVATAR_GRADIENTS.length];

const SiteSelect = ({ sites, currentSite, onChange, isAdmin }) => (
  <Select value={currentSite ? String(currentSite.id) : ''} onValueChange={onChange}>
    <SelectTrigger className="w-full h-10 text-xs bg-slate-50 border-slate-200 text-slate-700 focus:ring-1 focus:ring-slate-300">
      <div className="flex items-center gap-2 truncate">
        {currentSite ? (
          <div className={`w-5 h-5 rounded-md bg-linear-to-br ${siteAvatarGradient(currentSite.id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm`}>
            {currentSite.name?.charAt(0)?.toUpperCase() || 'S'}
          </div>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        )}
        <SelectValue placeholder="Select site">{currentSite?.name}</SelectValue>
      </div>
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel className="text-[10px] uppercase tracking-wide text-slate-400">Your Sites</SelectLabel>
        {sites.map((site) => (
          <SelectItem key={site.id} value={String(site.id)} className="text-xs">
            <span className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-md bg-linear-to-br ${siteAvatarGradient(site.id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm`}>
                {site.name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-medium text-slate-700">{site.name}</span>
                {site.city && <span className="text-[10px] text-slate-400">{site.city}</span>}
              </span>
            </span>
          </SelectItem>
        ))}
        {isAdmin && (
          <>
            <SelectSeparator />
            <SelectItem value="__add_site__" className="text-xs text-slate-700">
              <span className="inline-flex items-center gap-2">
                <span className="w-5 h-5 rounded-md border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-slate-500" />
                </span>
                Add Site
              </span>
            </SelectItem>
          </>
        )}
      </SelectGroup>
    </SelectContent>
  </Select>
);

// ── Stable, memoized primary nav link (prevents remount on every keystroke) ──
const NavLinkButton = memo(function NavLinkButton({ item, collapsed, isActive, onNavigate }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive
        ? 'bg-blue-50/80 text-blue-700 shadow-sm shadow-blue-100/60'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-linear-to-b from-blue-500 to-cyan-400" />
      )}
      <span className="shrink-0 transition-transform duration-150 group-hover:scale-[1.07]">
        <AppIcon path={item.path} fallback={Icon} />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
});

// ── Animated tree / branch group for collapsible sub-items ──────────
// Renders a vertical guide line that spans only first→last item centers,
// with an animated indigo highlight that slides to the active child and
// L-shaped branch connectors that stop cleanly inside the item row.
const TreeGroup = memo(function TreeGroup({ items, getIconTone }) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  // [topPx, bottomPx, highlightPx] — top/bottom clip the base guide so it
  // does not overshoot below the last item; highlight tracks the active row.
  const [bounds, setBounds] = useState({ top: 0, bottom: 0, highlight: 0 });

  const activeIdx = items.findIndex((it) => {
    const p = (it.path || '').split('?')[0];
    return location.pathname === p && !(it.path || '').includes('?');
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rows = containerRef.current.querySelectorAll('[data-tree-item]');
      if (!rows.length) { setBounds({ top: 0, bottom: 0, highlight: 0 }); return; }
      const parentRect = containerRef.current.getBoundingClientRect();
      const firstRect = rows[0].getBoundingClientRect();
      const lastRect = rows[rows.length - 1].getBoundingClientRect();
      const top = firstRect.top - parentRect.top + firstRect.height / 2;
      const bottom = lastRect.top - parentRect.top + lastRect.height / 2;
      let highlight = 0;
      if (activeIdx >= 0 && rows[activeIdx]) {
        const rect = rows[activeIdx].getBoundingClientRect();
        highlight = rect.top - parentRect.top + rect.height / 2 - top;
      }
      setBounds({ top, bottom, highlight: Math.max(0, highlight) });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIdx, items.length]);

  const guideHeight = Math.max(0, bounds.bottom - bounds.top);

  return (
    <div ref={containerRef} className="relative ml-4.5 pl-4 py-0.5">
      {/* Base vertical guide — clipped to first→last item centers */}
      <span
        className="pointer-events-none absolute left-0 w-px bg-slate-200/80 rounded-full"
        style={{ top: `${bounds.top}px`, height: `${guideHeight}px` }}
      />
      {/* Animated highlight segment */}
      <span
        className="pointer-events-none absolute left-0 w-0.5 bg-linear-to-b from-blue-500 via-blue-600 to-cyan-400 rounded-full transition-[height] duration-300 ease-out will-change-[height]"
        style={{
          top: `${bounds.top}px`,
          height: `${bounds.highlight}px`,
          opacity: bounds.highlight > 0 ? 1 : 0,
        }}
      />
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const pathOnly = (item.path || '').split('?')[0];
          const isActive = location.pathname === pathOnly && !(item.path || '').includes('?');
          const iconTone = getIconTone ? getIconTone(pathOnly) : 'bg-slate-100 text-slate-500';
          return (
            <button
              key={item.path}
              data-tree-item
              onClick={() => navigate(item.path)}
              className={`group relative w-full flex items-center gap-2.5 pr-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {/* L-shaped branch connector — runs from guide line to icon edge */}
              <span
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-px transition-colors duration-200 -left-4 ${
                  isActive
                    ? 'bg-linear-to-r from-blue-500 to-blue-300 w-4'
                    : 'bg-slate-200 w-3'
                }`}
              />
              {/* Active dot — centered on the guide line (line is at button-left:-16px) */}
              {isActive && (
                <span className="pointer-events-none absolute -left-4 -translate-x-1/2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white shadow-sm shadow-blue-500/40" />
              )}
              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                isActive ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' : iconTone
              }`}>
                <Icon className="w-3 h-3" />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteTransition, setSiteTransition] = useState(false);
  const [search, setSearch] = useState('');
  const prevSiteRef = useRef(null);
  const { user, logout, sites, currentSite, setCurrentSite, isAdmin, hasPermission } = useAuth();
  const openDoc = useDocViewer();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Brief fade transition when site changes
  useEffect(() => {
    if (prevSiteRef.current && currentSite && prevSiteRef.current !== currentSite.id) {
      setSiteTransition(true);
      const timer = setTimeout(() => setSiteTransition(false), 150);
      return () => clearTimeout(timer);
    }
    prevSiteRef.current = currentSite?.id ?? null;
  }, [currentSite]);

  // Plot Commission collapsible state
  const commissionPaths = ['/commissions', '/plot-commission', '/plot-commission/search'];
  const isCommissionActive = commissionPaths.some(p => location.pathname.startsWith(p));
  const [commissionOpen, setCommissionOpen] = useState(isCommissionActive);

  // Receive Payment collapsible state
  const receivePayPaths = ['/receive-payments', '/bank-configs'];
  const isReceivePayActive = receivePayPaths.some(p => location.pathname.startsWith(p));
  const [receivePayOpen, setReceivePayOpen] = useState(isReceivePayActive);

  // User Management collapsible state
  const userMgmtPaths = ['/clients', '/register-user', '/user-categories'];
  const isUserMgmtActive = userMgmtPaths.some(p => location.pathname.startsWith(p));
  const [userMgmtOpen, setUserMgmtOpen] = useState(isUserMgmtActive);

  // Vendor Management collapsible state
  const vendorPaths = ['/vendors'];
  const isVendorActive = vendorPaths.some(p => location.pathname.startsWith(p));
  const [vendorOpen, setVendorOpen] = useState(isVendorActive);

  // Expenses collapsible state
  const expensePaths = ['/expenses', '/expense-categories', '/expense-approvals'];
  const isExpenseActive = expensePaths.some(p => location.pathname.startsWith(p));
  const [expenseOpen, setExpenseOpen] = useState(isExpenseActive);

  // Plot Payments collapsible state
  const plotPayPaths = ['/plot-payments', '/plot-documents', '/payment-management', '/payment-analytics'];
  const isPlotPayActive = plotPayPaths.some(p => location.pathname.startsWith(p));
  const [plotPayOpen, setPlotPayOpen] = useState(isPlotPayActive);

  // Day Book collapsible state
  const dayBookPaths = ['/daybook', '/daybook/cash', '/daybook/bank'];
  const isDayBookActive = dayBookPaths.some(p => location.pathname.startsWith(p));
  const [dayBookOpen, setDayBookOpen] = useState(isDayBookActive);

  // Balance Sheet collapsible state
  const balanceSheetPaths = ['/balance-sheet', '/balance-sheet/cash', '/balance-sheet/bank'];
  const isBalanceSheetActive = balanceSheetPaths.some(p => location.pathname === p);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(isBalanceSheetActive);

  // Plot Registry collapsible state
  const registryPaths = ['/plot-registry', '/documents'];
  const isRegistryActive = registryPaths.some(p => location.pathname.startsWith(p));
  const [registryOpen, setRegistryOpen] = useState(isRegistryActive);

  // Native Excel collapsible state
  const excelPaths = ['/excel'];
  const isExcelActive = excelPaths.some(p => location.pathname.startsWith(p));
  const [excelOpen, setExcelOpen] = useState(isExcelActive);

  useEffect(() => {
    if (isCommissionActive) setCommissionOpen(true);
  }, [isCommissionActive]);

  useEffect(() => {
    if (isUserMgmtActive) setUserMgmtOpen(true);
  }, [isUserMgmtActive]);

  useEffect(() => {
    if (isVendorActive) setVendorOpen(true);
  }, [isVendorActive]);

  useEffect(() => {
    if (isExpenseActive) setExpenseOpen(true);
  }, [isExpenseActive]);

  useEffect(() => {
    if (isPlotPayActive) setPlotPayOpen(true);
  }, [isPlotPayActive]);

  useEffect(() => {
    if (isDayBookActive) setDayBookOpen(true);
  }, [isDayBookActive]);

  useEffect(() => {
    if (isBalanceSheetActive) setBalanceSheetOpen(true);
  }, [isBalanceSheetActive]);

  useEffect(() => {
    if (isExcelActive) setExcelOpen(true);
  }, [isExcelActive]);

  useEffect(() => {
    if (isReceivePayActive) setReceivePayOpen(true);
  }, [isReceivePayActive]);

  useEffect(() => {
    if (isRegistryActive) setRegistryOpen(true);
  }, [isRegistryActive]);

  // Navigation items (User Management handled separately as collapsible)
  const navItems = useMemo(() => {
    return [
      { path: '/home', label: 'Home', icon: LayoutGrid, module: 'dashboard' },
      { path: '/dashboard', label: 'Dashboard', icon: Home, module: 'dashboard' },
      { path: '/farmers', label: 'Farmer Payments', icon: Sprout, module: 'farmers' },
      // Plot Commission is now a collapsible group — handled separately
      { path: '/daybook', label: 'Day Book', icon: BookOpen, module: 'daybook' },
      { path: '/cashflow', label: 'Personal Ledgers', icon: NotebookPen, module: 'cashflow' },
      { path: '/firm-transactions', label: 'Bank Statement Reconciliation', icon: Briefcase, module: 'firm_transactions' },
      // Plot Payments is now a collapsible group — handled separately
      // Expenses is now a collapsible group — handled separately
      { path: '/imprest', label: 'Imprest', icon: Wallet, module: 'imprest' },
      { path: '/document-imprest', label: 'Document Handling ', icon: FileBox, module: 'document_imprest' },
      { path: '/construction', label: 'Construction', icon: HardHat, module: 'construction' },
      { path: '/inventory', label: 'Inventory', icon: Boxes, module: 'inventory' },
      { path: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
    ].filter(item => hasPermission(item.module, 'read'));
  }, [hasPermission]);

  const adminNavItems = [
    { path: '/subscription', label: 'Subscription', icon: Crown },
    { path: '/sites', label: 'Sites', icon: MapPin },
    { path: '/sub-admins', label: 'Admin Management', icon: UserCog },
    { path: '/user-id-management', label: 'User ID Management', icon: KeyRound },
    { path: '/pending-approvals', label: 'Approvals', icon: CheckCircle2 },
    { path: '/approval-manager', label: 'Approval Manager', icon: ShieldCheck },
    { path: '/edit-approvals', label: 'Edit Approvals', icon: ShieldCheck },
    { path: '/imprest-management', label: 'Imprest Management', icon: Banknote },
    { path: '/permissions', label: 'Permissions', icon: Shield },
    { path: '/dashboard-management', label: 'Dashboard Management', icon: LayoutDashboard },
  ];

  // Expense Approvals child items (within Expenses group, visible to those with permission)
  const expenseChildren = [
    { path: '/expenses', label: 'All Expenses', icon: CreditCard },
    { path: '/expense-categories', label: 'Expense Categories', icon: Tags },
    ...(isAdmin || hasPermission('expense_approval', 'read') ? [{ path: '/expense-approvals', label: 'Expense Approvals', icon: ListChecks }] : []),
  ];

  // User Management child items
  const userMgmtChildren = [
    { path: '/clients', label: 'All Members', icon: UsersRound },
   
    ...(isAdmin ? [{ path: '/user-categories', label: 'User Categories', icon: Tags }] : []),
  ];

  // Vendor Management child items
  const vendorChildren = [
    { path: '/vendors', label: 'Commitments', icon: ShoppingBag },
    // Inventory lives in its own top-level module now (/inventory, Procurement tab).
    { path: '/vendors/categories', label: 'Categories', icon: Tags },
  ];

  // Plot Commission child items
  const commissionChildren = [
    { path: '/plot-commission', label: 'All Commissions', icon: HandCoins },
    
  ];

  // Receive Payment child items
  const receivePayChildren = [
    { path: '/receive-payments', label: 'Receive Money', icon: QrCode },
    { path: '/bank-configs', label: 'Bank Configs', icon: KeyRound },
  ];

  // Plot Payments child items
  const plotPayChildren = [
    { path: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid },
    { path: '/plot-documents', label: 'Plot Documents', icon: FolderArchive },
    { path: '/payment-management', label: 'Payment Tracker', icon: CalendarClock },
    { path: '/payment-analytics', label: 'Payment Analytics', icon: BarChart3 },
  ];

  // Plot Registry child items
  const canReadPlotRegistry = hasPermission('plot_registry', 'read');
  const canReadDocumentSearch = hasPermission('document_search', 'read');
  const registryChildren = useMemo(() => [
    ...(canReadPlotRegistry ? [
      { path: '/plot-registry', label: 'Registry List', icon: Library },
      { path: '/plot-registry/documents', label: 'Registry Documents', icon: FolderOpen },
    ] : []),
    ...(canReadDocumentSearch ? [
      { path: '/documents', label: 'Document Search', icon: FileSearch },
    ] : []),
  ], [canReadPlotRegistry, canReadDocumentSearch]);
  const canReadRegistryGroup = registryChildren.length > 0;

  // Day Book child items
  const dayBookChildren = [
    { path: '/daybook', label: 'Main Day Book', icon: BookOpen },
    { path: '/daybook/cash', label: 'Cash Day Book', icon: Wallet },
    { path: '/daybook/bank', label: 'Bank Day Book', icon: Banknote },
  ];

  // Consolidated financial position (all sources except Imprest)
  const balanceSheetChildren = [
    { path: '/balance-sheet', label: 'Main Balance Sheet', icon: CircleDollarSign },
    { path: '/balance-sheet/bank', label: 'Bank Balance Sheet', icon: Landmark },
    { path: '/balance-sheet/cash', label: 'Cash Balance Sheet', icon: Wallet },
  ];

  // Native Excel child items
  const excelChildren = [
    { path: '/excel/new', label: 'New Spreadsheet', icon: FilePlus2 },
    { path: '/excel/files', label: 'All Documents', icon: FolderOpen },
  ];

  const canReadExcel = hasPermission('excel', 'read');
  const canReadChat = hasPermission('chat', 'read');
  const canReadSettings = hasPermission('settings', 'read');

  // ── Notifications / Approvals ─────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState(isAdmin ? 'received' : 'sent');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifReceived, setNotifReceived] = useState([]);
  const [notifSent, setNotifSent] = useState([]);
  const [notifAppCounts, setNotifAppCounts] = useState({ total: 0 });
  const [notifTotals, setNotifTotals] = useState({ debit: 0, credit: 0 }); // pending-approval money totals
  const [notifEditCounts, setNotifEditCounts] = useState({ pending: 0 });
  const [notifActionId, setNotifActionId] = useState(null); // id being approved/rejected

  // Map remapped daybook sources back to 'daybook' for the API
  const getApiSource = (source) => {
    if (!source) return source;
    if (source.startsWith('daybook_') || source === 'daybook') return 'daybook';
    return source;
  };

  const handleNotifApprove = async (entry) => {
    const key = `${entry.source || entry._type}-${entry.id}`;
    setNotifActionId(key);
    try {
      if (entry._type === 'imprest') {
        await api.put(`/imprest/expense-requests/${entry.id}/approve`);
      } else {
        await api.put(`/approvals/${entry.id}/approve?source=${getApiSource(entry.source)}`);
      }
      eventBus.emit('data-mutated');
      await fetchNotifApprovals();
    } catch (err) {
      console.error('Approve failed', err);
    } finally {
      setNotifActionId(null);
    }
  };

  const handleNotifReject = async (entry) => {
    const key = `${entry.source || entry._type}-${entry.id}`;
    setNotifActionId(key);
    try {
      if (entry._type === 'imprest') {
        await api.put(`/imprest/expense-requests/${entry.id}/reject`, { review_remark: '' });
      } else {
        await api.put(`/approvals/${entry.id}/reject?source=${getApiSource(entry.source)}`);
      }
      eventBus.emit('data-mutated');
      await fetchNotifApprovals();
    } catch (err) {
      console.error('Reject failed', err);
    } finally {
      setNotifActionId(null);
    }
  };

  const fetchNotifApprovals = useCallback(async () => {
    if (!currentSite?.id) return;
    setNotifLoading(true);
    try {
      if (isAdmin) {
        const [pendingRes, countsRes, editRes, editCountsRes, imprestRes] = await Promise.allSettled([
          api.get(`/approvals/pending?site_id=${currentSite.id}`),
          api.get(`/approvals/counts?site_id=${currentSite.id}`),
          api.get(`/edit-requests/my-requests?site_id=${currentSite.id}`),
          api.get(`/edit-requests/counts?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);
        const siteId = currentSite.id;

        // Regular approvals (daybook, expenses, etc.)
        const allPendingEntries = pendingRes.status === 'fulfilled'
          ? (pendingRes.value.data.entries || [])
          : [];
        const regularApprovals = allPendingEntries.slice(0, 20);

        // Pending imprest requests from sub-admins → Received tab
        const pendingImprests = imprestRes.status === 'fulfilled'
          ? (imprestRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId) && (r.status || '').toUpperCase() === 'PENDING')
              .map(r => ({
                id: r.id,
                source: 'imprest',
                _type: 'imprest',
                entry_label: `Imprest Request — ₹${Number(r.amount).toLocaleString('en-IN')}${r.reason ? ': ' + r.reason : ''}`,
                date: r.created_at,
                created_by_name: r.sub_admin_name || null,
                amount: r.amount,
                debit: r.amount,
                payment_mode: r.payment_mode || 'BANK',
                voucher_url: r.voucher_url || null,
                entity_name: r.sub_admin_name || r.created_by_name || null,
                entity_type: 'Imprest requester',
                entity_secondary: r.reason || null,
                remarks: r.reason || null,
              }))
          : [];

        const allReceived = [...regularApprovals, ...pendingImprests]
          .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
          .slice(0, 30);
        setNotifReceived(allReceived);

        // Money totals across ALL pending approvals (not just the 30 shown);
        // imprest requests are outgoing money, so they count as debit.
        setNotifTotals({
          debit: allPendingEntries.reduce((n, e) => n + (parseFloat(e.debit) || 0), 0)
            + pendingImprests.reduce((n, r) => n + (parseFloat(r.amount) || 0), 0),
          credit: allPendingEntries.reduce((n, e) => n + (parseFloat(e.credit) || 0), 0),
        });

        if (countsRes.status === 'fulfilled') {
          setNotifAppCounts(countsRes.value.data || { total: 0 });
        }

        // Admin's Sent tab = their own edit requests only
        const edits = editRes.status === 'fulfilled'
          ? (editRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'edit' }))
          : [];
        setNotifSent(edits);

        const ec = editCountsRes.status === 'fulfilled'
          ? (editCountsRes.value.data || { pending: 0 })
          : { pending: 0 };
        setNotifEditCounts(ec);

      } else {
        const [editRes, imprestReqRes, allocRes, assignedRes] = await Promise.allSettled([
          api.get(`/edit-requests/my-requests?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
          api.get(`/imprest/pending-receipts?site_id=${currentSite.id}`),
          // Pending approvals explicitly delegated to this sub-admin for the current site.
          api.get(`/approvals/pending?site_id=${currentSite.id}&assigned_admin_id=${user.id}`),
        ]);
        const siteId = currentSite.id;

        const edits = editRes.status === 'fulfilled'
          ? (editRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'edit' }))
          : [];

        const imprests = imprestReqRes.status === 'fulfilled'
          ? (imprestReqRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'imprest', status: (r.status || '').toLowerCase() }))
          : [];

        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20);
        setNotifSent(merged);

        // Sub-admin Received = imprest allocations pending confirmation + approvals delegated to me.
        const allocs = allocRes.status === 'fulfilled'
          ? (allocRes.value.data.allocations || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'allocation' }))
          : [];

        const allAssignedEntries = assignedRes.status === 'fulfilled'
          ? (assignedRes.value.data.entries || [])
          : [];
        const assignedApprovals = allAssignedEntries.slice(0, 30);
        setNotifTotals({
          debit: allAssignedEntries.reduce((n, e) => n + (parseFloat(e.debit) || 0), 0),
          credit: allAssignedEntries.reduce((n, e) => n + (parseFloat(e.credit) || 0), 0),
        });

        const received = [...assignedApprovals, ...allocs]
          .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
          .slice(0, 40);
        setNotifReceived(received);

        const impPending = imprests.filter(r => r.status === 'pending').length;
        const editPending = edits.filter(r => r.status === 'pending').length;
        setNotifEditCounts({ pending: editPending + impPending + assignedApprovals.length });
      }
    } catch (err) {
      console.error('fetchNotifApprovals failed:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [currentSite?.id, isAdmin, user?.id]);

  useEffect(() => {
    if (currentSite?.id) fetchNotifApprovals();
  }, [currentSite?.id, fetchNotifApprovals]);

  useEffect(() => {
    if (!currentSite?.id) return;
    const refresh = () => fetchNotifApprovals();
    eventBus.on('data-mutated', refresh);
    return () => eventBus.off('data-mutated', refresh);
  }, [currentSite?.id, fetchNotifApprovals]);

  // Close modal on Escape key
  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  const imprestPendingCount = notifReceived.filter(r => r._type === 'imprest').length;
  const notifBadgeCount = isAdmin
    ? (parseInt(notifAppCounts.total) || 0) + imprestPendingCount
    : (parseInt(notifEditCounts.pending) || 0) + notifReceived.length;



  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSiteChange = (siteId) => {
    if (siteId === '__add_site__') {
      navigate('/sites');
      return;
    }
    const site = sites.find(s => String(s.id) === siteId);
    if (site) setCurrentSite(site);
  };

  const getIconTone = (path = '') => {
    if (path.startsWith('/dashboard')) return 'bg-blue-50 text-blue-600';
    if (path.startsWith('/clients') || path.startsWith('/register-user') || path.startsWith('/user-categories')) return 'bg-indigo-50 text-indigo-600';
    if (path.startsWith('/vendors')) return 'bg-orange-50 text-orange-600';
    if (path.startsWith('/farmers')) return 'bg-emerald-50 text-emerald-600';
    if (path.startsWith('/plot-commission') || path.startsWith('/commissions')) return 'bg-amber-50 text-amber-700';
    if (path.startsWith('/daybook')) return 'bg-teal-50 text-teal-700';
    if (path.startsWith('/balance-sheet')) return 'bg-blue-50 text-blue-700';
    if (path.startsWith('/cashflow')) return 'bg-cyan-50 text-cyan-700';
    if (path.startsWith('/firm-transactions')) return 'bg-sky-50 text-sky-700';
    if (path.startsWith('/plot-payments') || path.startsWith('/plot-documents') || path.startsWith('/payment-management') || path.startsWith('/payment-analytics')) return 'bg-violet-50 text-violet-700';
    if (path.startsWith('/plot-registry') || path.startsWith('/documents')) return 'bg-blue-50 text-blue-700';
    if (path.startsWith('/expenses') || path.startsWith('/expense-categories') || path.startsWith('/expense-approvals')) return 'bg-rose-50 text-rose-700';
    if (path.startsWith('/document-imprest')) return 'bg-indigo-50 text-indigo-700';
    if (path.startsWith('/imprest') || path.startsWith('/imprest-management')) return 'bg-lime-50 text-lime-700';
    if (path.startsWith('/excel')) return 'bg-green-50 text-green-700';
    if (path.startsWith('/chat')) return 'bg-purple-50 text-purple-700';
    if (path.startsWith('/settings')) return 'bg-slate-100 text-slate-700';
    if (path.startsWith('/sites') || path.startsWith('/sub-admins') || path.startsWith('/user-id-management') || path.startsWith('/permissions') || path.startsWith('/edit-approvals') || path.startsWith('/approval-manager') || path.startsWith('/dashboard-management')) return 'bg-red-50 text-red-700';
    return 'bg-slate-100 text-slate-600';
  };

  // Forwards to the module-level memoized button so it doesn't remount on every render
  const NavLink = useCallback(({ item }) => {
    const pathOnly = item.path.split('?')[0];
    const isActive = location.pathname === pathOnly && !item.path.includes('?');
    return (
      <NavLinkButton
        item={item}
        collapsed={collapsed}
        isActive={isActive}
        iconTone={getIconTone(pathOnly)}
        onNavigate={navigate}
      />
    );
  }, [collapsed, location.pathname, navigate]);

  const ChildNavLink = ({ item }) => {
    const Icon = item.icon;
    const pathOnly = item.path.split('?')[0];
    const isActive = location.pathname === pathOnly && !item.path.includes('?');
    const iconTone = getIconTone(pathOnly);
    return (
      <button
        onClick={() => navigate(item.path)}
        className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${isActive
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
      >
        <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${iconTone}`}>
          <Icon className="w-3 h-3" />
        </span>
        <span>{item.label}</span>
      </button>
    );
  };

  const hasClientsPermission = hasPermission('clients', 'read');

  // ── Sidebar search: flatten all items and filter by label ─────────
  const searchQ = search.trim().toLowerCase();
  const searchActive = searchQ.length > 0;
  const flatSearchItems = (() => {
    const list = [];
    navItems.forEach(i => list.push({ ...i }));
    if (hasClientsPermission) userMgmtChildren.forEach(i => list.push({ ...i, group: 'User Management' }));
    if (hasPermission('vendors', 'read')) vendorChildren.forEach(i => list.push({ ...i, group: 'Vendor Management' }));
    if (hasPermission('commissions', 'read')) commissionChildren.forEach(i => list.push({ ...i, group: 'Plot Commission' }));
    if (hasPermission('daybook', 'read')) dayBookChildren.forEach(i => list.push({ ...i, group: 'Day Book' }));
    if (hasPermission('balance_sheet', 'read')) balanceSheetChildren.forEach(i => list.push({ ...i, group: 'Balance Sheet' }));
    if (hasPermission('plot_payments', 'read')) plotPayChildren.forEach(i => list.push({ ...i, group: 'Plot Payments' }));
    if (hasPermission('expenses', 'read')) expenseChildren.forEach(i => list.push({ ...i, group: 'Expenses' }));
    if (canReadRegistryGroup) registryChildren.forEach(i => list.push({ ...i, group: 'Plot Registry' }));
    if (canReadExcel) excelChildren.forEach(i => list.push({ ...i, group: 'Native Documents' }));
    if (canReadChat) list.push({ path: '/chat', label: 'Internal Chat', icon: MessageSquare });
    if (isAdmin) adminNavItems.forEach(i => list.push({ ...i, group: 'Admin' }));
    // dedupe by path
    const seen = new Set();
    return list.filter(i => { if (seen.has(i.path)) return false; seen.add(i.path); return true; });
  })();

  const filteredSearchItems = useMemo(() => {
    if (!searchActive) return [];
    // Match against label OR parent group name OR path so users can search e.g.
    // "user" → all User Management children, "/cash" → cash day book, etc.
    return flatSearchItems.filter(i => {
      const label = (i.label || '').toLowerCase();
      const group = (i.group || '').toLowerCase();
      const path = (i.path || '').toLowerCase();
      return label.includes(searchQ) || group.includes(searchQ) || path.includes(searchQ);
    });
  }, [flatSearchItems, searchActive, searchQ]);

  // Reusable sidebar search box (inline JSX, not a component — keeps input focus stable)
  const searchBox = (
    <div className="px-3 pt-1 pb-2">
      <div className="relative group">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu…"
          className="w-full h-8 pl-8 pr-7 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );

  // Shared search results renderer
  const renderSearchList = () => {
    if (filteredSearchItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 px-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
            <SearchX className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-400 text-center">No matches for "{search}"</p>
        </div>
      );
    }
    return (
      <>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">
          Results · {filteredSearchItems.length}
        </p>
        {filteredSearchItems.map((item) => {
          const Icon = item.icon;
          const pathOnly = (item.path || '').split('?')[0];
          const iconTone = getIconTone(pathOnly);
          const isActive = location.pathname === pathOnly && !(item.path || '').includes('?');
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSearch(''); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-700' : iconTone}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="truncate">{item.label}</div>
                {item.group && <div className="text-[10px] text-slate-400 truncate">{item.group}</div>}
              </div>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex h-screen bg-white print:flex-col print:h-auto">
      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
            {/* Mobile sidebar header */}
            <div className="h-14 px-3 flex items-center justify-between border-b border-slate-100">
              <BrandLogo />
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile site selector */}
            {sites.length > 0 && (
              <div className="px-3 py-2">
                <SiteSelect sites={sites} currentSite={currentSite} onChange={handleSiteChange} isAdmin={isAdmin} />
              </div>
            )}

            <Separator />

            {searchBox}

            {/* Mobile nav — reuse same nav structure but never collapsed */}
            <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
              {searchActive ? renderSearchList() : (<>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">Menu</p>

              {navItems.filter(i => i.path === '/home' || i.path === '/dashboard').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasClientsPermission && (
                <Collapsible open={userMgmtOpen} onOpenChange={setUserMgmtOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isUserMgmtActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/clients" fallback={UsersRound} />
                      <span className="flex-1 text-left">User Management</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${userMgmtOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={userMgmtChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('vendors', 'read') && (
                <Collapsible open={vendorOpen} onOpenChange={setVendorOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isVendorActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/vendors" fallback={ShoppingBag} />
                      <span className="flex-1 text-left">Vendor Management</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${vendorOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={vendorChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path === '/farmers').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasPermission('commissions', 'read') && (
                <Collapsible open={commissionOpen} onOpenChange={setCommissionOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isCommissionActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/plot-commission" fallback={HandCoins} />
                      <span className="flex-1 text-left">Plot Commission</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${commissionOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={commissionChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('daybook', 'read') && (
                <Collapsible open={dayBookOpen} onOpenChange={setDayBookOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isDayBookActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/daybook" fallback={BookOpen} />
                      <span className="flex-1 text-left">Day Book</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${dayBookOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={dayBookChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('balance_sheet', 'read') && (
                <Collapsible open={balanceSheetOpen} onOpenChange={setBalanceSheetOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isBalanceSheetActive ? 'bg-blue-50 text-blue-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/balance-sheet" fallback={CircleDollarSign} />
                      <span className="flex-1 text-left">Balance Sheet</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${balanceSheetOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={balanceSheetChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path !== '/home' && i.path !== '/dashboard' && i.path !== '/farmers' && i.path !== '/daybook' && i.path !== '/imprest').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasPermission('upi_collect', 'read') && (
                <Collapsible open={receivePayOpen} onOpenChange={setReceivePayOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isReceivePayActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/receive-payments" fallback={QrCode} />
                      <span className="flex-1 text-left">Receive Payment</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${receivePayOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={receivePayChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {canReadRegistryGroup && (
                <Collapsible open={registryOpen} onOpenChange={setRegistryOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isRegistryActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/plot-registry" fallback={Library} />
                      <span className="flex-1 text-left">Plot Registry</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${registryOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={registryChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('plot_payments', 'read') && (
                <Collapsible open={plotPayOpen} onOpenChange={setPlotPayOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isPlotPayActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/plot-payments" fallback={LayoutGrid} />
                      <span className="flex-1 text-left">Plot Payments</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${plotPayOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={plotPayChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('expenses', 'read') && (
                <Collapsible open={expenseOpen} onOpenChange={setExpenseOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExpenseActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/expenses" fallback={CreditCard} />
                      <span className="flex-1 text-left">Expenses</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${expenseOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={expenseChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path === '/imprest').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {canReadExcel && (
                <Collapsible open={excelOpen} onOpenChange={setExcelOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExcelActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <AppIcon path="/excel/files" fallback={Sheet} />
                      <span className="flex-1 text-left">Native Documents</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${excelOpen ? 'rotate-90' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={excelChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {canReadChat && <NavLink item={{ path: '/chat', label: 'Internal Chat', icon: MessageSquare }} />}

              {isAdmin && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-4 pb-1.5">Admin</p>
                  {adminNavItems.map((item) => (<NavLink key={item.path} item={item} />))}
                </>
              )}
              </>)}
            </nav>

            {/* Mobile bottom */}
            <div className="px-2 pb-2 space-y-0.5">
              {canReadSettings && <NavLink item={{ path: '/settings', label: 'Settings', icon: Settings }} />}
              <Separator className="my-2" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                <span className="w-6 h-6 rounded-md flex items-center justify-center bg-red-50"><LogOut className="w-3.5 h-3.5" /></span>
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden md:flex print:hidden ${collapsed ? 'w-16' : 'w-60'
          } bg-linear-to-b from-white via-white to-slate-50/70 border-r border-slate-200/70 transition-[width] duration-150 flex-col shrink-0 overflow-hidden relative`}
      >
        {/* Logo + collapse */}
        <div className={`h-14 px-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <BrandLogo />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`rounded-md transition-colors ${
              collapsed
                ? 'w-9 h-9 flex items-center justify-center bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-500/30 ring-1 ring-inset ring-white/25 hover:from-blue-600 hover:via-blue-500 hover:to-cyan-400'
                : 'p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Site Selector */}
        {!collapsed && sites.length > 0 && (
          <div className="px-3 mb-1">
            <SiteSelect sites={sites} currentSite={currentSite} onChange={handleSiteChange} isAdmin={isAdmin} />
          </div>
        )}

        <Separator className="my-2" />

        {!collapsed && searchBox}

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {!collapsed && searchActive ? renderSearchList() : (<>
          {!collapsed && (
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">
              Menu
            </p>
          )}

          {/* Dashboard (always first, before User Management) */}
          {navItems.filter(i => i.path === '/home' || i.path === '/dashboard').map((item) => (
            <NavLink key={item.path} item={item} />
          ))}

          {/* User Management Collapsible Group */}
          {hasClientsPermission && (
            collapsed ? (
              <NavLink item={{ path: '/clients', label: 'User Management', icon: UsersRound }} />
            ) : (
              <Collapsible open={userMgmtOpen} onOpenChange={setUserMgmtOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isUserMgmtActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/clients" fallback={UsersRound} />
                    <span className="flex-1 text-left">User Management</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${userMgmtOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={userMgmtChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Vendor Management Collapsible Group */}
          {hasPermission('vendors', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/vendors', label: 'Vendor Management', icon: ShoppingBag }} />
            ) : (
              <Collapsible open={vendorOpen} onOpenChange={setVendorOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isVendorActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/vendors" fallback={ShoppingBag} />
                    <span className="flex-1 text-left">Vendor Management</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${vendorOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={vendorChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Farmer Payments */}
          {navItems.filter(i => i.path === '/farmers').map((item) => (
            <NavLink key={item.path} item={item} />
          ))}

          {/* Plot Commission Collapsible Group */}
          {hasPermission('commissions', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/plot-commission', label: 'Plot Commission', icon: HandCoins }} />
            ) : (
              <Collapsible open={commissionOpen} onOpenChange={setCommissionOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isCommissionActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/plot-commission" fallback={HandCoins} />
                    <span className="flex-1 text-left">Plot Commission</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${commissionOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={commissionChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Day Book Collapsible Group */}
          {hasPermission('daybook', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/daybook', label: 'Day Book', icon: BookOpen }} />
            ) : (
              <Collapsible open={dayBookOpen} onOpenChange={setDayBookOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isDayBookActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/daybook" fallback={BookOpen} />
                    <span className="flex-1 text-left">Day Book</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${dayBookOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={dayBookChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Balance Sheet — consolidated cash/bank reporting, excluding Imprest */}
          {hasPermission('balance_sheet', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/balance-sheet', label: 'Balance Sheet', icon: CircleDollarSign }} />
            ) : (
              <Collapsible open={balanceSheetOpen} onOpenChange={setBalanceSheetOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isBalanceSheetActive
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/balance-sheet" fallback={CircleDollarSign} />
                    <span className="flex-1 text-left">Balance Sheet</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${balanceSheetOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={balanceSheetChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Remaining nav items (excluding dashboard, vendors, farmers, daybook, imprest) */}
          {navItems.filter(i => i.path !== '/home' && i.path !== '/dashboard' && i.path !== '/farmers' && i.path !== '/daybook' && i.path !== '/imprest').map((item) => (
            <NavLink key={item.path} item={item} />
          ))}

          {/* Receive Payment Collapsible Group */}
          {hasPermission('upi_collect', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/receive-payments', label: 'Receive Payment', icon: QrCode }} />
            ) : (
              <Collapsible open={receivePayOpen} onOpenChange={setReceivePayOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isReceivePayActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/receive-payments" fallback={QrCode} />
                    <span className="flex-1 text-left">Receive Payment</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${receivePayOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={receivePayChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Plot Registry Collapsible Group */}
          {canReadRegistryGroup && (
            collapsed ? (
              <NavLink item={canReadPlotRegistry
                ? { path: '/plot-registry', label: 'Plot Registry', icon: Library }
                : { path: '/documents', label: 'Document Search', icon: FileSearch }} />
            ) : (
              <Collapsible open={registryOpen} onOpenChange={setRegistryOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isRegistryActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/plot-registry" fallback={Library} />
                    <span className="flex-1 text-left">Plot Registry</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${registryOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={registryChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Plot Payments Collapsible Group */}
          {hasPermission('plot_payments', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid }} />
            ) : (
              <Collapsible open={plotPayOpen} onOpenChange={setPlotPayOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isPlotPayActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/plot-payments" fallback={LayoutGrid} />
                    <span className="flex-1 text-left">Plot Payments</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${plotPayOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={plotPayChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Expenses Collapsible Group */}
          {hasPermission('expenses', 'read') && (
            collapsed ? (
              <NavLink item={{ path: '/expenses', label: 'Expenses', icon: CreditCard }} />
            ) : (
              <Collapsible open={expenseOpen} onOpenChange={setExpenseOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExpenseActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <AppIcon path="/expenses" fallback={CreditCard} />
                    <span className="flex-1 text-left">Expenses</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${expenseOpen ? 'rotate-90' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  <TreeGroup items={expenseChildren} getIconTone={getIconTone} />
                </CollapsibleContent>
              </Collapsible>
            )
          )}

          {/* Imprest (after Expenses) */}
          {navItems.filter(i => i.path === '/imprest').map((item) => (
            <NavLink key={item.path} item={item} />
          ))}

          {/* Native Excel Collapsible Group */}
          {canReadExcel && (collapsed ? (
            <NavLink item={{ path: '/excel/files', label: 'Native Documents', icon: Sheet }} />
          ) : (
            <Collapsible open={excelOpen} onOpenChange={setExcelOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExcelActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                >
                  <AppIcon path="/excel/files" fallback={Sheet} />
                  <span className="flex-1 text-left">Native Documents</span>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${excelOpen ? 'rotate-90' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-0.5">
                <TreeGroup items={excelChildren} getIconTone={getIconTone} />
              </CollapsibleContent>
            </Collapsible>
          ))}

          {canReadChat && <NavLink item={{ path: '/chat', label: 'Internal Chat', icon: MessageSquare }} />}

          {isAdmin && (
            <>
              {!collapsed && (
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-4 pb-1.5">
                  Admin
                </p>
              )}
              {collapsed && <Separator className="my-2" />}
              {adminNavItems.map((item) => (
                item.path === '/pending-approvals' && notifBadgeCount > 0
                  ? (
                    <div key={item.path} className="relative">
                      <NavLink item={item} />
                      <span className="absolute top-1.5 right-2 inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-bold bg-red-500 text-white rounded-full pointer-events-none">
                        {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                      </span>
                    </div>
                  )
                  : <NavLink key={item.path} item={item} />
              ))}
            </>
          )}
          </>)}
        </nav>

        {/* Bottom - Settings + User */}
        <div className="px-2 pb-2 space-y-0.5">
          {canReadSettings && <NavLink item={{ path: '/settings', label: 'Settings', icon: Settings }} />}
          <Separator className="my-2" />
          {!collapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-[11px] font-semibold shrink-0">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-slate-700 truncate">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Sub-Admin'}</p>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-slate-800">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {canReadSettings && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs">
                      <Settings className="w-3.5 h-3.5 mr-2" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-600 focus:text-red-600">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 print:overflow-visible print:bg-white">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200/80 px-3 md:px-6 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all border border-slate-200 shadow-xs shrink-0"
              title="Go back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm transition-all duration-200">
            {currentSite ? (
              <>
                <span className="text-slate-400">Sites</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-medium text-slate-700 transition-all duration-200">{currentSite.name}</span>
                {currentSite.city && (
                  <span className="text-slate-400 text-xs ml-1 transition-all duration-200">({currentSite.city})</span>
                )}
              </>
            ) : (
              <span className="text-slate-400">No site selected</span>
            )}
            </div>
            {/* Mobile site name */}
            <span className="sm:hidden text-sm font-medium text-slate-700 truncate">{currentSite?.name || 'No site'}</span>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Language */}
            <LanguageSwitcher />
            {/* Notification Bell */}
            <button
              onClick={() => {
                setNotifOpen(true);
                setNotifTab(isAdmin ? 'received' : 'sent');
                fetchNotifApprovals();
              }}
              className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Approvals & Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4.25 h-4.25 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none px-1 shadow-sm">
                  {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                </span>
              )}
            </button>
            <span className={`hidden sm:inline text-[11px] font-medium px-2 py-0.5 rounded ${isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Sub-Admin'}
            </span>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-sm text-slate-600 hidden sm:inline">{user?.name}</span>
                  {user?.photo ? (
                    <img src={user.photo} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm shadow-blue-500/25 ring-1 ring-inset ring-white/25">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="flex items-center gap-3 px-2 py-2.5">
                  {user?.photo ? (
                    <img src={user.photo} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm shadow-blue-500/25 ring-1 ring-inset ring-white/25 shrink-0">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Sub-Admin'}
                    </span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {canReadSettings && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs">
                      <Settings className="w-3.5 h-3.5 mr-2 text-slate-400" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6 print:overflow-visible print:p-0 print:pb-0">
          <div
            key={location.pathname}
            className={`animate-route-fade-in transition-opacity duration-150 print:animate-none ${siteTransition ? 'opacity-0' : 'opacity-100'}`}
          >
            <Outlet key={currentSite?.id || 'no-site'} />
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-bottom print:hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {[
            { path: '/dashboard', label: 'Main', icon: Home },
            { path: '/expenses', label: 'Expenses', icon: CreditCard },
            { path: '/plot-payments', label: 'Plots', icon: LayoutGrid },
            { path: '/daybook', label: 'Day Book', icon: BookOpen },
          ].map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg text-slate-400 transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ── Notifications / Approvals Modal ── */}
      {notifOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setNotifOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[26px] bg-white shadow-2xl shadow-slate-950/25 max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between bg-slate-950 px-4 py-3.5 sm:px-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm shadow-blue-200">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Approval Center</p>
                  <p className="text-[11px] text-slate-400">
                    {currentSite?.name || 'No site'} · {notifBadgeCount} pending review
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2 shrink-0">
              <button
                onClick={() => setNotifTab('received')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors relative ${
                  notifTab === 'received' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                Received
                {notifReceived.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full">
                    {notifReceived.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setNotifTab('sent')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors relative ${
                  notifTab === 'sent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Sent
                {(parseInt(notifEditCounts.pending) || 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full">
                    {notifEditCounts.pending}
                  </span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {notifLoading ? (
                <div className="space-y-3 p-4">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="flex items-start gap-3 rounded-xl px-1 py-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <div className="flex gap-2">
                          <Skeleton className="h-4 w-16 rounded-full" />
                          <Skeleton className="h-4 w-20 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifTab === 'received' ? (
                notifReceived.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">All clear!</p>
                      <p className="text-xs text-slate-400 mt-0.5">No pending approvals right now</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {(notifTotals.debit > 0 || notifTotals.credit > 0) && (
                      <div className="mx-4 mt-3 rounded-2xl bg-slate-950 px-3.5 py-3 text-white shadow-sm sm:mx-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">Pending financial review</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">Review the money movement before approving.</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white">{notifReceived.length} pending</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-white/[0.06]">
                          <div className="px-2 py-1.5"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Debit</p><p className="mt-0.5 truncate text-base font-black tabular-nums text-rose-300 sm:text-lg">₹{notifFmt(notifTotals.debit)}</p></div>
                          <div className="px-2 py-1.5"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Credit</p><p className="mt-0.5 truncate text-base font-black tabular-nums text-emerald-300 sm:text-lg">₹{notifFmt(notifTotals.credit)}</p></div>
                          <div className="px-2 py-1.5"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total</p><p className="mt-0.5 truncate text-base font-black tabular-nums text-white sm:text-lg">₹{notifFmt(notifTotals.debit + notifTotals.credit)}</p></div>
                        </div>
                      </div>
                    )}
                    {notifReceived.map((entry) => {
                      // Sub-admin allocation received from admin
                      if (entry._type === 'allocation') {
                        return (
                          <div key={`allocation-${entry.id}`} className="px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 leading-tight">
                                  Imprest Allocated{' '}
                                  <span className="text-slate-400 font-normal text-xs">₹{Number(entry.amount).toLocaleString('en-IN')}</span>
                                </p>
                                <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">Allocation</span>
                                  <span className="text-[11px] text-slate-400">{notifFmtDate(entry.created_at)}</span>
                                  {entry.remark && <span className="text-[11px] text-slate-400 truncate max-w-32">{entry.remark}</span>}
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 mt-0.5 bg-amber-50 text-amber-700 border-amber-200">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            </div>
                            <div className="mt-2.5 ml-11">
                              <Link
                                to="/imprest"
                                onClick={() => setNotifOpen(false)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Confirm Receipt
                              </Link>
                            </div>
                          </div>
                        );
                      }
                      const detail = getNotifRequestDetails(entry);
                      const ledger = getNotifLedger(entry);
                      const actionKey = `${entry.source}-${entry.id}`;
                      const isActing = notifActionId === actionKey;
                      return (
                        <div key={actionKey} className="px-4 py-3 hover:bg-slate-50/70 transition-colors sm:px-5">
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${entry._type === 'imprest' ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
                              {entry._type === 'imprest'
                                ? <Wallet className="w-3.5 h-3.5 text-violet-600" />
                                : <Clock className="w-3.5 h-3.5 text-amber-600" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${detail.module.cls}`}>
                                    {detail.module.label}
                                  </span>
                                  <span className="text-[11px] text-slate-400">{notifFmtDate(entry.date)}</span>
                                  {entry.created_by_name && <span className="hidden text-[11px] text-slate-400 sm:inline">by {entry.created_by_name}</span>}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className={`text-base font-black leading-none tracking-tight tabular-nums sm:text-lg ${ledger.debit > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {ledger.debit > 0 ? '−' : '+'}₹{notifFmt(ledger.debit || ledger.credit)}
                                  </p>
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{ledger.debit > 0 ? 'Money out' : 'Money in'}</p>
                                </div>
                              </div>
                              <p className="mt-1 truncate text-sm font-semibold leading-tight text-slate-800">{detail.purpose}</p>
                              <p className="mt-1 truncate text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-700">{detail.entityName}</span>
                                <span className="mx-1 text-slate-300">·</span>{detail.entityType}
                                {detail.entityDetails.length > 0 && <span className="text-indigo-700"> · {detail.entityDetails.join(' · ')}</span>}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${(entry.payment_mode || entry.cash_type || '').toUpperCase() === 'CASH' || entry.cash_type === 'cash' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : (entry.payment_mode || entry.cash_type || '').toUpperCase() === 'CHEQUE' || entry.cash_type === 'cheque' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{(entry.payment_mode || entry.cash_type || '—').toUpperCase()}</span>
                                {entry.voucher_url ? <button type="button" onClick={() => openDoc({ url: entry.voucher_url, title: 'Voucher', subtitle: detail.purpose })} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"><ExternalLink className="h-3 w-3" /> View voucher</button> : <span className="text-[10px] text-slate-400">No voucher</span>}
                                {isAdmin && (
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <button
                                      disabled={!!notifActionId}
                                      onClick={() => handleNotifApprove(entry)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50"
                                    >
                                      {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                      Approve
                                    </button>
                                    <button
                                      disabled={!!notifActionId}
                                      onClick={() => handleNotifReject(entry)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-slate-950 disabled:opacity-50"
                                    >
                                      {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                notifSent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                      <Send className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">No requests sent</p>
                      <p className="text-xs text-slate-400 mt-0.5">Your edit & imprest requests will appear here</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifSent.map((req) => {
                      const st = NOTIF_STATUS_BADGE[req.status] || NOTIF_STATUS_BADGE.pending;
                      const StIcon = st.icon;
                      const isImprest = req._type === 'imprest';
                      const colorMap = {
                        approved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600' },
                        rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-600' },
                      };
                      const fallback = isImprest
                        ? { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-600' }
                        : { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600' };
                      const c = colorMap[req.status] || fallback;
                      return (
                        <div key={`${req._type}-${req.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${c.bg}`}>
                            {isImprest
                              ? <Wallet className={`w-3.5 h-3.5 ${c.text}`} />
                              : <FileEdit className={`w-3.5 h-3.5 ${c.text}`} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            {isImprest ? (
                              <p className="text-sm font-medium text-slate-800 leading-tight">
                                Imprest Request{' '}
                                <span className="text-slate-400 font-normal text-xs">₹{notifFmt(req.amount)}</span>
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                                Edit {NOTIF_EDIT_MODULE_LABELS[req.module] || req.module}{' '}
                                <span className="text-slate-400 font-normal text-xs">#{req.record_id}</span>
                              </p>
                            )}
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                                isImprest ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {isImprest ? 'Imprest' : 'Edit'}
                              </span>
                              <span className="text-[11px] text-slate-400">{notifFmtDate(req.created_at)}</span>
                              {req.site_name && <span className="text-[11px] text-slate-400">{req.site_name}</span>}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 mt-0.5 ${st.cls}`}>
                            <StIcon className="w-3 h-3" /> {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-4 py-3 flex items-center justify-between bg-slate-50/60">
              <p className="text-[11px] text-slate-400">
                {notifTab === 'received'
                  ? `${notifReceived.length} item${notifReceived.length !== 1 ? 's' : ''} shown`
                  : `${notifSent.length} item${notifSent.length !== 1 ? 's' : ''} shown`}
              </p>
              <Link
                to={notifTab === 'received'
                  ? (isAdmin ? '/pending-approvals' : '/imprest')
                  : '/edit-approvals'}
                onClick={() => setNotifOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
