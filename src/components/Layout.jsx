import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSitePolicy } from '../hooks/useSitePolicy';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import { refreshExistingWebPushToken, subscribeToForegroundPush } from '../lib/pushNotifications';
import {
  Activity, Bell, BookOpen, CalendarClock, CheckCircle2, ChevronRight,
  ChevronsUpDown, Clock, CreditCard, ExternalLink, FileClock,
  FileEdit, Gavel, Inbox, LayoutGrid, Loader2, LogOut, Menu, PanelLeft, Send,
  Settings, ShieldAlert, ShieldCheck, Home, UserRound, Wallet, X, XCircle,
} from 'lucide-react';
import {
  COMPLIANCE_EVENT_META, calendarEventTime, calendarIsoDate, complianceEventDate, complianceEventRoute,
} from './compliance/complianceCalendarMeta';
import { Skeleton } from './ui/skeleton';
import { AnimatedThemeToggler } from './ui/animated-theme-toggler';
import { TooltipProvider } from './ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { useDocViewer } from './DocViewer';
import AppSidebar from './sidebar/AppSidebar';
import WorkspaceDomainModal from './WorkspaceDomainModal';
import KycReminderModal from './kyc/KycReminderModal';
import { useSidebarPreferences } from './sidebar/useSidebarPreferences';
import {
  SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, buildNavigation, flattenNavigation,
} from './sidebar/navConfig';

/* Header title: the deepest navigation entry matching the current route, so
   the label always reads the same in the sidebar and the header. Routes that
   live outside the nav (settings, terms) fall back to their path segment. */
const HEADER_MENU_ROW = 'flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium text-mr-muted transition-colors duration-150 hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset';

