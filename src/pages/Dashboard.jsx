import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@apollo/client/react';
import { GET_KPI_CARDS } from '../graphql/queries';
import { apolloClient } from '../graphql/client';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Users, Tractor, Landmark, Wallet, Banknote, LayoutGrid,
  ClipboardList, CreditCard, MapPin, UserCog, Settings,
  ChevronRight, ChevronLeft,
  Clock, CheckCircle2, XCircle, ExternalLink,
  Send, Search, Phone, TrendingUp, TrendingDown, AlertTriangle,
  MessageSquare, Paperclip, ArrowLeft, X, ShieldCheck, RefreshCw, Activity,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTimeRange } from '../components/dashboard/timeRange';
import { useDocViewer } from '../components/DocViewer';
import FinancialPulseBoard from '../components/dashboard/FinancialPulseBoard';
import ConstructionInventoryCards from '../components/dashboard/ConstructionInventoryCards';
import VerifyPanel from '../components/dashboard/VerifyPanel';
import { RevenueVsExpenseChart, ProfitTrendChart, ExpenseByCategoryRadar } from '../components/dashboard/AnalyticsCharts';
import QuickEntry from '../components/QuickEntry';

const MotionDiv = motion.div;
const MotionSpan = motion.span;

const MODULE_CARDS = [
  { to: '/clients', label: 'User Management', icon: Users, desc: 'Clients, farmers & members', color: 'from-blue-500 to-blue-600', module: 'clients' },
  { to: '/farmers', label: 'Farmer Payments', icon: Tractor, desc: 'Track farmer payment records', color: 'from-emerald-500 to-emerald-600', module: 'farmers' },
  { to: '/commissions', label: 'Plot Commission', icon: Landmark, desc: 'Commission calculations', color: 'from-purple-500 to-purple-600', module: 'commissions' },
  { to: '/cashflow', label: 'Cash Flow / Ledgers', icon: Wallet, desc: 'Income & expense tracking', color: 'from-amber-500 to-amber-600', module: 'cashflow' },
  { to: '/firm-transactions', label: 'Firm Transactions', icon: Banknote, desc: 'Firm-level transactions', color: 'from-cyan-500 to-cyan-600', module: 'firm_transactions' },
  { to: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid, desc: 'Plot payment schedules', color: 'from-rose-500 to-rose-600', module: 'plot_payments' },
  { to: '/plot-registry', label: 'Plot Registry', icon: ClipboardList, desc: 'Registry records & docs', color: 'from-indigo-500 to-indigo-600', module: 'plot_registry' },
  { to: '/expenses', label: 'Expenses', icon: CreditCard, desc: 'Expense vouchers & tracking', color: 'from-orange-500 to-orange-600', module: 'expenses' },
];

