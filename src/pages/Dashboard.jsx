import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_KPI_CARDS } from '../graphql/queries';
import { apolloClient } from '../graphql/client';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import {
  Users, Tractor, Landmark, Wallet, Banknote, LayoutGrid,
  ClipboardList, CreditCard, MapPin, UserCog, Settings,
  ChevronRight, ExternalLink,
  Search, Phone, AlertTriangle, X, ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTimeRange } from '../components/dashboard/timeRange';
import FinancialHero from '../components/dashboard/FinancialHero';
import FinancialPulseBoard from '../components/dashboard/FinancialPulseBoard';
import WorkflowStrip from '../components/dashboard/WorkflowStrip';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import RecentActivity from '../components/dashboard/RecentActivity';
import ConstructionInventoryCards from '../components/dashboard/ConstructionInventoryCards';
import VerifyPanel from '../components/dashboard/VerifyPanel';
import ComplianceWatchCard from '../components/dashboard/ComplianceWatchCard';
import { RevenueVsExpenseChart, ProfitTrendChart, ExpenseByCategoryRadar } from '../components/dashboard/AnalyticsCharts';
import QuickEntry from '../components/QuickEntry';
import { money } from '../lib/utils';

/* Workflow steps — routes and permission keys unchanged; the per-module
   gradient colours are gone, the strip draws one monochrome icon family. */
const MODULE_CARDS = [
  { to: '/clients', label: 'Clients & users', icon: Users, desc: 'Clients, farmers, members', module: 'clients' },
  { to: '/farmers', label: 'Farmer payments', icon: Tractor, desc: 'Payment records', module: 'farmers' },
  { to: '/commissions', label: 'Plot commission', icon: Landmark, desc: 'Commission calculations', module: 'commissions' },
  { to: '/cashflow', label: 'Cash flow', icon: Wallet, desc: 'Income and expense', module: 'cashflow' },
  { to: '/firm-transactions', label: 'Firm transactions', icon: Banknote, desc: 'Firm-level entries', module: 'firm_transactions' },
  { to: '/plot-payments', label: 'Plot payments', icon: LayoutGrid, desc: 'Payment schedules', module: 'plot_payments' },
  { to: '/plot-registry', label: 'Plot registry', icon: ClipboardList, desc: 'Registry and docs', module: 'plot_registry' },
  { to: '/expenses', label: 'Expenses', icon: CreditCard, desc: 'Vouchers and tracking', module: 'expenses' },
];