const titleFromPath = (pathname) => {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return 'Home';
  return segment.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

// ── Notification helpers ────────────────────────────────────────────
const NOTIF_APPROVAL_MODULE = {
  farmer_payment:     { label: 'Farmer Payment',  cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payment: { label: 'Plot Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Personal Ledger',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Bank Statement Reconciliation', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Project Payment',     cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
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
  plot_payment: 'Project Payment', daybook: 'Day Book',
  daybook_expense: 'Expense', daybook_farmer_payment: 'Farmer Payment',
  daybook_commission: 'Commission', daybook_cashflow: 'Personal Ledger',
  daybook_firm_transaction: 'Bank Statement Reconciliation', daybook_plot_payment: 'Project Payment',
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

const COMPLIANCE_NOTIFICATION_META = {
  COMPLIANCE: { label: 'Compliance', icon: ShieldCheck, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  LICENCE: { label: 'Licence', icon: FileClock, tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  LEGAL_CASE: { label: 'Legal hearing', icon: Gavel, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  LEGAL_NOTICE: { label: 'Legal notice', icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  INSPECTION: { label: 'Inspection', icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  DOCUMENT: { label: 'Document expiry', icon: FileClock, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  SCHEDULED_EVENT: { label: 'Calendar event', icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

const notificationWhen = (value) => (value
  ? new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : 'Recently');

function ComplianceNotificationList({ rows, unreadCount, onOpen, onMarkAll }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">No compliance alerts</p>
          <p className="mt-0.5 text-xs text-slate-400">Upcoming deadlines and escalations will appear here.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/50 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold text-slate-800">Compliance & legal alerts</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Assigned to you for the selected project</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => {
          const meta = COMPLIANCE_NOTIFICATION_META[row.entity_type] || COMPLIANCE_NOTIFICATION_META.COMPLIANCE;
          const Icon = meta.icon;
          const overdue = String(row.notification_type || '').startsWith('OVERDUE');
          const dueToday = row.notification_type === 'DUE_0';
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpen(row)}
              className={`group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5 ${row.read_at ? 'bg-white' : 'bg-blue-50/25'}`}
            >
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.tone}`}>
                <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{meta.label}</span>
                  {overdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">Overdue</span>}
                  {dueToday && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">Due today</span>}
                </span>
                <span className={`mt-1 block truncate text-sm text-slate-800 ${row.read_at ? 'font-medium' : 'font-semibold'}`}>
                  {row.title || 'Compliance reminder'}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500">{row.message}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                  <span>{notificationWhen(row.created_at)}</span>
                  {row.site_name && <><span>·</span><span>{row.site_name}</span></>}
                  {row.due_date && <><span>·</span><span>{row.entity_type === 'SCHEDULED_EVENT' ? 'Scheduled' : 'Due'} {notifFmtDate(row.due_date)}</span></>}
                </span>
              </span>
              <span className="mt-2 flex shrink-0 items-center gap-2">
                {!row.read_at && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteTransition, setSiteTransition] = useState(false);
  const prevSiteRef = useRef(null);
  const shellRef = useRef(null);
  const { user, logout, sites, currentSite, setCurrentSite, isAdmin, hasPermission } = useAuth();
  const sitePolicy = useSitePolicy();
  const { getTerm } = sitePolicy;
  const openDoc = useDocViewer();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    collapsed, toggleCollapsed, width, dragging,
    onPointerDown, onKeyDown, onDoubleClick,
  } = useSidebarPreferences(shellRef);

  const roleLabel = user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Sub-Admin';

  // Header title, resolved against the same permission-filtered nav the
  // sidebar renders — a route the user cannot open can never name the header.
  const pageTitle = useMemo(() => {
    const flat = flattenNavigation(buildNavigation({ hasPermission, isAdmin, getTerm, sitePolicy }));
    const match = flat
      .filter((i) => location.pathname === i.path || location.pathname.startsWith(`${i.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0];
    return match?.label || titleFromPath(location.pathname);
  }, [getTerm, hasPermission, isAdmin, location.pathname, sitePolicy]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id || !hasPermission('compliance', 'read')) return undefined;
    let disposed = false;
    let unsubscribe = () => {};
    refreshExistingWebPushToken().catch(() => {
      // Permission is deliberately never requested during passive app startup.
    });
    subscribeToForegroundPush((payload) => {
      eventBus.emit('data-mutated', { source: 'fcm', type: payload.data?.type });
      if (!('Notification' in globalThis) || globalThis.Notification.permission !== 'granted') return;
      try {
        const notification = new globalThis.Notification(
          payload.notification?.title || 'Calendar notification',
          {
            body: payload.notification?.body || 'A calendar event was scheduled.',
            icon: '/favicon.svg',
            tag: payload.data?.event_id ? `scheduled-event-${payload.data.event_id}` : 'calendar-event',
          },
        );
        notification.onclick = () => {
          globalThis.focus?.();
          navigate(payload.data?.link || '/compliance/calendar');
          notification.close();
        };
      } catch {
        // Some mobile browsers delegate display exclusively to the worker.
      }
    }).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    }).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [hasPermission, navigate, user?.id]);

  // The drawer is an overlay — stop the page behind it from scrolling.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileMenuOpen]);

  // Brief fade transition when site changes
  useEffect(() => {
    if (prevSiteRef.current && currentSite && prevSiteRef.current !== currentSite.id) {
      setSiteTransition(true);
      const timer = setTimeout(() => setSiteTransition(false), 150);
      return () => clearTimeout(timer);
    }
    prevSiteRef.current = currentSite?.id ?? null;
  }, [currentSite]);

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
  const [complianceNotifLoading, setComplianceNotifLoading] = useState(false);
  const [complianceNotifications, setComplianceNotifications] = useState([]);
  const [complianceUnread, setComplianceUnread] = useState(0);
  const [notifUpcoming, setNotifUpcoming] = useState([]);
  const [notifActivity, setNotifActivity] = useState([]);
  const [notifExtrasLoading, setNotifExtrasLoading] = useState(false);
  const canReadCompliance = hasPermission('compliance', 'read');
  const canReadLegal = hasPermission('legal', 'read');
  const complianceNotificationBase = canReadCompliance
    ? '/compliance/notifications'
    : canReadLegal ? '/compliance/legal-notifications' : null;

  const fetchComplianceNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!currentSite?.id || !complianceNotificationBase) {
      setComplianceNotifications([]);
      setComplianceUnread(0);
      return;
    }
    if (!silent) setComplianceNotifLoading(true);
    try {
      const response = await api.get(complianceNotificationBase, { params: { site_id: currentSite.id } });
      setComplianceNotifications(response.data.notifications || []);
      setComplianceUnread(Number(response.data.unread_count) || 0);
    } catch {
      setComplianceNotifications([]);
      setComplianceUnread(0);
    } finally {
      if (!silent) setComplianceNotifLoading(false);
    }
  }, [complianceNotificationBase, currentSite?.id]);

  const openComplianceNotification = async (notification) => {
    if (!notification.read_at && complianceNotificationBase) {
      try {
        await api.patch(`${complianceNotificationBase}/${notification.id}/read`);
        setComplianceNotifications((rows) => rows.map((row) => (
          row.id === notification.id ? { ...row, read_at: new Date().toISOString() } : row
        )));
        setComplianceUnread((count) => Math.max(count - 1, 0));
      } catch {
        // Navigation remains useful even if the read receipt cannot be stored.
      }
    }
    setNotifOpen(false);
    navigate(notification.action_path || '/compliance/dashboard');
  };

  const markAllComplianceNotificationsRead = async () => {
    if (!complianceNotificationBase || !currentSite?.id) return;
    try {
      await api.post(`${complianceNotificationBase}/read-all`, { site_id: currentSite.id });
      const now = new Date().toISOString();
      setComplianceNotifications((rows) => rows.map((row) => ({ ...row, read_at: row.read_at || now })));
      setComplianceUnread(0);
    } catch {
      // Keep the current unread state if the server rejects the request.
    }
  };

  // Upcoming compliance events (next 30 days) + recent daybook activity for
  // the bell's Upcoming and Activity tabs. Either call failing simply leaves
  // that tab empty — the drawer stays usable.
  const fetchNotifExtras = useCallback(async () => {
    if (!currentSite?.id) return;
    setNotifExtrasLoading(true);
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 30);
    const [eventsRes, activityRes] = await Promise.allSettled([
      canReadCompliance
        ? api.get('/compliance/calendar', { params: { site_id: currentSite.id, from: calendarIsoDate(from), to: calendarIsoDate(to) } })
        : Promise.reject(new Error('no permission')),
      api.get(`/daybook/recent?site_id=${currentSite.id}&page=1&limit=10`),
    ]);
    setNotifUpcoming(eventsRes.status === 'fulfilled'
      ? (eventsRes.value.data.events || [])
          .sort((a, b) => complianceEventDate(a.event_date) - complianceEventDate(b.event_date))
          .slice(0, 15)
      : []);
    setNotifActivity(activityRes.status === 'fulfilled' ? (activityRes.value.data.transactions || []) : []);
    setNotifExtrasLoading(false);
  }, [canReadCompliance, currentSite?.id]);

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
        const [pendingRes, editRes, imprestRes] = await Promise.allSettled([
          api.get(`/approvals/pending?site_id=${currentSite.id}&limit=100`),
          api.get(`/edit-requests/my-requests?site_id=${currentSite.id}`),
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
        const approvalTotals = pendingRes.status === 'fulfilled'
          ? (pendingRes.value.data.totals || {})
          : {};
        setNotifTotals({
          debit: (Number(approvalTotals.debit) || 0)
            + pendingImprests.reduce((n, r) => n + (parseFloat(r.amount) || 0), 0),
          credit: Number(approvalTotals.credit) || 0,
        });

        setNotifAppCounts({
          total: pendingRes.status === 'fulfilled'
            ? Number(pendingRes.value.data.total || allPendingEntries.length)
            : 0,
        });

        // Admin's Sent tab = their own edit requests only
        const edits = editRes.status === 'fulfilled'
          ? (editRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'edit' }))
          : [];
        setNotifSent(edits);

        setNotifEditCounts({ pending: edits.filter((request) => request.status === 'pending').length });

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
          debit: Number(assignedRes.status === 'fulfilled' ? assignedRes.value.data.totals?.debit : 0) || 0,
          credit: Number(assignedRes.status === 'fulfilled' ? assignedRes.value.data.totals?.credit : 0) || 0,
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
    if (!currentSite?.id) return;
    fetchNotifApprovals();
    fetchComplianceNotifications();
    fetchNotifExtras();
  }, [currentSite?.id, fetchNotifApprovals, fetchComplianceNotifications, fetchNotifExtras]);

  useEffect(() => {
    if (!currentSite?.id) return;
    const refresh = () => {
      fetchNotifApprovals();
      fetchComplianceNotifications({ silent: true });
      fetchNotifExtras();
    };
    eventBus.on('data-mutated', refresh);
    return () => eventBus.off('data-mutated', refresh);
  }, [currentSite?.id, fetchNotifApprovals, fetchComplianceNotifications, fetchNotifExtras]);

  useEffect(() => {
    if (!currentSite?.id || !complianceNotificationBase) return undefined;
    const timer = setInterval(() => fetchComplianceNotifications({ silent: true }), 60_000);
    return () => clearInterval(timer);
  }, [complianceNotificationBase, currentSite?.id, fetchComplianceNotifications]);

  const imprestPendingCount = notifReceived.filter(r => r._type === 'imprest').length;
  const approvalBadgeCount = isAdmin
    ? (parseInt(notifAppCounts.total) || 0) + imprestPendingCount
    : (parseInt(notifEditCounts.pending) || 0) + notifReceived.length;
  // Bell badge = everything the drawer surfaces that can need attention:
  // approvals, unread compliance alerts, and upcoming calendar events.
  const notifBadgeCount = approvalBadgeCount + complianceUnread + notifUpcoming.length;

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

  const sidebarProps = {
    user,
    sites,
    currentSite,
    onSiteChange: handleSiteChange,
    isAdmin,
    hasPermission,
    approvalsBadge: approvalBadgeCount,
    onLogout: handleLogout,
  };

  /* Drag/keyboard separator. Width is written to --mr-sidebar-width on the
     shell during a drag, so the grid column repaints without React
     re-rendering the dashboard — no refetch, no chart teardown. */
  const resizeHandle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · Double-click to reset"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      className="group absolute inset-y-0 right-0 z-20 hidden w-2 cursor-col-resize touch-none select-none lg:block focus-visible:outline-none"
    >
      <span
        className={`absolute inset-y-0 right-0 w-0.5 transition-colors duration-150 ${
          dragging ? 'bg-mr-blue' : 'bg-transparent group-hover:bg-mr-blue/40 group-focus-visible:bg-mr-blue'
        }`}
      />
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={shellRef}
        style={{ '--mr-sidebar-width': `${collapsed ? 72 : width}px` }}
        className={`flex h-screen overflow-hidden bg-mr-canvas print:h-auto print:flex-col print:overflow-visible md:grid md:grid-cols-[var(--mr-sidebar-width)_minmax(0,1fr)] ${
          dragging ? '' : 'md:transition-[grid-template-columns] md:duration-200 md:ease-out'
        }`}
      >
        {/* ── Mobile drawer ── */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden print:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[min(88vw,320px)] overflow-hidden bg-mr-surface shadow-xl animate-in slide-in-from-left duration-200">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full text-mr-faint transition-colors hover:bg-mr-surface-2 hover:text-mr-text"
              >
                <X className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              </button>
              {/* The drawer never uses the stored desktop width or collapsed state. */}
              <AppSidebar
                {...sidebarProps}
                collapsed={false}
                variant="mobile"
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* ── Desktop sidebar — the grid column itself, no hardcoded margin ── */}
        <aside
          className="relative hidden min-h-0 overflow-hidden border-r border-mr-line bg-mr-surface md:block print:hidden"
        >
          <AppSidebar
            {...sidebarProps}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            resizeHandle={resizeHandle}
          />
        </aside>

        {/* ── Main area ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
          {/* Top bar */}
          {/* ── Top bar ───────────────────────────────────────────────
             Names the page, not the app: the site already leads the
             sidebar, so it drops to a caption that confirms which site's
             data is on screen while you are deep inside a module. ── */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-mr-line bg-mr-surface px-3 md:px-6 print:hidden">
            <div className="flex min-w-0 items-center gap-1.5 md:gap-2.5">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mr-muted transition-colors hover:bg-mr-surface-2 hover:text-mr-text md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
              </button>
              {/* Sole collapse control — the sidebar no longer carries its own. */}
              <button
                onClick={toggleCollapsed}
                className="-ml-1.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-control text-mr-faint transition-colors duration-150 hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue lg:flex"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <PanelLeft
                  className={`h-[18px] w-[18px] transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </button>
              <span className="mr-1 hidden h-7 w-px bg-mr-line lg:block" aria-hidden="true" />
              <div className="min-w-0 leading-tight">
                <h1 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-mr-text">{pageTitle}</h1>
                <p className="truncate text-[11.5px] text-mr-faint">
                  {currentSite
                    ? [currentSite.name, currentSite.city].filter(Boolean).join(' · ')
                    : 'No site selected'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <AnimatedThemeToggler className="flex h-9 w-9 items-center justify-center rounded-control text-mr-muted transition-colors duration-150 hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue" />
              <button
                onClick={() => {
                  setNotifOpen(true);
                  setNotifTab(complianceUnread > 0 ? 'compliance' : isAdmin ? 'received' : 'sent');
                  fetchNotifApprovals();
                  fetchComplianceNotifications();
                  fetchNotifExtras();
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-control text-mr-muted transition-colors duration-150 hover:bg-mr-surface-2 hover:text-mr-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue"
                title="Approvals & notifications"
                aria-label={`Approvals and notifications${notifBadgeCount > 0 ? `, ${notifBadgeCount} pending` : ''}`}
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
                {notifBadgeCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mr-coral px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-mr-surface">
                    {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                  </span>
                )}
              </button>
              <span className="mx-1.5 hidden h-7 w-px bg-mr-line sm:block" aria-hidden="true" />

              {/* ── Account menu ── */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors hover:bg-mr-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue sm:pr-2"
                    aria-label={`${user?.name || 'Account'} — open account menu`}
                  >
                    {user?.photo ? (
                      <img src={user.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mr-blue-soft text-[13px] font-semibold text-mr-blue">
                        {user?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                    <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
                      <span className="max-w-[10rem] truncate text-[13px] font-medium text-mr-text">{user?.name || 'Account'}</span>
                      <span className="text-[11px] text-mr-faint">{roleLabel}</span>
                    </span>
                    <ChevronsUpDown className="hidden h-3.5 w-3.5 shrink-0 text-mr-faint lg:block" strokeWidth={2} aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-60 rounded-panel-sm border-mr-line p-1.5">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[13px] font-semibold text-mr-text">{user?.name}</p>
                    <p className="truncate text-[12px] text-mr-faint">{user?.email}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${isAdmin ? 'bg-mr-ink text-white' : 'bg-mr-surface-2 text-mr-muted'}`}>
                      {roleLabel}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-mr-line" />
                  <button type="button" onClick={() => navigate('/settings')} className={HEADER_MENU_ROW}>
                    <UserRound className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Profile
                  </button>
                  {hasPermission('settings', 'read') && (
                    <button type="button" onClick={() => navigate('/settings')} className={HEADER_MENU_ROW}>
                      <Settings className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Account settings
                    </button>
                  )}
                  <div className="my-1 h-px bg-mr-line" />
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium text-mr-coral-ink transition-colors duration-150 hover:bg-mr-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-inset"
                  >
                    <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" /> Sign out
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          {/* Page content */}
          {/* Gutter matches the 24px section gap pages use, so the space around
             a panel reads the same as the space between two panels. Any page
             bleeding past it must negate these exact values at these exact
             breakpoints (-mx-4 md:-mx-6). */}
          <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6 print:overflow-visible print:p-0 print:pb-0">
            <div
              key={location.pathname}
              className={`animate-route-fade-in transition-opacity duration-150 print:animate-none ${siteTransition ? 'opacity-0' : 'opacity-100'}`}
            >
              <Outlet key={currentSite?.id || 'no-site'} />
            </div>
          </main>
        </div>

        {/* ── Mobile bottom navigation ── */}
        <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-mr-line bg-mr-surface md:hidden print:hidden">
          <div className="flex h-16 items-center justify-around px-1">
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
                  className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-control py-1.5 transition-colors duration-200 ${isActive ? 'text-mr-text' : 'text-mr-faint'}`}
                >
                  <tab.icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                  <span className="text-[12px] font-medium">{tab.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-control py-1.5 text-mr-faint transition-colors duration-200"
            >
              <Menu className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
              <span className="text-[12px] font-medium">More</span>
            </button>
          </div>
        </nav>

      {/* First-login intro: appears once, only after a successful sign-in. */}
      <WorkspaceDomainModal />

      {/* Recurring until company verification is done. It defers to the
          intro above and never fires while you are on /settings. */}
      <KycReminderModal />

      {/* ── Notifications / Approvals Sheet ── */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-l-0 bg-white p-0 sm:max-w-xl">
            {/* Header */}
            <SheetHeader className="shrink-0 space-y-0 border-b border-slate-100 px-4 py-4 text-left sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm shadow-blue-200">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold text-slate-900">Notification centre</SheetTitle>
                  <SheetDescription className="text-[11px] text-slate-500">
                    {currentSite?.name || 'No site'} · {notifBadgeCount} item{notifBadgeCount === 1 ? '' : 's'} need attention
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs — one config array, scrollable so five tabs survive a
                narrow drawer without wrapping. */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2 shrink-0 [scrollbar-width:none]">
              {[
                { key: 'received', label: 'Received', Icon: Inbox, count: notifReceived.length, badge: 'bg-amber-100 text-amber-700' },
                { key: 'sent', label: 'Sent', Icon: Send, count: notifSent.length, badge: 'bg-blue-100 text-blue-700' },
                ...(complianceNotificationBase ? [{ key: 'compliance', label: 'Alerts', Icon: ShieldCheck, count: complianceNotifications.length, badge: 'bg-red-100 text-red-700' }] : []),
                ...(canReadCompliance ? [{ key: 'upcoming', label: 'Upcoming', Icon: CalendarClock, count: notifUpcoming.length, badge: 'bg-cyan-100 text-cyan-700' }] : []),
                { key: 'activity', label: 'Activity', Icon: Activity, count: notifActivity.length, badge: 'bg-slate-200 text-slate-600' },
              ].map(({ key, label, Icon, count, badge }) => (
                <button
                  key={key}
                  onClick={() => setNotifTab(key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    notifTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {count > 0 && (
                    <span className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[9px] font-bold ${badge}`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {(notifTab === 'compliance' ? complianceNotifLoading
                : notifTab === 'upcoming' || notifTab === 'activity' ? notifExtrasLoading
                : notifLoading) ? (
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
              ) : notifTab === 'compliance' ? (
                <ComplianceNotificationList
                  rows={complianceNotifications}
                  unreadCount={complianceUnread}
                  onOpen={openComplianceNotification}
                  onMarkAll={markAllComplianceNotificationsRead}
                />
              ) : notifTab === 'upcoming' ? (
                notifUpcoming.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                      <CalendarClock className="h-6 w-6 text-cyan-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">Nothing coming up</p>
                      <p className="mt-0.5 text-xs text-slate-400">Deadlines, hearings and inspections in the next 30 days appear here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifUpcoming.map((event) => {
                      const meta = COMPLIANCE_EVENT_META[event.event_type] || COMPLIANCE_EVENT_META.COMPLIANCE;
                      const EvIcon = meta.Icon;
                      const date = complianceEventDate(event.event_date);
                      const eventTime = calendarEventTime(event);
                      return (
                        <button
                          key={`${event.event_type}-${event.id}`}
                          type="button"
                          onClick={() => { setNotifOpen(false); navigate(complianceEventRoute(event)); }}
                          className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
                        >
                          <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                              {date.toLocaleDateString('en-IN', { month: 'short' })}
                            </span>
                            <span className="-mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                              {date.getDate()}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                              <span className={`flex h-4 w-4 items-center justify-center rounded ${meta.icon}`}>
                                <EvIcon className="h-2.5 w-2.5" />
                              </span>
                              {meta.label}
                              {eventTime && <span className="normal-case tracking-normal tabular-nums text-slate-400">· {eventTime}</span>}
                            </span>
                            <span className="mt-1 block truncate text-sm font-medium text-slate-800">{event.title}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : notifTab === 'activity' ? (
                notifActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                      <Activity className="h-6 w-6 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">No recent activity</p>
                      <p className="mt-0.5 text-xs text-slate-400">The latest ledger entries for this site appear here.</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifActivity.map((txn, i) => {
                      const credit = parseFloat(txn.credit) || 0;
                      const debit = parseFloat(txn.debit) || 0;
                      return (
                        <div key={txn.id || i} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${credit > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600'}`}>
                            <Activity className="h-4 w-4" strokeWidth={1.9} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">{txn.particular || txn.description || 'Ledger entry'}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-400">{notifFmtDate(txn.date || txn.created_at)}</span>
                          </span>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${credit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {credit > 0 ? '+' : '−'}₹{notifFmt(credit || debit)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
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
                {(() => {
                  const count = notifTab === 'compliance' ? complianceNotifications.length
                    : notifTab === 'upcoming' ? notifUpcoming.length
                    : notifTab === 'activity' ? notifActivity.length
                    : notifTab === 'received' ? notifReceived.length
                    : notifSent.length;
                  return `${count} item${count !== 1 ? 's' : ''} shown`;
                })()}
              </p>
              <Link
                to={notifTab === 'compliance'
                  ? (canReadCompliance ? '/compliance/my-tasks' : '/legal/hearings')
                  : notifTab === 'upcoming' ? '/compliance/calendar'
                  : notifTab === 'activity' ? '/daybook'
                  : notifTab === 'received'
                  ? (isAdmin ? '/pending-approvals' : '/imprest')
                  : '/edit-approvals'}
                onClick={() => setNotifOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {notifTab === 'compliance' ? 'Open control centre'
                  : notifTab === 'upcoming' ? 'Open calendar'
                  : notifTab === 'activity' ? 'Open day book'
                  : 'View all'}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
        </SheetContent>
      </Sheet>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