const ADMIN_CARDS = [
  { to: '/sites', label: 'Sites', icon: MapPin, desc: 'Manage project sites', color: 'from-slate-600 to-slate-700' },
  { to: '/sub-admins', label: 'Sub-Admins', icon: UserCog, desc: 'User access & roles', color: 'from-slate-600 to-slate-700' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Account & preferences', color: 'from-slate-600 to-slate-700' },
];

const WorkspaceRail = ({ items }) => (
  <nav aria-label="Dashboard workspaces" className="min-w-0">
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="group flex min-w-[168px] flex-1 items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-slate-50"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${item.color} text-white shadow-sm`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">{item.label}</span>
              <span className="mt-0.5 block truncate text-[10px] text-slate-400">{item.desc}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </Link>
        );
      })}
    </div>
  </nav>
);

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

const SOURCE_MODULE_MAP = {
  farmer_payments: { label: 'Farmer Payment', cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commissions: { label: 'Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payments: { label: 'Comm. Payment', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  day_book: { label: 'Day Book', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  firm_transactions: { label: 'Firm Txn', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payments: { label: 'Plot Payment', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expenses: { label: 'Expense', cls: 'bg-red-50 text-red-700 border-red-200' },
  vendor_payments: { label: 'Vendor', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  plot_installment_payments: { label: 'Installment', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  plot_registry_payments: { label: 'Registry Txn', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  personal_ledger_debit: { label: 'Personal Ledger', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const MEMBER_MODULE_CONFIG = {
  clients: {
    label: 'Profile',
    module: 'clients',
    icon: Users,
    cls: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    to: (member) => `/clients/${member.id}`,
  },
  expenses: {
    label: 'Expenses',
    module: 'expenses',
    icon: CreditCard,
    cls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    to: (member) => `/expenses?q=${encodeURIComponent(member.full_name || '')}`,
  },
  commissions: {
    label: 'Commissions',
    module: 'commissions',
    icon: Landmark,
    cls: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    to: (member) => `/commissions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  plot_payments: {
    label: 'Plot Payments',
    module: 'plot_payments',
    icon: LayoutGrid,
    cls: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    to: (member) => `/plot-payments?q=${encodeURIComponent(member.full_name || '')}`,
  },
  farmer_payments: {
    label: 'Farmer Payments',
    module: 'farmers',
    icon: Tractor,
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    to: (member) => `/farmers?q=${encodeURIComponent(member.full_name || '')}`,
  },
  firm_transactions: {
    label: 'Firm Transactions',
    module: 'firm_transactions',
    icon: Banknote,
    cls: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    to: (member) => `/firm-transactions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  personal_ledger: {
    label: 'Personal Ledger',
    module: 'cashflow',
    icon: Wallet,
    cls: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
    to: (entity) => `/cashflow?q=${encodeURIComponent(entity.full_name || entity.ledger_name || '')}`,
  },
};

const STATUS_BADGE = {
  pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'bg-red-50 text-red-700 border-red-200' },
  BOUNCED: { label: 'Bounced', icon: AlertTriangle, cls: 'bg-red-50 text-red-700 border-red-200' },
  RETURNED: { label: 'Returned', icon: AlertTriangle, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  CLEARED: { label: 'Cleared', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getSearchEntityKey = (entity) => (
  entity?._kind === 'ledger' ? `ledger-${entity.ledger_id}` : `member-${entity.id}`
);

export const Dashboard = () => {
  const { user, token, currentSite, sites, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const openDoc = useDocViewer();

  // Recent Transactions
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnData, setTxnData] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnPagination, setTxnPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1 });
  const TXN_PER_PAGE = 10;

  const canReadCashflow = hasPermission('cashflow', 'read');
  const canReadChat = hasPermission('chat', 'read');
  const canReadPlots = hasPermission('plot_payments', 'read');

  // ── Dashboard component visibility permissions ──
  // Admins always see everything. Sub-admins are checked against the DB.
  const [dashPerms, setDashPerms] = useState(null); // null = loading, {} = loaded
  useEffect(() => {
    if (isAdmin) { setDashPerms(null); return; } // admins bypass
    api.get('/dashboard-permissions/me')
      .then(res => setDashPerms(res.data.permissions || {}))
      .catch(() => setDashPerms({})); // on error default to all visible
  }, [isAdmin, user?.id]);

  // Helper: returns true if admin OR component is allowed (defaults to true when not in map)
  const canSee = useCallback((key) => {
    if (isAdmin) return true;
    if (!dashPerms) return false; // still loading
    return dashPerms[key] !== false;
  }, [isAdmin, dashPerms]);

  // ── GraphQL-powered KPI analytics ──
  const [timePreset, setTimePreset] = useState('overall');
  const [excludeOldPlots, setExcludeOldPlots] = useState(false);
  // Registry Payments is an informational view of mapped, approved source
  // receipts. It defaults to NEW plots; the toggle adds mapped OLD receipts
  // without posting either group to incoming/outgoing a second time.
  const [registryIncludeOld, setRegistryIncludeOld] = useState(false);
  const range = useTimeRange(timePreset);

  // Auto-select best resolution for the chart based on the time window
  const chartResolution = useMemo(() => {
    if (timePreset === 'today' || timePreset === 'this_week') return 'DAY';
    if (timePreset === 'this_month') return 'DAY';
    if (timePreset === 'this_year') return 'MONTH';
    return 'YEAR'; // overall
  }, [timePreset]);

  const { data: kpiData, loading: kpiLoading, refetch: refetchKpi } = useQuery(GET_KPI_CARDS, {
    variables: { siteId: String(currentSite?.id), range, excludeOldPlots },
    skip: !currentSite?.id || (!isAdmin && !dashPerms),
    // cache-and-network: render instantly from Apollo's in-memory cache
    // (last successful response for this site + range) and refresh in
    // background. The backend resolver also has Redis caching now, so
    // the network leg is fast even on cache-miss.
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  const kpi = kpiData?.kpiCards;

  // ── KPI detail modal ──
  const [kpiModal, setKpiModal] = useState(null); // 'totalIncoming' | 'totalExpense' | 'profit' | 'personalLedger' | null
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);
  const [chatConversations, setChatConversations] = useState([]);
  const [chatActive, setChatActive] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatUploading, setChatUploading] = useState(false);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatFileRef = useRef(null);
  const chatSocketRef = useRef(null);
  const chatActiveRef = useRef(null);
  const chatLastConvRef = useRef(null);

  useEffect(() => { chatActiveRef.current = chatActive; }, [chatActive]);

  // Socket.io for chat
  useEffect(() => {
    if (!token || !canReadChat) return;
    const s = io(import.meta.env.VITE_API_URL || 'http://localhost:80000', { auth: { token } });
    chatSocketRef.current = s;
    s.on('new_message', (msg) => {
      const cur = chatActiveRef.current;
      setChatMessages(prev => {
        if (cur && msg.conversation_id === cur.id) {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      setChatConversations(prev =>
        prev.map(c => c.conversation_id === msg.conversation_id ? {
          ...c, last_message: msg.message_text, last_message_time: msg.created_at,
          unread_count: (msg.sender_id !== user?.id && (!cur || cur.id !== msg.conversation_id))
            ? Number(c.unread_count || 0) + 1 : c.unread_count,
        } : c).sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at))
      );
    });
    return () => { s.disconnect(); chatSocketRef.current = null; };
  }, [token, canReadChat, user?.id]);

  // Join/leave conversation room
  useEffect(() => {
    const s = chatSocketRef.current;
    if (s && chatActive) {
      s.emit('join_conversation', chatActive.id);
      return () => s.emit('leave_conversation', chatActive.id);
    }
  }, [chatActive]);

  // Fetch chat data when modal opens
  useEffect(() => {
    if (!chatOpen || !canReadChat) return;
    const load = async () => {
      setChatLoading(true);
      try {
        const [uRes, cRes] = await Promise.all([api.get('/chat/users'), api.get('/chat/conversations')]);
        setChatUsers(uRes.data.users || []);
        setChatConversations(cRes.data.conversations || []);
      } catch { /* Keep the dashboard usable when chat is temporarily unavailable. */ } finally { setChatLoading(false); }
    };
    load();
  }, [chatOpen, canReadChat]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!chatActive) return;
    const load = async () => {
      try {
        const res = await api.get(`/chat/messages/${chatActive.id}`);
        setChatMessages(res.data.messages || []);
        setChatConversations(prev => prev.map(c =>
          c.conversation_id === chatActive.id ? { ...c, unread_count: 0 } : c
        ));
      } catch { /* Conversation history is non-blocking dashboard data. */ }
    };
    load();
  }, [chatActive]);

  // Auto-scroll
  useEffect(() => {
    if (!chatActive) return;
    const isNew = chatLastConvRef.current !== chatActive.id;
    if (isNew) { chatLastConvRef.current = chatActive.id; setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50); return; }
    if (chatContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;
      if (scrollHeight - scrollTop - clientHeight < 350) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatMessages, chatActive]);

  const chatStartConv = async (userId) => {
    try {
      const res = await api.get(`/chat/conversations/${userId}`);
      const conv = res.data.conversation;
      const other = chatUsers.find(u => u.id === userId);
      const ac = { id: conv.id, user_name: other?.name || 'User', user_photo: other?.photo, user_id: userId };
      setChatActive(ac);
      setChatConversations(prev => {
        if (!prev.find(c => c.conversation_id === conv.id)) {
          return [{ conversation_id: conv.id, user_id: userId, user_name: other?.name, user_photo: other?.photo, last_message: '', last_message_time: new Date().toISOString(), unread_count: 0 }, ...prev];
        }
        return prev;
      });
    } catch { /* The full chat screen remains available as a fallback. */ }
  };

  const chatSend = async (e) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || !chatActive) return;
    try {
      const res = await api.post('/chat/messages', { conversationId: chatActive.id, text: chatInput, attachmentUrl: chatAttachment?.url || null });
      const nm = res.data.message;
      if (nm) {
        setChatMessages(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
        setChatConversations(prev => prev.map(c => c.conversation_id === nm.conversation_id ? { ...c, last_message: nm.message_text, last_message_time: nm.created_at } : c)
          .sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at)));
      }
      setChatInput(''); setChatAttachment(null);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { /* Preserve the draft so the user can retry sending it. */ }
  };

  const chatHandleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setChatUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/upload/single?provider=cloudinary', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setChatAttachment({ url: res.data.fileUrl || res.data.url, name: file.name });
    } catch { alert('Upload failed'); } finally { setChatUploading(false); if (chatFileRef.current) chatFileRef.current.value = ''; }
  };

  const chatTotalUnread = useMemo(() => chatConversations.reduce((s, c) => s + (Number(c.unread_count) || 0), 0), [chatConversations]);
  const chatFilteredUsers = useMemo(() => chatUsers.filter(u => u.name.toLowerCase().includes(chatSearch.toLowerCase())), [chatUsers, chatSearch]);

  const [memberSearchQuery, setMemberSearchQuery] = useState(() => sessionStorage.getItem('dashboard_member_search') || '');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberResults, setMemberResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dashboard_member_results')) || []; } catch { return []; }
  });
  // Plot-number quick-search results (jump straight to /plot-payments/:id)
  const [plotResults, setPlotResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dashboard_plot_results')) || []; } catch { return []; }
  });
  const rehydrateModules = (stored) => {
    const result = {};
    Object.entries(stored).forEach(([entityKey, mods]) => {
      result[entityKey] = (mods || []).map((m) => {
        const cfg = MEMBER_MODULE_CONFIG[m.key];
        return cfg ? { ...cfg, key: m.key, count: m.count } : null;
      }).filter(Boolean);
    });
    return result;
  };

  const [memberModulesById, setMemberModulesById] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('dashboard_member_modules')) || {};
      return rehydrateModules(stored);
    } catch { return {}; }
  });
  const [memberModuleLoadingById, setMemberModuleLoadingById] = useState({});
  const modulesCacheRef = useRef(() => {
    const map = new Map();
    try {
      const stored = JSON.parse(sessionStorage.getItem('dashboard_member_modules')) || {};
      const hydrated = rehydrateModules(stored);
      Object.entries(hydrated).forEach(([k, v]) => map.set(k, v));
    } catch { /* Ignore corrupt legacy session cache and rebuild it lazily. */ }
    return map;
  });
  // Lazily initialize the ref (run the factory once)
  if (typeof modulesCacheRef.current === 'function') {
    modulesCacheRef.current = modulesCacheRef.current();
  }
  // Prevent unbounded cache growth
  const MODULE_CACHE_LIMIT = 100;
  const trimModuleCache = useCallback(() => {
    const cache = modulesCacheRef.current;
    if (cache.size > MODULE_CACHE_LIMIT) {
      const excess = cache.size - MODULE_CACHE_LIMIT;
      const keys = cache.keys();
      for (let i = 0; i < excess; i++) keys.next().value && cache.delete(keys.next().value);
    }
  }, []);
  const lastFetchedQueryRef = useRef(sessionStorage.getItem('dashboard_member_search') || '');

  useEffect(() => {
    sessionStorage.setItem('dashboard_member_search', memberSearchQuery);
  }, [memberSearchQuery]);

  useEffect(() => {
    try { sessionStorage.setItem('dashboard_member_results', JSON.stringify(memberResults)); } catch { /* Session cache is optional. */ }
  }, [memberResults]);

  useEffect(() => {
    try { sessionStorage.setItem('dashboard_plot_results', JSON.stringify(plotResults)); } catch { /* Session cache is optional. */ }
  }, [plotResults]);

  useEffect(() => {
    try {
      // Only store serializable fields (key + count) — icons/functions can't survive JSON
      const serializable = {};
      Object.entries(memberModulesById).forEach(([entityKey, mods]) => {
        serializable[entityKey] = (mods || []).map((m) => ({ key: m.key, count: m.count }));
      });
      sessionStorage.setItem('dashboard_member_modules', JSON.stringify(serializable));
    } catch { /* Session cache is optional. */ }
  }, [memberModulesById]);

  // NOTE: siteCashFlowSummary state was removed — the previous code fetched
  // /cashflow/months on every Dashboard load, computed totals, and stored
  // them in state … but the values were never read anywhere in the JSX.
  // The same numbers are also returned in `kpi.cashflowDetail`, so any
  // future renderer can read from there without an extra round-trip.

  const fetchTransactions = useCallback(async (page = 1) => {
    if (!currentSite?.id) return;
    setTxnLoading(true);
    try {
      const res = await api.get(`/daybook/recent?site_id=${currentSite.id}&page=${page}&limit=${TXN_PER_PAGE}`);
      setTxnData(res.data.transactions || []);
      setTxnPagination(res.data.pagination || { totalItems: 0, totalPages: 1, currentPage: page });
      setTxnPage(page);
    } catch {
      setTxnData([]);
    } finally {
      setTxnLoading(false);
    }
  }, [currentSite?.id]);

  const handleTxnClick = useCallback((txn) => {
    const mod = txn.source_module;
    if (mod === 'plot_payments' || mod === 'plot_installment_payments') {
      const q = txn.plot_no ? `?q=${encodeURIComponent(txn.plot_no)}` : '';
      navigate(`/plot-payments${q}`);
    } else if (mod === 'plot_commissions' || mod === 'plot_commission_payments') {
      navigate('/plot-commission');
    } else if (mod === 'expenses' || mod === 'plot_registry_payments') {
      const particular = txn.particular || '';
      // Try to extract a useful search term
      const q = particular ? `?q=${encodeURIComponent(particular.replace(/^EXPENSE ENTRY\s*[-–]?\s*/i, '').split(' - ')[0] || '')}` : '';
      navigate(mod === 'expenses' ? `/expenses${q}` : '/plot-registry');
    } else if (mod === 'farmer_payments') {
      navigate('/farmers');
    } else if (mod === 'vendor_payments') {
      navigate('/vendors');
    } else if (mod === 'firm_transactions') {
      navigate('/firm-transactions');
    } else if (mod === 'day_book') {
      navigate('/daybook');
    } else {
      navigate('/cashflow');
    }
  }, [navigate]);

  // fetchSiteCashFlowSummary intentionally removed — see note above. The
  // expensive /cashflow/months REST call it triggered served no UI purpose.
  // Kept as a no-op to preserve the existing Promise.all signature below.
  const fetchSiteCashFlowSummary = useCallback(async () => { /* no-op */ }, []);

  // Track whether initial data has loaded (to suppress loading spinners on bg refresh)
  const hasLoadedOnceRef = useRef(false);
  // Phase 2 (charts/analytics) ready flag — prevents rendering heavy Recharts until critical data is painted
  const [deferredReady, setDeferredReady] = useState(false);
  const lastRefreshRef = useRef(0);

  // ── Verify Data Dialog (legacy REST-based, kept alongside GraphQL VerifyPanel) ──
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleVerifyData = useCallback(async () => {
    if (!currentSite?.id) return;
    setVerifyOpen(true);
    setVerifyLoading(true);
    try {
      const res = await api.get('/daybook/verify-data', { params: { site_id: currentSite.id } });
      setVerifyData(res.data.modules || []);
    } catch {
      setVerifyData(null);
    } finally {
      setVerifyLoading(false);
    }
  }, [currentSite?.id]);

  // Approvals card
  const [appTab, setAppTab] = useState(isAdmin ? 'received' : 'sent');  // 'received' | 'sent'
  const [appLoading, setAppLoading] = useState(false);
  const [receivedData, setReceivedData] = useState([]);
  const [sentData, setSentData] = useState([]);
  const [appCounts, setAppCounts] = useState({ total: 0 });
  const [editCounts, setEditCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const fetchApprovals = useCallback(async () => {
    if (!currentSite?.id) return;
    setAppLoading(true);
    try {
      if (isAdmin) {
        // Admin: fetch all endpoints
        const [pendingRes, countsRes, editRes, editCountsRes, imprestRes] = await Promise.all([
          api.get(`/approvals/pending?site_id=${currentSite.id}`),
          api.get(`/approvals/counts?site_id=${currentSite.id}`),
          api.get('/edit-requests/my-requests'),
          api.get(`/edit-requests/counts?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);
        setReceivedData((pendingRes.data.entries || []).slice(0, 8));
        setAppCounts(countsRes.data || { total: 0 });

        const edits = (editRes.data.requests || []).map(r => ({ ...r, _type: 'edit' }));
        const imprests = (imprestRes.data.requests || []).map(r => ({
          ...r,
          _type: 'imprest',
          status: (r.status || '').toLowerCase(),
        }));
        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 8);
        setSentData(merged);

        const ec = editCountsRes.data || { pending: 0, approved: 0, rejected: 0 };
        const impPending = imprests.filter(r => r.status === 'pending').length;
        setEditCounts({ ...ec, pending: (parseInt(ec.pending) || 0) + impPending });
      } else {
        // Sub-admin: only fetch own requests (skip admin-only endpoints)
        const [editRes, imprestRes] = await Promise.all([
          api.get('/edit-requests/my-requests'),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);

        const edits = (editRes.data.requests || []).map(r => ({ ...r, _type: 'edit' }));
        const imprests = (imprestRes.data.requests || []).map(r => ({
          ...r,
          _type: 'imprest',
          status: (r.status || '').toLowerCase(),
        }));
        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 8);
        setSentData(merged);

        const impPending = imprests.filter(r => r.status === 'pending').length;
        const editPending = edits.filter(r => r.status === 'pending').length;
        setEditCounts({ pending: editPending + impPending, approved: 0, rejected: 0 });
      }
    } catch {
      setReceivedData([]); setSentData([]);
    } finally {
      setAppLoading(false);
    }
  }, [currentSite?.id, isAdmin]);

  useEffect(() => {
    if (!currentSite?.id) return;
    let cancelled = false;
    setDeferredReady(false);

    // Phase 1: Above-fold critical data (transactions + approvals — KPIs now via GraphQL)
    Promise.all([
      fetchTransactions(1),
      fetchApprovals(),
    ]).then(() => {
      if (cancelled) return;
      // Phase 2: Below-fold analytics & charts (staggered after UI is interactive)
      setDeferredReady(true);
      lastRefreshRef.current = Date.now();
      fetchSiteCashFlowSummary();
    });

    hasLoadedOnceRef.current = true;
    return () => { cancelled = true; };
  }, [currentSite?.id, fetchTransactions, fetchApprovals, fetchSiteCashFlowSummary]);

  // Auto-refresh dashboard silently when data is mutated or tab re-focused
  useEffect(() => {
    if (!currentSite?.id) return;
    let debounceTimer = null;
    const refresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        lastRefreshRef.current = Date.now();
        // Stagger: critical first, then analytics
        Promise.allSettled([
          fetchTransactions(1),
          fetchApprovals(),
        ]).then(() => {
          fetchSiteCashFlowSummary();
          // Refresh every active KPI, chart, category, and verification query.
          // A mutation can affect all of them, so refreshing only the KPI card
          // query would leave the charts visibly stale.
          void apolloClient.refetchQueries({ include: 'active' });
        });
      }, 600);
    };
    const onMutated = () => refresh();
    eventBus.on('data-mutated', onMutated);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && hasLoadedOnceRef.current) {
        // Skip if refreshed less than 30s ago
        if (Date.now() - lastRefreshRef.current < 30000) return;
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      eventBus.off('data-mutated', onMutated);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(debounceTimer);
    };
  }, [currentSite?.id, fetchTransactions, fetchSiteCashFlowSummary, fetchApprovals]);

  useEffect(() => {
    if (!currentSite?.id) {
      setMemberResults([]);
      setPlotResults([]);
      setMemberSearchLoading(false);
      setMemberModulesById({});
      setMemberModuleLoadingById({});
      modulesCacheRef.current.clear();
      return;
    }

    const query = memberSearchQuery.trim();
    if (query.length < 2) {
      setMemberResults([]);
      setPlotResults([]);
      setMemberSearchLoading(false);
      lastFetchedQueryRef.current = '';
      return;
    }

    // Skip fetch if we already have cached results for this exact query (e.g. on remount)
    if (query === lastFetchedQueryRef.current && (memberResults.length > 0 || plotResults.length > 0)) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setMemberSearchLoading(true);
      try {
        const [memberRes, monthsRes, plotRes] = await Promise.all([
          api.get('/members/search', { params: { site_id: currentSite.id, q: query } }),
          canReadCashflow ? api.get('/cashflow/months', { params: { site_id: currentSite.id } }) : Promise.resolve({ data: { months: [] } }),
          canReadPlots ? api.get('/plots/search', { params: { site_id: currentSite.id, q: query } }) : Promise.resolve({ data: { plots: [] } }),
        ]);

        const members = (memberRes.data?.members || []).map((m) => ({ ...m, _kind: 'member' }));
        const ledgers = (monthsRes.data?.months || [])
          .filter((m) => m.ledger_type === 'person' && (m.ledger_name || '').toLowerCase().includes(query.toLowerCase()))
          .map((m) => ({
            id: `ledger-${m.id}`,
            _kind: 'ledger',
            ledger_id: m.id,
            ledger_name: m.ledger_name,
            full_name: m.ledger_name,
            member_type: 'PERSONAL LEDGER',
            phone: null,
            alt_phone: null,
          }));

        const list = [...members, ...ledgers].slice(0, 10);
        const plots = (plotRes.data?.plots || []).map((p) => ({ ...p, _kind: 'plot' }));

        if (!cancelled) {
          setMemberResults(list);
          setPlotResults(plots);
          lastFetchedQueryRef.current = query;
          const modulesFromCache = {};
          const immediateModules = {};
          list.forEach((entity) => {
            const key = getSearchEntityKey(entity);
            if (modulesCacheRef.current.has(key)) {
              modulesFromCache[key] = modulesCacheRef.current.get(key);
            }

            if (entity._kind === 'ledger') {
              const ledgerCfg = MEMBER_MODULE_CONFIG.personal_ledger;
              const modules = hasPermission(ledgerCfg.module, 'read')
                ? [{ key: 'personal_ledger', count: 1, ...ledgerCfg }]
                : [];
              immediateModules[key] = modules;
              modulesCacheRef.current.set(key, modules);
            }
          });

          if (Object.keys(modulesFromCache).length > 0 || Object.keys(immediateModules).length > 0) {
            setMemberModulesById((prev) => ({ ...prev, ...modulesFromCache, ...immediateModules }));
          }
        }
      } catch {
        if (!cancelled) { setMemberResults([]); setPlotResults([]); }
      } finally {
        if (!cancelled) setMemberSearchLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [memberSearchQuery, currentSite?.id, canReadCashflow, canReadPlots, hasPermission, memberResults.length, plotResults.length]);

  useEffect(() => {
    if (!currentSite?.id || memberResults.length === 0) return;

    const toFetch = memberResults.filter((m) => m._kind === 'member' && !modulesCacheRef.current.has(getSearchEntityKey(m)));
    if (toFetch.length === 0) return;

    let cancelled = false;
    setMemberModuleLoadingById((prev) => {
      const next = { ...prev };
      toFetch.forEach((m) => { next[getSearchEntityKey(m)] = true; });
      return next;
    });

    Promise.allSettled(
      toFetch.map(async (member) => {
        try {
          const res = await api.get(`/members/${member.id}/financial-info`, { params: { site_id: currentSite.id } });
          const summary = res.data?.summary || {};
          const modules = [];

          const profileCfg = MEMBER_MODULE_CONFIG.clients;
          if (hasPermission(profileCfg.module, 'read')) {
            modules.push({ key: 'clients', count: 1, ...profileCfg });
          }

          Object.entries({
            expenses: summary.expenses?.count || 0,
            commissions: summary.commissions?.count || 0,
            plot_payments: summary.plot_payments?.count || 0,
            farmer_payments: summary.farmer_payments?.count || 0,
            firm_transactions: summary.firm_transactions?.count || 0,
          }).forEach(([key, count]) => {
            if (!count) return;
            const cfg = MEMBER_MODULE_CONFIG[key];
            if (!cfg || !hasPermission(cfg.module, 'read')) return;
            modules.push({ key, count, ...cfg });
          });

          const cacheKey = getSearchEntityKey(member);
          modulesCacheRef.current.set(cacheKey, modules);
          trimModuleCache();
          if (!cancelled) {
            setMemberModulesById((prev) => ({ ...prev, [cacheKey]: modules }));
          }
        } catch {
          if (!cancelled) {
            setMemberModulesById((prev) => ({ ...prev, [getSearchEntityKey(member)]: [] }));
          }
        } finally {
          if (!cancelled) {
            setMemberModuleLoadingById((prev) => ({ ...prev, [getSearchEntityKey(member)]: false }));
          }
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [memberResults, currentSite?.id, hasPermission, trimModuleCache]);

  const activeSites = useMemo(() => sites.filter(s => s.status === 'active').length, [sites]);
  const pendingWork = useMemo(() => isAdmin ? (parseInt(appCounts.total, 10) || 0) : (parseInt(editCounts.pending, 10) || 0), [isAdmin, appCounts.total, editCounts.pending]);

  // Exact plot-number hit for the quick-search: pressing Enter on "A67" jumps
  // straight to that plot's detail page (/plot-payments/:id). Falls back to the
  // first plot result so a unique near-match still resolves on Enter.
  const exactPlotMatch = useMemo(() => {
    const q = memberSearchQuery.trim().toUpperCase();
    if (!q) return null;
    return plotResults.find((p) => String(p.plot_no || '').toUpperCase() === q) || null;
  }, [plotResults, memberSearchQuery]);

  const visibleWorkspaceCards = [
    ...MODULE_CARDS.filter((item) => hasPermission(item.module, 'read')),
    ...(isAdmin ? ADMIN_CARDS : []),
  ];
  const visibleApprovalItems = (appTab === 'received' ? receivedData : sentData).slice(0, 4);

  return (
    <div className="relative isolate min-h-screen w-full max-w-[1680px] mx-auto bg-[#f5f7fb] p-3 sm:p-5 lg:p-7">
      {/* Quiet dashboard canvas */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-x-0 top-0 h-80 opacity-60"
          style={{ background: 'linear-gradient(180deg, rgba(226,232,240,.7) 0%, rgba(245,247,251,0) 100%)' }}
        />
      </div>

      {/* ═══ Welcome Header ═══ */}
      <MotionDiv
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative mb-5 flex flex-col gap-5 overflow-visible rounded-[28px] bg-slate-950 px-5 py-5 text-white shadow-xl shadow-slate-900/10 lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:py-6"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden="true">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-px w-1/3 bg-linear-to-r from-transparent via-cyan-400/50 to-transparent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Welcome, <span className="text-cyan-300">{user?.name || 'User'}</span>
            </h1>
            <MotionSpan
              animate={{ rotate: [0, 16, -8, 12, 0] }}
              transition={{ duration: 1.4, delay: 0.5, ease: 'easeInOut' }}
              className="hidden sm:inline-block text-2xl origin-[70%_70%]"
              aria-hidden="true"
            >
              👋
            </MotionSpan>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {currentSite?.name ? `${currentSite.name} · live overview` : 'Your personal dashboard overview'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-slate-200 ring-1 ring-white/10"><MapPin className="h-3 w-3 text-cyan-300" />{activeSites} active site{activeSites === 1 ? '' : 's'}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-slate-200 ring-1 ring-white/10"><Clock className="h-3 w-3 text-amber-300" />{pendingWork} pending action{pendingWork === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-3 [&>div]:flex-wrap">
            <QuickEntry />
          </div>
        </div>
        {currentSite && canSee('member_search') && (
          <div className="relative z-10 w-full lg:w-[28rem] xl:w-[34rem] lg:shrink-0 group">
            <div className="relative flex items-center">
              <div className="absolute left-1 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center pointer-events-none group-focus-within:bg-blue-100 transition-colors">
                <Search className="h-4 w-4 text-blue-500" />
              </div>
              <Input
                placeholder="Search plot no., users, ledgers..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !memberSearchQuery.trim()) return;
                  // Plot number typed (e.g. "A67") → jump to the plot detail page.
                  // Prefer an exact plot_no hit; otherwise the single best plot match.
                  const plot = exactPlotMatch || (memberResults.length === 0 && plotResults.length > 0 ? plotResults[0] : null);
                  if (plot) {
                    navigate(`/plot-payments/${plot.id}`);
                  } else {
                    navigate(`/clients?q=${encodeURIComponent(memberSearchQuery.trim())}`);
                  }
                }}
                className="pl-13 pr-4 h-12 rounded-full border-white/10 bg-white text-slate-900 shadow-lg shadow-black/10 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:border-cyan-300 transition-all placeholder:text-slate-400"
              />
              {memberSearchQuery.trim() && (
                <button onClick={() => setMemberSearchQuery('')} className="absolute right-3 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <X className="w-3 h-3 text-slate-500" />
                </button>
              )}
            </div>
            {/* Search Results Dropdown */}
            {memberSearchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-slate-300/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                {memberSearchLoading ? (
                  <div className="space-y-3 px-4 py-4">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-2.5 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : memberSearchQuery.trim().length < 2 ? (
                  <div className="py-4 px-4 text-xs text-slate-500">Type 2+ chars to search.</div>
                ) : (memberResults.length === 0 && plotResults.length === 0) ? (
                  <div className="py-4 px-4 text-xs text-slate-500">
                    No results for &quot;{memberSearchQuery.trim()}&quot;
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {/* Plots — jump straight to the plot detail page */}
                    {plotResults.length > 0 && (
                      <div>
                        {memberResults.length > 0 && (
                          <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Plots</div>
                        )}
                        <div className="divide-y divide-slate-100">
                          {plotResults.map((plot) => (
                            <button key={`plot-${plot.id}`} type="button"
                              onClick={() => navigate(`/plot-payments/${plot.id}`)}
                              className="w-full text-left px-4 py-3 hover:bg-rose-50/60 transition-colors flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                                  <LayoutGrid className="w-4 h-4 text-rose-500" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">
                                    Plot {plot.plot_no}{plot.block ? ` · ${plot.block}` : ''}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">{plot.buyer_name || plot.booking_by || 'No buyer'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {plot.status && (
                                  <span className="text-[10px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-slate-100">{plot.status}</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-slate-300" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* People & ledgers */}
                    {memberResults.length > 0 && (
                    <div>
                      {plotResults.length > 0 && (
                        <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">People &amp; Ledgers</div>
                      )}
                      <div className="divide-y divide-slate-100">
                    {memberResults.map((member) => {
                      const entityKey = getSearchEntityKey(member);
                      const modules = memberModulesById[entityKey] || [];
                      const loadingModules = !!memberModuleLoadingById[entityKey];
                      const isLedgerResult = member._kind === 'ledger';
                      return (
                        <div key={entityKey} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{member.full_name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                <span>{member.member_type || 'Member'}</span>
                                {!isLedgerResult && (member.phone || member.alt_phone) && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Phone className="w-3 h-3" /> {member.phone || member.alt_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button size="sm" className="h-7 text-xs shrink-0 px-3 rounded-lg"
                              onClick={() => navigate(isLedgerResult ? `/cashflow?q=${encodeURIComponent(member.full_name || '')}` : `/clients/${member.id}`)}>
                              {isLedgerResult ? 'Ledger' : 'Profile'}
                            </Button>
                          </div>
                          <div className="mt-2">
                            {loadingModules ? (
                              <div className="flex flex-wrap gap-1.5">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                              </div>
                            ) : modules.length === 0 ? (
                              <p className="text-xs text-slate-400">No modules yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {modules.map((mod) => {
                                  const ModIcon = mod.icon;
                                  return (
                                    <button key={`${entityKey}-${mod.key}`} type="button"
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${mod.cls}`}
                                      onClick={() => navigate(mod.to(member))}>
                                      <ModIcon className="w-3 h-3" /> {mod.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </MotionDiv>

      {/* ═══ Main Dashboard ═══ */}
      <div className="space-y-5">

        {visibleWorkspaceCards.length > 0 && (
          <section className="rounded-[24px] border border-slate-200/80 bg-white px-3 py-2 shadow-sm shadow-slate-900/[0.02]">
            <div className="flex items-center justify-between px-2 py-1"><div><p className="text-xs font-semibold text-slate-800">Workspace</p><p className="text-[10px] text-slate-400">Jump into an accounting workflow</p></div><Link to={isAdmin ? '/pending-approvals' : '/edit-approvals'} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">{pendingWork} pending <ChevronRight className="h-3 w-3" /></Link></div>
            <WorkspaceRail items={visibleWorkspaceCards} />
            <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 px-2 pt-3 lg:flex-row lg:items-center">
              <div className="flex shrink-0 items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Clock className="h-3.5 w-3.5" /></span><span className="text-[11px] font-semibold text-slate-600">Approval timeline</span>{isAdmin && <div className="flex rounded-full bg-slate-100 p-0.5 text-[9px] font-semibold"><button type="button" onClick={() => setAppTab('received')} className={`rounded-full px-2 py-1 ${appTab === 'received' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Received</button><button type="button" onClick={() => setAppTab('sent')} className={`rounded-full px-2 py-1 ${appTab === 'sent' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Sent</button></div>}</div>
              <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {appLoading ? [...Array(3)].map((_, index) => <Skeleton key={index} className="h-8 min-w-44 rounded-full" />) : visibleApprovalItems.length === 0 ? <span className="text-[10px] text-slate-400">No approval activity to show.</span> : visibleApprovalItems.map((item, index) => <span key={`${item._type || item.source || 'approval'}-${item.id || index}`} className="inline-flex min-w-44 items-center gap-2 text-[10px]"><span className={`h-2 w-2 shrink-0 rounded-full ${String(item.status || 'pending').toLowerCase() === 'approved' ? 'bg-emerald-500' : String(item.status || 'pending').toLowerCase() === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} /><span className="min-w-0"><span className="block truncate font-medium text-slate-600">{item.entry_label || item.reason || item.description || item.module || item._type || 'Approval request'}</span><span className="block text-[9px] text-slate-400">{fmtDate(item.created_at || item.date)}</span></span></span>)}
              </div>
            </div>
          </section>
        )}

        {currentSite && canSee('financial_overview') && (
          <FinancialPulseBoard
            kpi={kpi}
            loading={kpiLoading}
            canSee={canSee}
            timePreset={timePreset}
            setTimePreset={setTimePreset}
            excludeOldPlots={excludeOldPlots}
            setExcludeOldPlots={setExcludeOldPlots}
            registryIncludeOld={registryIncludeOld}
            setRegistryIncludeOld={setRegistryIncludeOld}
            onRefresh={() => refetchKpi()}
            onVerify={handleVerifyData}
            onSelect={setKpiModal}
          />
        )}

        {/* ── KPI Detail Modal ── */}
        <Dialog open={!!kpiModal} onOpenChange={(open) => !open && setKpiModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {kpiModal === 'totalIncoming' && 'Total Incoming — Breakdown'}
                {kpiModal === 'totalExpense' && 'Total Expenses — Breakdown'}
                {kpiModal === 'profit' && 'Profit — Calculation'}
                {kpiModal === 'personalLedger' && 'Personal Ledger — Details'}
                {kpiModal === 'siteBalance' && 'Site Balance — Calculation'}
                {kpiModal === 'registryPayments' && 'Registry Payments — Details'}
              </DialogTitle>
            </DialogHeader>
            {kpi && (
              <div className="space-y-4 mt-2">
                {/* ── Total Incoming ── */}
                {kpiModal === 'totalIncoming' && (() => {
                  const pp = kpi.breakdown?.find(b => b.module === 'plot_payments');
                  const plotRev = parseFloat(pp?.credit || kpi.totalRevenue) || 0;
                  const modalIncoming = parseFloat(kpi.totalIncoming) || 0;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Source: approved cash-flow credits in the selected period</p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Approved ledger credits</span>
                          <span className="font-bold text-blue-700 tabular-nums">₹{fmt(modalIncoming)}</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Plot receipts within incoming</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">₹{fmt(plotRev)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">Informational subset only; it is not added again.</p>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Total Incoming</span>
                        <span className="text-emerald-700 tabular-nums">₹{fmt(modalIncoming)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Total Expenses ── */}
                {kpiModal === 'totalExpense' && (() => {
                  const expModules = (kpi.breakdown || []).filter(b => b.module !== 'plot_payments' && b.debit > 0);
                  const moduleLabels = {
                    farmer_payments: 'Farmer Payments',
                    expenses: 'Expense Module',
                    plot_commissions: 'Legacy Plot Commissions',
                    commission_payments: 'Commission Payments',
                    vendor_payments: 'Vendor Payments',
                    daybook_expense: 'Day Book (Orphan)',
                  };
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Approved farmer + expense + commission + vendor + orphan Day Book rows</p>
                      <div className="space-y-1.5">
                        {expModules.map((m) => (
                          <div key={m.module} className="flex justify-between items-center text-sm bg-red-50/60 border border-red-100 rounded-lg px-3 py-2">
                            <span className="text-slate-600">{moduleLabels[m.module] || m.module.replace(/_/g, ' ')}</span>
                            <div className="text-right">
                              <span className="font-semibold text-red-700 tabular-nums">₹{fmt(m.debit)}</span>
                              <span className="text-[10px] text-slate-400 ml-2">({m.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Total Expenses</span>
                        <span className="text-red-700 tabular-nums">₹{fmt(kpi.totalExpense)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Profit ── */}
                {kpiModal === 'profit' && (() => {
                  const isPos = kpi.netProfit >= 0;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Formula: Plot Revenue − Total Expenses</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Plot Revenue (Payments + Installments)</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">+ ₹{fmt(kpi.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Total Expenses</span>
                          <span className="font-semibold text-red-700 tabular-nums">− ₹{fmt(kpi.totalExpense)}</span>
                        </div>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Net Profit</span>
                        <span className={`tabular-nums ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isPos ? '' : '-'}₹{fmt(Math.abs(kpi.netProfit))}
                        </span>
                      </div>
                      {kpi.profitMargin !== 0 && (
                        <p className="text-xs text-slate-400 text-right">Margin: {kpi.profitMargin}%</p>
                      )}
                    </div>
                  );
                })()}

                {/* ── Personal Ledger ── */}
                {kpiModal === 'personalLedger' && kpi.outstandingDetail && (() => {
                  const { given, returned, pending } = kpi.outstandingDetail;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Formula: Given − Received = Pending</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Given (Debit)</span>
                          <span className="font-semibold text-red-700 tabular-nums">₹{fmt(given)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Received (Credit)</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">₹{fmt(returned)}</span>
                        </div>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Pending (Outstanding)</span>
                        <span className={`tabular-nums ${pending >= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          ₹{fmt(Math.abs(pending))}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Site Balance ── */}
                {kpiModal === 'siteBalance' && (() => {
                  const openingBalance = parseFloat(kpi.openingBalance) || 0;
                  const totalIncoming = parseFloat(kpi.totalIncoming) || 0;
                  const totalOutgoing = parseFloat(kpi.totalOutgoing) || 0;
                  const siteBalance = parseFloat(kpi.siteBalance) || 0;
                  const imprest = parseFloat(kpi.imprestGiven) || 0;
                  const imprestDistribution = Array.isArray(kpi.imprestDistribution) ? kpi.imprestDistribution : [];
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Closing = Opening Balance + Total Incoming − Total Outgoing</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Opening Balance</span>
                          <span className="font-semibold text-slate-700 tabular-nums">₹{fmt(openingBalance)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">+ Total Incoming</span>
                          <span className="font-semibold text-blue-700 tabular-nums">₹{fmt(totalIncoming)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">− Total Outgoing</span>
                          <span className="font-semibold text-red-700 tabular-nums">₹{fmt(totalOutgoing)}</span>
                        </div>
                      </div>
                      <div className="border rounded-lg bg-orange-50/50 border-orange-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-orange-800">Imprest Tracking (Informational)</span>
                          <span className="text-xs font-semibold text-orange-700">₹{fmt(imprest)}</span>
                        </div>
                        <p className="text-[11px] text-orange-700">Internal imprest transfers are not added to or subtracted from the closing balance.</p>
                        {imprestDistribution.length > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-auto pr-1">
                            {imprestDistribution.map((row) => (
                              <div key={row.subAdminId} className="flex items-center justify-between text-xs bg-white border border-orange-100 rounded-md px-2.5 py-1.5">
                                <span className="text-slate-700 truncate pr-2">{row.recipientName}</span>
                                <span className="font-semibold text-orange-700 tabular-nums whitespace-nowrap">₹{fmt(row.totalAmount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No imprest distribution found in this time range.</p>
                        )}
                      </div>

                      {(() => {
                        const pairs = Array.isArray(kpi.imprestPairs) ? kpi.imprestPairs : [];
                        if (pairs.length === 0) return null;
                        const totalTransferred = pairs.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
                        const roleBadge = (role) => role === 'sub_admin' ? 'Sub' : role === 'super_admin' ? 'Super' : 'Admin';
                        return (
                          <div className="border rounded-lg bg-sky-50/60 border-sky-200 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-sky-800">Imprest Transfers — Who gave to whom</span>
                              <span className="text-[10px] font-semibold text-sky-700">Final amount · {pairs.length} pair{pairs.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                              {pairs.map((p) => (
                                <div key={`${p.giverId}-${p.receiverId}`} className="flex items-center justify-between gap-2 text-xs bg-white border border-sky-100 rounded-md px-2.5 py-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="text-slate-700 truncate font-medium">{p.giverName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{roleBadge(p.giverRole)}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-slate-700 truncate font-medium">{p.receiverName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{roleBadge(p.receiverRole)}</span>
                                  </div>
                                  <span className="font-semibold text-sky-700 tabular-nums whitespace-nowrap">₹{fmt(p.totalAmount)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-sky-100">
                              <span className="text-slate-500">Total transferred (net per-pair)</span>
                              <span className="font-semibold text-sky-700 tabular-nums">₹{fmt(totalTransferred)}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Closing Site Balance</span>
                        <span className={`tabular-nums ${siteBalance >= 0 ? 'text-cyan-700' : 'text-red-700'}`}>
                          {siteBalance < 0 ? '-' : ''}₹{fmt(Math.abs(siteBalance))}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Registry Payments ── */}
                {kpiModal === 'registryPayments' && (() => {
                  const regTotal = parseFloat(kpi.registryPayments) || 0;
                  const regNew   = parseFloat(kpi.registryPaymentsNew) || 0;
                  const regOld   = parseFloat(kpi.registryPaymentsOld) || 0;
                  const regCount    = parseInt(kpi.registryPaymentsCount, 10) || 0;
                  const regNewCount = parseInt(kpi.registryPaymentsNewCount, 10) || 0;
                  const regOldCount = parseInt(kpi.registryPaymentsOldCount, 10) || 0;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">
                        Source: registry mapping → approved source plot payment · selected date period
                      </p>
                      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
                        <div className="flex justify-between items-center text-sm bg-emerald-50/60 border border-emerald-100 rounded-md px-2.5 py-1.5">
                          <span className="text-slate-600">
                            NEW plots <span className="text-[10px] text-slate-400 ml-1">({regNewCount} payment{regNewCount === 1 ? '' : 's'})</span>
                          </span>
                          <span className="font-semibold text-emerald-700 tabular-nums">₹{fmt(regNew)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm bg-amber-50/60 border border-amber-100 rounded-md px-2.5 py-1.5">
                          <span className="text-slate-600">
                            OLD plots <span className="text-[10px] text-slate-400 ml-1">({regOldCount} payment{regOldCount === 1 ? '' : 's'})</span>
                          </span>
                          <span className="font-semibold text-amber-700 tabular-nums">₹{fmt(regOld)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold border-t border-violet-200 pt-2 mt-1">
                          <span className="text-slate-700">= Total mapped source receipts</span>
                          <span className="text-violet-700 tabular-nums">₹{fmt(regTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-0.5">
                          <span className="text-slate-500">Total payment entries</span>
                          <span className="font-semibold text-violet-700 tabular-nums">{regCount}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 leading-relaxed">
                        This is an <b>informational mapping</b> of each registry record to its underlying
                        approved plot payment in the selected dashboard period. Bounced and returned
                        cheques are excluded.
                        <br /><br />
                        The card defaults to <b>NEW plots only</b>; tick <b>+OLD</b> to include mapped
                        OLD-plot receipts. Registry amounts are never summed again into incoming,
                        outgoing, profit, or site balance; only the underlying payment is financial.
                      </div>
                      <div className="flex justify-end">
                        <Link to="/plot-registry">
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <ExternalLink className="w-3 h-3" /> View Plot Registry
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>

            {/* ── Construction & Inventory cards (own permission gating inside) ── */}
        {currentSite && <ConstructionInventoryCards siteId={currentSite.id} />}

        {/* ── Row 1: Revenue vs Expense | Profit Trend ── */}
        {currentSite && deferredReady && canSee('revenue_charts') && (
          <MotionDiv
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <RevenueVsExpenseChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
            <ProfitTrendChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
          </MotionDiv>
        )}

        {/* ── Row 4: Expense Radar — full width ── */}
        {currentSite && deferredReady && canSee('expense_radar') && (
          <ExpenseByCategoryRadar siteId={currentSite.id} range={range} />
        )}

        {/* ── Row 3: Recent Transactions (2/3) + Analytics sidebar (1/3) ── */}
        {currentSite && canSee('recent_transactions') && (
          <MotionDiv
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {/* Recent Transactions — takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <CreditCard className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-sm font-semibold text-slate-800">Recent Transactions</span>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                      </span>
                    </div>
                    <Link to="/daybook">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-lg hover:shadow-md transition-shadow">
                        <ExternalLink className="w-3 h-3" /> View All
                      </Button>
                    </Link>
                  </div>
                  {txnLoading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : txnData.length === 0 ? (
                    <div className="text-center py-16">
                      <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No transactions found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Transactions from all modules will appear here</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-slate-50/80">
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-8">#</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 hidden sm:table-cell">Type</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Particular</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 hidden md:table-cell">Mode</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Debit (₹)</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Credit (₹)</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 hidden sm:table-cell">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {txnData.map((txn, idx) => {
                              const rawDebit = parseFloat(txn.debit) || 0;
                              const rawCredit = parseFloat(txn.credit) || 0;
                              const debit = rawDebit > 0 ? rawDebit : (rawCredit < 0 ? Math.abs(rawCredit) : 0);
                              const credit = rawCredit > 0 ? rawCredit : (rawDebit < 0 ? Math.abs(rawDebit) : 0);
                              const isRefund = rawCredit < 0 || rawDebit < 0;
                              const chequeCs = txn.cheque_status ? txn.cheque_status.toUpperCase() : null;
                              const st = (chequeCs && STATUS_BADGE[chequeCs]) ? STATUS_BADGE[chequeCs] : (STATUS_BADGE[txn.status] || STATUS_BADGE.pending);
                              const StIcon = st.icon;
                              const srcMod = SOURCE_MODULE_MAP[txn.source_module] || { label: 'Cash Flow', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
                              const modeLabel = (txn.cash_type || '').toUpperCase() || null;
                              return (
                                <TableRow
                                  key={`txn-${txn.id}`}
                                  className="cursor-pointer hover:bg-sky-50/50 transition-colors animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300"
                                  style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}
                                  onClick={() => handleTxnClick(txn)}
                                >
                                  <TableCell className="text-xs text-slate-400 tabular-nums">{(txnPage - 1) * TXN_PER_PAGE + idx + 1}</TableCell>
                                  <TableCell className="text-sm text-slate-700 whitespace-nowrap tabular-nums">{fmtDate(txn.date)}</TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className={`text-[10px] font-medium ${srcMod.cls}`}>{srcMod.label}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm font-medium text-slate-800 line-clamp-1" title={txn.particular}>{txn.particular || '—'}</span>
                                    {txn.plot_no && <span className="text-[10px] text-cyan-600 font-semibold block mt-0.5">Plot: {txn.plot_no}</span>}
                                    {txn.buyer_name && <span className="text-[10px] text-indigo-600 font-medium block mt-0.5">Buyer: {txn.buyer_name}</span>}
                                    {txn.booked_by && <span className="text-[10px] text-violet-600 font-medium block mt-0.5">Booked By: {txn.booked_by}</span>}
                                    {txn.created_by_name && <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Entry By: {txn.created_by_name}</span>}
                                    {isRefund && <span className="text-[10px] text-orange-500 font-medium block mt-0.5">Refund / Adjustment</span>}
                                    {txn.cheque_no && <span className="text-[10px] text-blue-600 font-medium block mt-0.5">Cheque No: {txn.cheque_no}</span>}
                                    {txn.remarks && <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 block" title={txn.remarks}>{txn.remarks}</span>}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {modeLabel ? (
                                      <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[modeLabel] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{modeLabel}</Badge>
                                    ) : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {debit > 0
                                      ? <span className="text-sm font-semibold text-red-600 tabular-nums">{isRefund ? '−' : ''}{fmt(debit)}</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {credit > 0
                                      ? <span className="text-sm font-semibold text-emerald-700 tabular-nums">{fmt(credit)}</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className={`text-[10px] font-medium gap-1 ${st.cls}`}>
                                      <StIcon className="w-3 h-3" /> {st.label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {txnPagination.totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
                          <p className="text-xs text-slate-400">
                            Showing {(txnPage - 1) * TXN_PER_PAGE + 1}–{Math.min(txnPage * TXN_PER_PAGE, txnPagination.totalItems)} of {txnPagination.totalItems}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={txnPage <= 1 || txnLoading} onClick={() => fetchTransactions(txnPage - 1)}>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            {Array.from({ length: txnPagination.totalPages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === txnPagination.totalPages || Math.abs(p - txnPage) <= 1)
                              .reduce((acc, p, i, arr) => {
                                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                              }, [])
                              .map((p, i) =>
                                p === '...'
                                  ? <span key={`dots-${i}`} className="text-xs text-slate-400 px-1">…</span>
                                  : <Button key={p} variant={p === txnPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs rounded-lg" onClick={() => fetchTransactions(p)} disabled={txnLoading}>{p}</Button>
                              )}
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={txnPage >= txnPagination.totalPages || txnLoading} onClick={() => fetchTransactions(txnPage + 1)}>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Analytics info sidebar */}
            <div className="space-y-4">
            

              {/* Module Breakdown */}
              {kpi?.breakdown?.length > 0 && canSee('module_breakdown') && (
                <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
                  <div className="relative p-4">
                    <div className="mb-4 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Activity className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-slate-800">Module Breakdown</p><p className="text-[10px] text-slate-400">Share of financial activity</p></div></div>
                    {kpiLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i}>
                            <div className="flex justify-between mb-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
                            <Skeleton className="h-1.5 w-full" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {kpi.breakdown.map((mod) => {
                          const value = mod.credit > 0 ? mod.credit : mod.debit;
                          if (!value) return null;
                          const total = (kpi.totalRevenue || 0) + (kpi.totalExpense || 0);
                          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                          const isEarn = mod.credit > 0;
                          const colorMap = {
                            plot_payments: 'bg-emerald-400', expenses: 'bg-rose-400',
                            farmer_payments: 'bg-orange-400', commissions: 'bg-purple-400',
                            commission_payments: 'bg-violet-400', vendor_payments: 'bg-amber-400',
                            plot_registry_payments: 'bg-indigo-400', daybook_expense: 'bg-slate-400',
                            personal_ledger_debit: 'bg-pink-400',
                          };
                          return (
                            <div key={mod.module}>
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-slate-600 capitalize">{mod.module.replace(/_/g, ' ')}</span>
                                <span className={`font-medium tabular-nums ${isEarn ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {isEarn ? '+' : '-'}₹{fmt(value)}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <MotionDiv
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ type: 'spring', stiffness: 80, damping: 22 }}
                                  className={`h-1.5 rounded-full ${colorMap[mod.module] || 'bg-slate-400'}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Consistency Verification */}
              {canSee('verify_panel') && <VerifyPanel siteId={currentSite.id} range={range} />}

            </div>
          </MotionDiv>
        )}



      </div>

      {/* ═══ WhatsApp-style Chat FAB ═══ */}
      {canReadChat && (
        <>
          <button
            onClick={() => setChatOpen(prev => !prev)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-linear-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center active:scale-95"
          >
            {chatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            {!chatOpen && chatTotalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                {chatTotalUnread > 99 ? '99+' : chatTotalUnread}
              </span>
            )}
          </button>

          {chatOpen && (
            <div className="fixed bottom-12 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[70vh] max-h-140 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
                {chatActive ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => { setChatActive(null); setChatMessages([]); }} className="p-1 hover:bg-green-700 rounded-lg transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-green-400 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {chatActive.user_photo ? <img src={chatActive.user_photo} alt="" className="object-cover w-full h-full" /> : chatActive.user_name?.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm truncate">{chatActive.user_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-semibold text-sm">Internal Chat</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Link to="/chat" className="p-1.5 hover:bg-green-700 rounded-lg transition-colors" title="Open full chat">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button onClick={() => setChatOpen(false)} className="p-1.5 hover:bg-green-700 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {chatActive ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50" ref={chatContainerRef}>
                    {chatMessages.map(msg => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] mr-1.5 shrink-0 mt-auto">
                              {msg.sender_photo ? <img src={msg.sender_photo} alt="" className="object-cover w-full h-full rounded-full" /> : msg.sender_name?.charAt(0)}
                            </div>
                          )}
                          <div className="max-w-[75%]">
                            <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-green-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                              {msg.message_text && <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.message_text}</p>}
                              {msg.attachment_url && (
                                msg.attachment_url.match(/\.(jpeg|jpg|gif|png)$/) ? (
                                  <img src={msg.attachment_url} alt="attachment" className="mt-1.5 rounded-lg max-w-full h-auto max-h-40 object-contain" />
                                ) : (
                                  <button type="button" onClick={() => openDoc({ url: msg.attachment_url, title: msg.attachment_name || 'Attachment' })} className="flex items-center gap-1 mt-1 text-xs underline opacity-80 hover:opacity-100 cursor-pointer">
                                    <Paperclip className="w-3 h-3" /> Document
                                  </button>
                                )
                              )}
                            </div>
                            <span className={`text-[10px] text-gray-400 mt-0.5 px-1 block ${isMe ? 'text-right' : ''}`}>
                              {format(new Date(msg.created_at), 'p')}{isMe ? ` • ${msg.is_read ? 'Read' : 'Sent'}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-2 bg-white border-t border-gray-100 shrink-0">
                    {chatAttachment && (
                      <div className="mb-1.5 px-2 py-1 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between text-xs">
                        <span className="truncate text-green-700 flex items-center gap-1"><Paperclip className="w-3 h-3 shrink-0" />{chatAttachment.name}</span>
                        <button onClick={() => setChatAttachment(null)} className="text-green-400 hover:text-green-600"><X className="w-3 h-3" /></button>
                      </div>
                    )}
                    <form onSubmit={chatSend} className="flex items-center gap-1.5">
                      <input type="file" ref={chatFileRef} className="hidden" onChange={chatHandleFile} />
                      <button type="button" onClick={() => chatFileRef.current?.click()} disabled={chatUploading}
                        className={`p-2 rounded-lg transition-colors ${chatUploading ? 'text-gray-300 animate-pulse' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border-transparent focus:bg-white focus:border-green-300 focus:ring-1 focus:ring-green-100 rounded-lg px-3 py-2 text-sm outline-none transition-all" />
                      <button type="submit" disabled={(!chatInput.trim() && !chatAttachment) || chatUploading}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 active:scale-95">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-gray-100 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                      <input type="text" placeholder="Search users..." value={chatSearch} onChange={e => setChatSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300 transition-all" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {chatLoading ? (
                      <div className="space-y-2 p-2">
                        {[...Array(5)].map((_, index) => (
                          <div key={index} className="flex items-center gap-2.5 p-2">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-40" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : chatSearch ? (
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Users</p>
                        {chatFilteredUsers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No users found</p>}
                        {chatFilteredUsers.map(u => (
                          <div key={u.id} onClick={() => { chatStartConv(u.id); setChatSearch(''); }}
                            className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                              {u.photo ? <img src={u.photo} alt={u.name} className="object-cover w-full h-full" /> : u.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400">{u.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Recent</p>
                        {chatConversations.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No conversations yet</p>}
                        {chatConversations.map(conv => (
                          <div key={conv.conversation_id} onClick={() => setChatActive({ id: conv.conversation_id, user_name: conv.user_name, user_photo: conv.user_photo, user_id: conv.user_id })}
                            className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 relative">
                              {conv.user_photo ? <img src={conv.user_photo} alt={conv.user_name} className="object-cover w-full h-full" /> : conv.user_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline">
                                <p className="text-sm font-medium text-gray-800 truncate">{conv.user_name}</p>
                                {conv.last_message_time && <span className="text-[10px] text-gray-400 shrink-0 ml-1">{format(new Date(conv.last_message_time), 'p')}</span>}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{conv.last_message || 'No messages yet'}</p>
                            </div>
                            {conv.unread_count > 0 && (
                              <span className="min-w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Verify Data Dialog ── */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Data Consistency Check
            </DialogTitle>
          </DialogHeader>
          {verifyLoading ? (
            <div className="space-y-3 py-2">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : verifyData ? (
            <div className="space-y-2">
              {verifyData.map((m) => (
                <div key={m.module} className={`rounded-lg border p-3 ${m.match ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{m.module}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.match ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.match ? '✓ Match' : '✗ Mismatch'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Source:</span> ₹{fmt(m.sourceTotal)} ({m.sourceCount} rows)
                    </div>
                    <div>
                      <span className="text-slate-400">Cash Flow:</span> ₹{fmt(m.cfeTotal)} ({m.cfeCount} rows)
                    </div>
                  </div>
                  {!m.match && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      Diff: ₹{fmt(Math.abs(m.diff))} | Rows: {Math.abs(m.countDiff)}
                    </div>
                  )}
                  {m.daybookTotal !== undefined && (
                    <div className="mt-1 text-xs text-slate-400">
                      Day Book: ₹{fmt(m.daybookTotal)} ({m.daybookCount} rows)
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-500 py-4 text-center">Failed to load verification data.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