const ADMIN_CARDS = [
  { to: '/sites', label: 'Sites', icon: MapPin, desc: 'Manage project sites' },
  { to: '/sub-admins', label: 'Sub-admins', icon: UserCog, desc: 'Access and roles' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Account preferences' },
];

const MEMBER_MODULE_CONFIG = {
  clients: {
    label: 'Profile',
    module: 'clients',
    icon: Users,
    to: (member) => `/clients/${member.id}`,
  },
  expenses: {
    label: 'Expenses',
    module: 'expenses',
    icon: CreditCard,
    to: (member) => `/expenses?q=${encodeURIComponent(member.full_name || '')}`,
  },
  commissions: {
    label: 'Commissions',
    module: 'commissions',
    icon: Landmark,
    to: (member) => `/commissions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  plot_payments: {
    label: 'Plot payments',
    module: 'plot_payments',
    icon: LayoutGrid,
    to: (member) => `/plot-payments?q=${encodeURIComponent(member.full_name || '')}`,
  },
  farmer_payments: {
    label: 'Farmer payments',
    module: 'farmers',
    icon: Tractor,
    to: (member) => `/farmers?q=${encodeURIComponent(member.full_name || '')}`,
  },
  firm_transactions: {
    label: 'Firm transactions',
    module: 'firm_transactions',
    icon: Banknote,
    to: (member) => `/firm-transactions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  personal_ledger: {
    label: 'Personal ledger',
    module: 'cashflow',
    icon: Wallet,
    to: (entity) => `/cashflow?q=${encodeURIComponent(entity.full_name || entity.ledger_name || '')}`,
  },
};

const PERIOD_LABEL = {
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  this_year: 'This year',
  overall: 'All time',
};

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const getSearchEntityKey = (entity) => (
  entity?._kind === 'ledger' ? `ledger-${entity.ledger_id}` : `member-${entity.id}`
);

/* Shared row used by the KPI breakdown dialogs — one neutral surface,
   the value carries the semantic colour instead of the whole box. */
const CalcRow = ({ label, value, tone = 'default', note, prefix }) => {
  const tones = {
    default: 'text-mr-text',
    positive: 'text-mr-lime-ink',
    negative: 'text-mr-coral-ink',
    attention: 'text-mr-amber-ink',
    info: 'text-mr-blue',
  };
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-control bg-mr-surface-2 px-3.5 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13px] text-mr-muted">{label}</span>
        {note && <span className="mt-0.5 block text-[12px] text-mr-faint">{note}</span>}
      </span>
      <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${tones[tone]}`}>
        {prefix}{value}
      </span>
    </div>
  );
};

const CalcTotal = ({ label, value, tone = 'default' }) => {
  const tones = {
    default: 'text-mr-text',
    positive: 'text-mr-lime-ink',
    negative: 'text-mr-coral-ink',
    attention: 'text-mr-amber-ink',
  };
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-mr-line pt-3">
      <span className="text-[14px] font-semibold text-mr-text">{label}</span>
      <span className={`text-[17px] font-semibold tabular-nums ${tones[tone]}`}>{value}</span>
    </div>
  );
};

export const Dashboard = () => {
  const { user, currentSite, sites, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Recent Transactions
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnData, setTxnData] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnPagination, setTxnPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1 });
  const TXN_PER_PAGE = 10;

  const canReadCashflow = hasPermission('cashflow', 'read');
  const canReadPlots = hasPermission('plot_payments', 'read');
  const canReadCompliance = hasPermission('compliance', 'read');

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

  const { data: kpiData, previousData: kpiPrevious, loading: kpiLoading, refetch: refetchKpi } = useQuery(GET_KPI_CARDS, {
    variables: { siteId: String(currentSite?.id), range, excludeOldPlots },
    skip: !currentSite?.id || (!isAdmin && !dashPerms),
    // cache-and-network: render instantly from Apollo's in-memory cache
    // (last successful response for this site + range) and refresh in
    // background. The backend resolver also has Redis caching now, so
    // the network leg is fast even on cache-miss.
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  /* Changing a toggle changes the query variables, and Apollo hands back
     undefined data until the new response lands — which flashed every KPI
     back to a skeleton mid-animation. Hold the previous figures on screen
     and let the count-up run from them to the new ones. */
  const kpi = kpiData?.kpiCards || kpiPrevious?.kpiCards;

  // ── KPI detail modal ──
  const [kpiModal, setKpiModal] = useState(null); // 'totalIncoming' | 'totalExpense' | 'profit' | 'personalLedger' | null
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
  const approvalItems = appTab === 'received' ? receivedData : sentData;
  const approvalsHref = isAdmin ? '/pending-approvals' : '/edit-approvals';

  /* ── Site + people search, rendered inside the hero ── */
  const searchNode = currentSite && canSee('member_search') ? (
    <div className="relative">
      <label htmlFor="mr-dashboard-search" className="sr-only">Search plot numbers, people and ledgers</label>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
        <Input
          id="mr-dashboard-search"
          placeholder="Search plot no., people, ledgers…"
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
          className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-11 pr-11 text-[13px] text-mr-text shadow-none transition-colors placeholder:text-mr-faint focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/25"
        />
        {memberSearchQuery.trim() && (
          <button
            type="button"
            onClick={() => setMemberSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full text-mr-muted transition-colors hover:bg-mr-line-strong/20 hover:text-mr-text"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {memberSearchQuery.trim() && (
        <div className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-panel-sm border border-mr-line bg-mr-surface shadow-xl shadow-black/10 mr-rise">
          {memberSearchLoading ? (
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2].map((index) => (
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
            <p className="px-4 py-4 text-[12px] text-mr-muted">Type at least 2 characters to search.</p>
          ) : (memberResults.length === 0 && plotResults.length === 0) ? (
            <p className="px-4 py-4 text-[12px] text-mr-muted">
              No results for &quot;{memberSearchQuery.trim()}&quot;
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {plotResults.length > 0 && (
                <div>
                  {memberResults.length > 0 && (
                    <p className="px-4 pb-1 pt-3 text-[12px] font-medium text-mr-faint">Plots</p>
                  )}
                  <div className="divide-y divide-mr-line">
                    {plotResults.map((plot) => (
                      <button
                        key={`plot-${plot.id}`}
                        type="button"
                        onClick={() => navigate(`/plot-payments/${plot.id}`)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-mr-surface-2"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-mr-line text-mr-muted">
                            <LayoutGrid className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-mr-text">
                              Plot {plot.plot_no}{plot.block ? ` · ${plot.block}` : ''}
                            </span>
                            <span className="block truncate text-[12px] text-mr-muted">{plot.buyer_name || plot.booking_by || 'No buyer'}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {plot.status && <span className="text-[12px] text-mr-faint">{plot.status}</span>}
                          <ChevronRight className="h-4 w-4 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {memberResults.length > 0 && (
                <div>
                  {plotResults.length > 0 && (
                    <p className="px-4 pb-1 pt-3 text-[12px] font-medium text-mr-faint">People &amp; ledgers</p>
                  )}
                  <div className="divide-y divide-mr-line">
                    {memberResults.map((member) => {
                      const entityKey = getSearchEntityKey(member);
                      const modules = memberModulesById[entityKey] || [];
                      const loadingModules = !!memberModuleLoadingById[entityKey];
                      const isLedgerResult = member._kind === 'ledger';
                      return (
                        <div key={entityKey} className="px-4 py-3 transition-colors hover:bg-mr-surface-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-mr-text">{member.full_name}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[12px] text-mr-muted">
                                <span>{member.member_type || 'Member'}</span>
                                {!isLedgerResult && (member.phone || member.alt_phone) && (
                                  <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3 w-3" strokeWidth={1.9} aria-hidden="true" /> {member.phone || member.alt_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 shrink-0 rounded-full bg-mr-ink px-3.5 text-[12px] hover:bg-mr-ink-2"
                              onClick={() => navigate(isLedgerResult ? `/cashflow?q=${encodeURIComponent(member.full_name || '')}` : `/clients/${member.id}`)}
                            >
                              {isLedgerResult ? 'Ledger' : 'Profile'}
                            </Button>
                          </div>
                          <div className="mt-2">
                            {loadingModules ? (
                              <div className="flex flex-wrap gap-1.5">
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                              </div>
                            ) : modules.length === 0 ? (
                              <p className="text-[12px] text-mr-faint">No modules yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {modules.map((mod) => {
                                  const ModIcon = mod.icon;
                                  return (
                                    <button
                                      key={`${entityKey}-${mod.key}`}
                                      type="button"
                                      className="inline-flex items-center gap-1.5 rounded-full border border-mr-line px-2.5 py-1 text-[12px] font-medium text-mr-muted transition-colors hover:border-mr-ink hover:text-mr-text"
                                      onClick={() => navigate(mod.to(member))}
                                    >
                                      <ModIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> {mod.label}
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
  ) : null;

  return (
    /* Every child here is a rounded, bordered panel, so the page keeps the
       gutter <main> gives it — bleeding to the edge clipped the panel corners
       against the viewport and left the left edge tighter than the right. */
    <div className="w-full space-y-6">
      <FinancialHero
        userName={user?.name}
        siteName={currentSite?.name}
        activeSites={activeSites}
        pendingWork={pendingWork}
        pendingHref={approvalsHref}
        periodLabel={PERIOD_LABEL[timePreset] || 'All time'}
        kpi={kpi}
        loading={kpiLoading && !kpi}
        showBalance={!!currentSite && canSee('kpi_siteBalance')}
        onSelectBalance={() => setKpiModal('siteBalance')}
        actions={<QuickEntry />}
        search={searchNode}
      />

      {currentSite && canSee('financial_overview') && (
        <FinancialPulseBoard
          kpi={kpi}
          loading={kpiLoading && !kpi}
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

      <WorkflowStrip
        items={visibleWorkspaceCards}
        description="Jump into an accounting workflow"
      />

      {currentSite && (
        <div className={`grid gap-6 ${canSee('recent_transactions') ? 'xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
          {canSee('recent_transactions') && (
            <RecentActivity
              transactions={txnData}
              loading={txnLoading}
              page={txnPage}
              pagination={txnPagination}
              perPage={TXN_PER_PAGE}
              onPageChange={fetchTransactions}
              onRowClick={handleTxnClick}
            />
          )}

          <div className="space-y-6">
            {canReadCompliance && canSee('compliance_watch') && (
              <ComplianceWatchCard siteId={currentSite.id} />
            )}
            <AttentionPanel
              items={approvalItems}
              loading={appLoading}
              isAdmin={isAdmin}
              tab={appTab}
              onTabChange={setAppTab}
              pendingCount={pendingWork}
              viewAllHref={approvalsHref}
            />
            {canSee('verify_panel') && <VerifyPanel siteId={currentSite.id} range={range} />}
          </div>
        </div>
      )}

      {/* ── Trends ── */}
      {currentSite && deferredReady && canSee('revenue_charts') && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueVsExpenseChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
          <ProfitTrendChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
        </div>
      )}

      {currentSite && deferredReady && canSee('expense_radar') && (
        <ExpenseByCategoryRadar siteId={currentSite.id} range={range} />
      )}

      {/* ── Construction & Inventory (own permission gating inside) ── */}
      {currentSite && <ConstructionInventoryCards siteId={currentSite.id} />}

      {/* ── KPI Detail Modal ── */}
      <Dialog open={!!kpiModal} onOpenChange={(open) => !open && setKpiModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">
              {kpiModal === 'totalIncoming' && 'Total incoming — breakdown'}
              {kpiModal === 'totalExpense' && 'Total outgoing — breakdown'}
              {kpiModal === 'profit' && 'Net profit — calculation'}
              {kpiModal === 'personalLedger' && 'Personal ledger — details'}
              {kpiModal === 'siteBalance' && 'Site balance — calculation'}
              {kpiModal === 'registryPayments' && 'Registry mapping — details'}
            </DialogTitle>
          </DialogHeader>
          {kpi && (
            <div className="mt-2 space-y-4">
              {/* ── Total Incoming ── */}
              {kpiModal === 'totalIncoming' && (() => {
                const pp = kpi.breakdown?.find(b => b.module === 'plot_payments');
                const plotRev = parseFloat(pp?.credit || kpi.totalRevenue) || 0;
                const modalIncoming = parseFloat(kpi.totalIncoming) || 0;
                return (
                  <div className="space-y-3">
                    <p className="text-[12px] text-mr-muted">Source: approved cash-flow credits in the selected period</p>
                    <CalcRow label="Approved ledger credits" value={money(modalIncoming)} />
                    <CalcRow
                      label="Plot receipts within incoming"
                      note="Informational subset only; it is not added again."
                      value={money(plotRev)}
                      tone="positive"
                    />
                    <CalcTotal label="Total incoming" value={money(modalIncoming)} tone="positive" />
                  </div>
                );
              })()}

              {/* ── Total Expenses ── */}
              {kpiModal === 'totalExpense' && (() => {
                const expModules = (kpi.breakdown || []).filter(b => b.module !== 'plot_payments' && b.debit > 0);
                const moduleLabels = {
                  farmer_payments: 'Farmer payments',
                  expenses: 'Expense module',
                  plot_commissions: 'Legacy plot commissions',
                  commission_payments: 'Commission payments',
                  vendor_payments: 'Vendor payments',
                  daybook_expense: 'Day book (orphan)',
                };
                return (
                  <div className="space-y-3">
                    <p className="text-[12px] text-mr-muted">Approved farmer, expense, commission, vendor and orphan day-book rows</p>
                    <div className="space-y-1.5">
                      {expModules.map((m) => (
                        <CalcRow
                          key={m.module}
                          label={moduleLabels[m.module] || m.module.replace(/_/g, ' ')}
                          note={`${m.count} entr${m.count === 1 ? 'y' : 'ies'}`}
                          value={money(m.debit)}
                          tone="negative"
                        />
                      ))}
                    </div>
                    <CalcTotal label="Total outgoing" value={money(kpi.totalExpense)} tone="negative" />
                  </div>
                );
              })()}

              {/* ── Profit ── */}
              {kpiModal === 'profit' && (() => {
                const isPos = kpi.netProfit >= 0;
                return (
                  <div className="space-y-3">
                    <p className="text-[12px] text-mr-muted">Formula: plot revenue − total outgoing</p>
                    <div className="space-y-1.5">
                      <CalcRow label="Plot revenue (payments + installments)" value={money(kpi.totalRevenue)} tone="positive" prefix="+ " />
                      <CalcRow label="Total outgoing" value={money(kpi.totalExpense)} tone="negative" prefix="− " />
                    </div>
                    <CalcTotal label="Net profit" value={money(kpi.netProfit)} tone={isPos ? 'positive' : 'negative'} />
                    {kpi.profitMargin !== 0 && (
                      <p className="text-right text-[12px] text-mr-faint">Margin: {kpi.profitMargin}%</p>
                    )}
                  </div>
                );
              })()}

              {/* ── Personal Ledger ── */}
              {kpiModal === 'personalLedger' && kpi.outstandingDetail && (() => {
                const { given, returned, pending } = kpi.outstandingDetail;
                return (
                  <div className="space-y-3">
                    <p className="text-[12px] text-mr-muted">Formula: given − received = pending</p>
                    <div className="space-y-1.5">
                      <CalcRow label="Given (debit)" value={money(given)} tone="negative" />
                      <CalcRow label="Received (credit)" value={money(returned)} tone="positive" />
                    </div>
                    <CalcTotal label="Pending (outstanding)" value={money(pending)} tone={pending >= 0 ? 'attention' : 'positive'} />
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
                const pairs = Array.isArray(kpi.imprestPairs) ? kpi.imprestPairs : [];
                const totalTransferred = pairs.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
                const roleBadge = (role) => role === 'sub_admin' ? 'Sub' : role === 'super_admin' ? 'Super' : 'Admin';
                return (
                  <div className="space-y-3">
                    <p className="text-[12px] text-mr-muted">Closing = opening balance + total incoming − total outgoing</p>
                    <div className="space-y-1.5">
                      <CalcRow label="Opening balance" value={money(openingBalance)} />
                      <CalcRow label="Total incoming" value={money(totalIncoming)} tone="positive" prefix="+ " />
                      <CalcRow label="Total outgoing" value={money(totalOutgoing)} tone="negative" prefix="− " />
                    </div>

                    <div className="space-y-2 rounded-control border border-mr-line p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-semibold text-mr-text">Imprest tracking (informational)</span>
                        <span className="text-[13px] font-semibold tabular-nums text-mr-amber-ink">{money(imprest)}</span>
                      </div>
                      <p className="text-[12px] text-mr-muted">Internal imprest transfers are not added to or subtracted from the closing balance.</p>
                      {imprestDistribution.length > 0 ? (
                        <div className="max-h-36 space-y-1.5 overflow-auto pr-1">
                          {imprestDistribution.map((row) => (
                            <div key={row.subAdminId} className="flex items-center justify-between gap-3 rounded-lg bg-mr-surface-2 px-2.5 py-1.5 text-[12px]">
                              <span className="truncate text-mr-muted">{row.recipientName}</span>
                              <span className="shrink-0 font-semibold tabular-nums text-mr-text">{money(row.totalAmount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-mr-faint">No imprest distribution found in this time range.</p>
                      )}
                    </div>

                    {pairs.length > 0 && (
                      <div className="space-y-2 rounded-control border border-mr-line p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-semibold text-mr-text">Imprest transfers — who gave to whom</span>
                          <span className="text-[12px] text-mr-faint">{pairs.length} pair{pairs.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                          {pairs.map((p) => (
                            <div key={`${p.giverId}-${p.receiverId}`} className="flex items-center justify-between gap-2 rounded-lg bg-mr-surface-2 px-2.5 py-1.5 text-[12px]">
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                <span className="truncate font-medium text-mr-text">{p.giverName}</span>
                                <span className="shrink-0 text-mr-faint">{roleBadge(p.giverRole)}</span>
                                <span className="text-mr-faint" aria-label="transferred to">→</span>
                                <span className="truncate font-medium text-mr-text">{p.receiverName}</span>
                                <span className="shrink-0 text-mr-faint">{roleBadge(p.receiverRole)}</span>
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums text-mr-text">{money(p.totalAmount)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-mr-line pt-2 text-[12px]">
                          <span className="text-mr-muted">Total transferred (net per pair)</span>
                          <span className="font-semibold tabular-nums text-mr-text">{money(totalTransferred)}</span>
                        </div>
                      </div>
                    )}

                    <CalcTotal label="Closing site balance" value={money(siteBalance)} tone={siteBalance >= 0 ? 'positive' : 'negative'} />
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
                    <p className="text-[12px] text-mr-muted">
                      Source: registry mapping → approved source plot payment, in the selected period
                    </p>
                    <div className="space-y-1.5">
                      <CalcRow
                        label="New plots"
                        note={`${regNewCount} payment${regNewCount === 1 ? '' : 's'}`}
                        value={money(regNew)}
                        tone="positive"
                      />
                      <CalcRow
                        label="Old plots"
                        note={`${regOldCount} payment${regOldCount === 1 ? '' : 's'}`}
                        value={money(regOld)}
                        tone="attention"
                      />
                      <CalcRow label="Total payment entries" value={regCount} />
                    </div>
                    <CalcTotal label="Total mapped source receipts" value={money(regTotal)} />
                    <p className="rounded-control bg-mr-surface-2 p-3.5 text-[12px] leading-relaxed text-mr-muted">
                      This is an <b className="text-mr-text">informational mapping</b> of each registry record to its
                      underlying approved plot payment. Bounced and returned cheques are excluded. The metric
                      defaults to new plots; tick <b className="text-mr-text">include old</b> to add mapped old-plot
                      receipts. Registry amounts are never summed again into incoming, outgoing, profit or site
                      balance — only the underlying payment is financial.
                    </p>
                    <div className="flex justify-end">
                      <Link to="/plot-registry">
                        <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full text-[12px]">
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> View plot registry
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

      {/* ── Verify Data Dialog ── */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]">
              <ShieldCheck className="h-5 w-5 text-mr-lime-ink" strokeWidth={1.9} aria-hidden="true" />
              Data consistency check
            </DialogTitle>
          </DialogHeader>
          {verifyLoading ? (
            <div className="space-y-3 py-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="rounded-control border border-mr-line p-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : verifyData ? (
            <div className="space-y-2">
              {verifyData.map((m) => (
                <div key={m.module} className="rounded-control border border-mr-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-mr-text">{m.module}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${m.match ? 'bg-mr-lime-soft text-mr-lime-ink' : 'bg-mr-coral-soft text-mr-coral-ink'}`}>
                      {m.match
                        ? <><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Match</>
                        : <><AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" /> Mismatch</>}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-mr-muted">
                    <div><span className="text-mr-faint">Source:</span> ₹{fmt(m.sourceTotal)} ({m.sourceCount} rows)</div>
                    <div><span className="text-mr-faint">Cash flow:</span> ₹{fmt(m.cfeTotal)} ({m.cfeCount} rows)</div>
                  </div>
                  {!m.match && (
                    <p className="mt-1 text-[12px] font-medium text-mr-coral-ink">
                      Difference: ₹{fmt(Math.abs(m.diff))} · rows: {Math.abs(m.countDiff)}
                    </p>
                  )}
                  {m.daybookTotal !== undefined && (
                    <p className="mt-1 text-[12px] text-mr-faint">Day book: ₹{fmt(m.daybookTotal)} ({m.daybookCount} rows)</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-[13px] font-medium text-mr-text">Verification could not be loaded</p>
              <p className="mt-1 text-[12px] text-mr-muted">Please try again in a moment.</p>
              <Button variant="outline" size="sm" className="mt-3 h-9 rounded-full text-[12px]" onClick={handleVerifyData}>
                Try again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
