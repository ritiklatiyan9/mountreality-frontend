import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownToLine, Bell, Building2, CalendarClock, CheckCircle2, CircleDollarSign,
  ClipboardCheck, CreditCard, FileText, HardHat, Home, Landmark, Loader2, LogOut,
  MessageSquare, RefreshCw, ShieldCheck, Sparkles, WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import PortalDiscussionDialog from '../components/phase4/PortalDiscussionDialog';
import { cn } from '../lib/utils';

const TYPE_META = {
  BUYER: { label: 'Buyer workspace', short: 'Buyer', icon: Home, accent: 'text-mr-blue', soft: 'bg-mr-blue-soft' },
  BROKER: { label: 'Broker workspace', short: 'Broker', icon: Landmark, accent: 'text-mr-aqua-ink', soft: 'bg-mr-aqua-soft' },
  PROFESSIONAL: { label: 'Professional review', short: 'Professional', icon: ClipboardCheck, accent: 'text-mr-lime-ink', soft: 'bg-mr-lime-soft' },
};
const MotionSection = motion.section;
const MotionDiv = motion.div;
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not set';
const title = (value) => String(value || 'Pending').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const DEFAULT_CLIENT_CONFIGURATION = {
  portal_enabled: true,
  modules: {
    overview: true, transactions: true, upcoming_installments: true,
    documents: true, project_updates: true, discussions: true,
  },
  transaction_visibility: { scope: 'ALL', selected_modes: [] },
};

function Metric({ label, value, note, icon: Icon }) {
  return (
    <div className="min-w-0 border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
      <span className="flex items-center gap-2 text-[11px] font-medium text-white/60">{createElement(Icon, { className: 'h-3.5 w-3.5' })}{label}</span>
      <p className="mt-2 truncate text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">{value}</p>
      {note && <p className="mt-0.5 truncate text-[10px] text-white/45">{note}</p>}
    </div>
  );
}

function Empty({ icon: Icon = Sparkles, title: heading, copy }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">{createElement(Icon, { className: 'h-7 w-7 text-mr-faint' })}<p className="mt-3 text-[14px] font-semibold">{heading}</p><p className="mt-1 max-w-sm text-[12px] leading-5 text-mr-muted">{copy}</p></div>;
}

export default function PortalWorkspace() {
  const { user, organization, logout } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('portalMembershipId') || '');
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({ home: null, payments: [], installments: [], documents: [], updates: [], notifications: [], preferences: { email_enabled: true, sms_enabled: false, dashboard_enabled: true } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [thread, setThread] = useState(null);

  const membership = useMemo(() => memberships.find((item) => String(item.id) === String(selectedId)) || memberships[0] || null, [memberships, selectedId]);
  const meta = TYPE_META[membership?.portal_type] || TYPE_META.BUYER;
  const portalIcon = createElement(meta.icon, { className: 'h-4.5 w-4.5' });
  const clientConfiguration = useMemo(() => membership?.portal_type === 'BUYER'
    ? { ...DEFAULT_CLIENT_CONFIGURATION, ...membership.portal_configuration, modules: { ...DEFAULT_CLIENT_CONFIGURATION.modules, ...(membership.portal_configuration?.modules || {}) }, transaction_visibility: { ...DEFAULT_CLIENT_CONFIGURATION.transaction_visibility, ...(membership.portal_configuration?.transaction_visibility || {}) } }
    : DEFAULT_CLIENT_CONFIGURATION, [membership]);
  const discussionsEnabled = membership?.portal_type !== 'BUYER' || clientConfiguration.modules.discussions;
  const navigation = useMemo(() => {
    if (membership?.portal_type !== 'BUYER') {
      return [['overview', 'Overview', Home], ['documents', 'Documents', FileText], ['updates', 'Updates', HardHat], ['notifications', 'Inbox', Bell]];
    }
    const items = [];
    if (clientConfiguration.modules.overview) items.push(['overview', 'Overview', Home]);
    if (clientConfiguration.modules.transactions) items.push(['transactions', 'Transactions', CreditCard]);
    if (clientConfiguration.modules.upcoming_installments) items.push(['installments', 'Upcoming installments', CalendarClock]);
    if (clientConfiguration.modules.documents) items.push(['documents', 'Documents', FileText]);
    if (clientConfiguration.modules.project_updates) items.push(['updates', 'Updates', HardHat]);
    items.push(['notifications', 'Inbox', Bell]);
    return items;
  }, [clientConfiguration, membership?.portal_type]);

  const headers = useCallback(() => membership ? {
    'X-Portal-Membership-ID': String(membership.id),
    ...(membership.site_id ? { 'X-Site-ID': String(membership.site_id) } : {}),
  } : {}, [membership]);

  const loadContext = useCallback(async () => {
    const response = await api.get('/phase4/portal/context');
    const next = response.data.memberships || [];
    setMemberships(next);
    if (!next.some((item) => String(item.id) === String(selectedId)) && next[0]) setSelectedId(String(next[0].id));
  }, [selectedId]);

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (!membership) return;
    quiet ? setRefreshing(true) : setLoading(true);
    const config = { headers: headers() };
    try {
      const requests = [];
      const add = (key, promise) => requests.push([key, promise]);
      if (membership.portal_type === 'BUYER') {
        if (clientConfiguration.modules.overview) add('home', api.get('/phase4/portal/buyer/home', config));
        if (clientConfiguration.modules.transactions) add('payments', api.get('/phase4/portal/buyer/payments?limit=100', config));
        if (clientConfiguration.modules.upcoming_installments) add('installments', api.get('/phase4/portal/buyer/installments?limit=100', config));
      } else {
        add('home', api.get(membership.portal_type === 'BROKER' ? '/phase4/portal/broker/home' : '/phase4/portal/professional/certifications', config));
      }
      if (membership.portal_type !== 'BUYER' || clientConfiguration.modules.documents) add('documents', api.get('/phase4/portal/documents', config));
      if (membership.portal_type !== 'BUYER' || clientConfiguration.modules.project_updates) add('updates', api.get('/phase4/portal/updates', config));
      add('notifications', api.get('/phase4/portal/notifications', config));
      add('preferences', api.get('/phase4/portal/notification-preferences', config));

      const results = await Promise.allSettled(requests.map(([, promise]) => promise));
      const next = { home: null, payments: [], installments: [], documents: [], updates: [], notifications: [], preferences: { email_enabled: true, sms_enabled: false, dashboard_enabled: true } };
      results.forEach((result, index) => {
        const key = requests[index][0];
        if (result.status !== 'fulfilled') return;
        const payload = result.value.data || {};
        if (key === 'home') next.home = payload;
        if (key === 'payments') next.payments = payload.transactions || payload.payments || [];
        if (key === 'installments') next.installments = payload.installments || [];
        if (key === 'documents') next.documents = payload.documents || [];
        if (key === 'updates') next.updates = payload.updates || [];
        if (key === 'notifications') next.notifications = payload.notifications || [];
        if (key === 'preferences') next.preferences = payload.preferences || next.preferences;
      });
      setData(next);
      const firstFailure = results.find((result) => result.status === 'rejected');
      if (firstFailure) toast.error(firstFailure.reason?.response?.data?.message || 'Some portal information is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientConfiguration, headers, membership]);

  useEffect(() => { loadContext().catch(() => setLoading(false)); }, [loadContext]);
  useEffect(() => {
    if (!membership) return;
    localStorage.setItem('portalMembershipId', String(membership.id));
    setTab(navigation[0]?.[0] || 'notifications');
    void loadWorkspace();
  }, [membership?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDocument = async (document) => {
    try {
      const response = await api.get(document.content_path, { headers: headers(), responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { toast.error(error.response?.data?.message || 'Document could not be opened.'); }
  };

  const transitionCertification = async (status) => {
    if (!reviewing || !reviewNotes.trim()) return toast.error('Add review notes before submitting.');
    try {
      await api.patch(`/phase4/portal/professional/certifications/${reviewing.id}/status`, { status, review_notes: reviewNotes }, { headers: headers() });
      toast.success(status === 'INTERNAL_REVIEW' ? 'Submitted for internal review' : 'Revision requested');
      setReviewing(null); setReviewNotes(''); await loadWorkspace(true);
    } catch (error) { toast.error(error.response?.data?.message || 'Review could not be submitted.'); }
  };

  const markNotificationRead = async (notification) => {
    if (notification.read_at) return;
    try {
      const response = await api.patch(`/phase4/portal/notifications/${notification.id}/read`, {}, { headers: headers() });
      setData((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, read_at: response.data.notification.read_at } : item) }));
    } catch (error) { toast.error(error.response?.data?.message || 'Notification could not be marked read.'); }
  };

  const updatePreference = async (key, checked) => {
    const next = { ...data.preferences, [key]: checked };
    setData((current) => ({ ...current, preferences: next }));
    try {
      const response = await api.put('/phase4/portal/notification-preferences', next, { headers: headers() });
      setData((current) => ({ ...current, preferences: response.data.preferences }));
      toast.success('Notification preference saved');
    } catch (error) {
      setData((current) => ({ ...current, preferences: data.preferences }));
      toast.error(error.response?.data?.message || 'Preference could not be saved.');
    }
  };

  if (!loading && memberships.length === 0) {
    return <main className="flex min-h-screen items-center justify-center bg-mr-canvas px-5"><section className="max-w-lg text-center"><ShieldCheck className="mx-auto h-9 w-9 text-mr-faint" /><h1 className="mt-4 text-2xl font-semibold">No active portal access</h1><p className="mt-2 text-sm text-mr-muted">Your invitation may have expired, been revoked, or the organization’s plan may no longer include this portal.</p><Button variant="outline" className="mt-6 rounded-full" onClick={logout}>Sign out</Button></section></main>;
  }
  if (!loading && membership?.portal_type === 'BUYER' && !clientConfiguration.portal_enabled) {
    return <main className="flex min-h-screen items-center justify-center bg-mr-canvas px-5"><section className="max-w-lg text-center"><ShieldCheck className="mx-auto h-9 w-9 text-mr-faint" /><h1 className="mt-4 text-2xl font-semibold">Client portal is temporarily paused</h1><p className="mt-2 text-sm leading-6 text-mr-muted">{organization?.name || 'The organization'} has paused external portal access for this project. Your account remains secure and no project data is available while the portal is paused.</p><Button variant="outline" className="mt-6 rounded-full" onClick={logout}>Sign out</Button></section></main>;
  }
  const buyer = data.home?.summary;
  const broker = membership?.portal_type === 'BROKER' ? data.home?.summary : null;
  const certifications = data.home?.certifications || [];

  return (
    <main className="min-h-screen bg-mr-canvas text-mr-text">
      <header className="sticky top-0 z-40 border-b border-mr-line bg-mr-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mr-ink text-white"><Building2 className="h-4 w-4" /></div>
          <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{organization?.name || 'Mount Reality'}</p><p className="truncate text-[10px] text-mr-faint">Secure external workspace</p></div>
          <div className="ml-auto flex items-center gap-2">
            {memberships.length > 1 && <Select value={String(membership?.id || '')} onValueChange={setSelectedId}><SelectTrigger className="h-9 w-[190px] rounded-full text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{memberships.map((item) => <SelectItem key={item.id} value={String(item.id)}>{TYPE_META[item.portal_type]?.short} · {item.project_name || item.site_name}</SelectItem>)}</SelectContent></Select>}
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => loadWorkspace(true)} aria-label="Refresh portal"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={logout} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-7 sm:py-8">
        <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#111318_0%,#1b263d_60%,#173c46_100%)] px-5 py-6 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.8)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', meta.soft, meta.accent)}>{portalIcon}</span>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{meta.label}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Welcome back, {user?.name?.split(' ')[0] || 'there'}.</h1>
              <p className="mt-2 text-[12px] text-white/55">{membership?.project_name || membership?.site_name} · {membership?.identity_name}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-4">
              {membership?.portal_type === 'BUYER' && clientConfiguration.modules.overview && <><Metric label="Properties" value={buyer?.properties || 0} icon={Home} /><Metric label="Agreed" value={money(buyer?.agreed_value)} icon={WalletCards} /><Metric label="Received" value={money(buyer?.received)} icon={CheckCircle2} /><Metric label="Due" value={money(buyer?.due)} icon={CircleDollarSign} /></>}
              {membership?.portal_type === 'BUYER' && !clientConfiguration.modules.overview && <><Metric label="Available views" value={navigation.length} note="Configured by your organization" icon={ShieldCheck} /><Metric label="Access" value="Scoped" note="Only your assigned records" icon={CheckCircle2} /></>}
              {membership?.portal_type === 'BROKER' && <><Metric label="Inventory" value={broker?.released_properties || 0} icon={Home} /><Metric label="Commission" value={money(broker?.total_commission)} icon={WalletCards} /><Metric label="Paid" value={money(broker?.paid)} icon={CheckCircle2} /><Metric label="Balance" value={money(broker?.balance)} icon={CircleDollarSign} /></>}
              {membership?.portal_type === 'PROFESSIONAL' && <><Metric label="Assignments" value={certifications.length} icon={ClipboardCheck} /><Metric label="In review" value={certifications.filter((item) => item.status === 'PROFESSIONAL_REVIEW').length} icon={MessageSquare} /><Metric label="Certified" value={certifications.filter((item) => ['CERTIFIED', 'APPROVED'].includes(item.status)).length} icon={CheckCircle2} /><Metric label="Evidence" value={certifications.reduce((sum, item) => sum + (item.evidence?.length || 0), 0)} icon={FileText} /></>}
            </div>
          </div>
        </section>

        <nav className="mt-5 flex gap-1 overflow-x-auto rounded-full border border-mr-line bg-mr-surface p-1 shadow-sm sm:w-fit">
          {navigation.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={cn('flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[12px] font-medium transition', tab === key ? 'bg-mr-ink text-white shadow-sm' : 'text-mr-muted hover:text-mr-text')}>{createElement(Icon, { className: 'h-3.5 w-3.5' })}{label}{key === 'notifications' && data.notifications.filter((item) => !item.read_at).length > 0 && <span className="rounded-full bg-mr-coral px-1.5 text-[9px] text-white">{data.notifications.filter((item) => !item.read_at).length}</span>}</button>)}
        </nav>

        <AnimatePresence mode="wait">
          <MotionSection key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-5 overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface shadow-[0_16px_50px_-42px_rgba(16,17,20,0.45)]">
            {loading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-mr-faint" /></div> : null}

            {!loading && tab === 'overview' && membership?.portal_type === 'BUYER' && <div className="divide-y divide-mr-line">{(data.home?.bookings || []).map((booking) => <article key={booking.booking_id} className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold tracking-[-0.025em]">Property {booking.property.number}</h2><Badge variant="outline" className="rounded-full">{title(booking.booking_status)}</Badge>{discussionsEnabled && <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-[10px]" onClick={() => setThread({ type: 'BOOKING', id: booking.booking_id, label: `Booking ${booking.booking_reference}` })}><MessageSquare className="mr-1 h-3 w-3" />Discuss</Button>}</div><p className="mt-1 text-[12px] text-mr-muted">{booking.booking_reference} · {booking.project?.name || membership.site_name}</p><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">{[['Size', booking.property.size], ['Rate', money(booking.property.rate)], ['Registry', title(booking.lifecycle.registry_status)], ['Possession', title(booking.lifecycle.possession_status)]].map(([label, value]) => <div key={label}><p className="text-[10px] uppercase tracking-[0.1em] text-mr-faint">{label}</p><p className="mt-1 text-[13px] font-medium">{value || 'Not set'}</p></div>)}</div></div><div className="min-w-52 rounded-panel-sm bg-mr-surface-2 p-5"><p className="text-[11px] text-mr-muted">Payment position</p><p className="mt-2 text-xl font-semibold">{money(booking.commercial.amount_due)}</p><p className="text-[10px] text-mr-faint">remaining of {money(booking.commercial.agreed_value)}</p><Progress className="mt-4 h-1.5" value={Number(booking.commercial.agreed_value) ? Number(booking.commercial.amount_received) / Number(booking.commercial.agreed_value) * 100 : 0} /></div></article>)}{!(data.home?.bookings || []).length && <Empty title="No active property" copy="No canonical active booking is linked to this portal identity." />}</div>}

            {!loading && tab === 'transactions' && membership?.portal_type === 'BUYER' && <div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line bg-mr-surface-2/45 px-5 py-4 sm:px-7"><div><h2 className="text-[15px] font-semibold">Payment transactions</h2><p className="mt-1 text-[11px] text-mr-muted">Only approved, non-returned entries allowed by your organization are shown.</p></div><Badge variant="outline" className="rounded-full">{clientConfiguration.transaction_visibility.scope === 'SELECTED' ? clientConfiguration.transaction_visibility.selected_modes.join(', ') : title(clientConfiguration.transaction_visibility.scope)}</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-mr-surface-2 text-[10px] uppercase tracking-[0.08em] text-mr-faint"><tr><th className="px-5 py-3 sm:px-7">Date</th><th className="px-4 py-3">Property</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Reference</th><th className="px-5 py-3 text-right sm:px-7">Amount</th></tr></thead><tbody className="divide-y divide-mr-line">{data.payments.map((payment) => <tr key={`${payment.source}-${payment.id}`} className="text-[12px]"><td className="whitespace-nowrap px-5 py-4 text-mr-muted sm:px-7">{date(payment.date)}</td><td className="px-4 py-4"><b className="block text-mr-text">Property {payment.plot_no}</b><span className="text-[10px] text-mr-faint">{payment.booking_no}</span></td><td className="px-4 py-4 text-mr-muted">{title(payment.source)}</td><td className="px-4 py-4"><Badge variant="outline" className="rounded-full">{title(payment.payment_mode)}</Badge></td><td className="px-4 py-4 text-mr-muted">{payment.reference || '—'}</td><td className="whitespace-nowrap px-5 py-4 text-right font-semibold sm:px-7">{money(payment.amount)}</td></tr>)}</tbody></table></div>{!data.payments.length && <Empty icon={CreditCard} title="No visible transactions" copy="No approved transactions match the payment-mode visibility configured by your organization." />}</div>}

            {!loading && tab === 'installments' && membership?.portal_type === 'BUYER' && <div><div className="border-b border-mr-line bg-mr-surface-2/45 px-5 py-4 sm:px-7"><h2 className="text-[15px] font-semibold">Upcoming installments</h2><p className="mt-1 text-[11px] text-mr-muted">Open balances from your active booking schedule, ordered by due date.</p></div><div className="grid gap-3 p-4 sm:p-6 lg:grid-cols-2">{data.installments.map((installment) => <article key={installment.id} className="rounded-[20px] border border-mr-line bg-mr-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><Badge variant="outline" className={cn('rounded-full', installment.due_status === 'OVERDUE' && 'border-mr-coral/35 bg-mr-coral-soft text-mr-coral-ink')}>{title(installment.due_status)}</Badge><h3 className="mt-3 text-[14px] font-semibold">{installment.installment_name || 'Scheduled installment'}</h3><p className="mt-1 text-[11px] text-mr-muted">Property {installment.plot_no} · {installment.booking_no}</p></div><CalendarClock className="h-5 w-5 text-mr-faint" /></div><div className="mt-5 flex items-end justify-between gap-4 border-t border-mr-line pt-4"><div><p className="text-[10px] uppercase tracking-[0.08em] text-mr-faint">Due {date(installment.due_date)}</p><p className="mt-1 text-[11px] text-mr-muted">{Number(installment.days_until_due) < 0 ? `${Math.abs(Number(installment.days_until_due))} days overdue` : Number(installment.days_until_due) === 0 ? 'Due today' : `In ${installment.days_until_due} days`}</p></div><p className="text-lg font-semibold">{money(installment.amount_due)}</p></div></article>)}{!data.installments.length && <div className="lg:col-span-2"><Empty icon={CalendarClock} title="No upcoming installments" copy="There are no open installment balances in your current booking schedule." /></div>}</div></div>}

            {!loading && tab === 'overview' && membership?.portal_type === 'BROKER' && <div className="grid lg:grid-cols-2"><div className="col-span-full grid gap-3 border-b border-mr-line bg-mr-surface-2/45 px-5 py-4 text-[11px] sm:grid-cols-3 sm:px-7"><div><p className="text-[9px] uppercase tracking-[0.1em] text-mr-faint">Broker profile</p><p className="mt-1 font-semibold">{data.home?.broker_profile?.business_name || data.home?.broker_profile?.name || 'Canonical broker member'}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-mr-faint">Registration record</p><p className="mt-1 font-semibold">{data.home?.broker_profile?.registration?.reference || 'Not recorded'}</p><p className="text-[9px] text-mr-faint">Not represented as government-verified</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-mr-faint">Project authorization</p><p className="mt-1 font-semibold">{title(data.home?.broker_profile?.project_authorization?.status)}</p><p className="text-[9px] text-mr-faint">Source: portal membership scope</p></div></div><div className="border-b border-mr-line lg:border-b-0 lg:border-r"><div className="p-5 sm:p-7"><h2 className="text-[15px] font-semibold">Released inventory</h2><p className="mt-1 text-[11px] text-mr-muted">Only properties explicitly released to brokers.</p></div><div className="divide-y divide-mr-line">{(data.home?.inventory || []).map((item) => <div key={item.release_id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7"><div><p className="text-[13px] font-semibold">Property {item.plot_no || item.plot_id}</p><p className="mt-0.5 text-[11px] text-mr-muted">{item.plot_size || 'Size withheld'} · {title(item.status)}</p></div><p className="text-[13px] font-semibold">{item.plot_rate ? money(item.plot_rate) : 'Price withheld'}</p></div>)}{!(data.home?.inventory || []).length && <Empty title="No released inventory" copy="Internal inventory stays hidden until the organization releases a property." />}</div></div><div><div className="p-5 sm:p-7"><h2 className="text-[15px] font-semibold">Your commissions</h2><p className="mt-1 text-[11px] text-mr-muted">Amounts come directly from your commission ledger.</p></div><div className="divide-y divide-mr-line">{(data.home?.commissions || []).map((item) => <div key={item.id} className="px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-2"><p className="text-[13px] font-semibold">Property {item.plot_no}</p><Button variant="ghost" size="sm" className="ml-auto h-7 rounded-full px-2 text-[10px]" onClick={() => setThread({ type: 'COMMISSION', id: item.id, label: `Commission for property ${item.plot_no}` })}><MessageSquare className="mr-1 h-3 w-3" />Discuss</Button><Badge variant="outline" className="rounded-full">{title(item.status)}</Badge></div><div className="mt-3 grid grid-cols-3 gap-3 text-[11px]"><span><b className="block text-[13px] text-mr-text">{money(item.total_commission)}</b>Total</span><span><b className="block text-[13px] text-mr-lime-ink">{money(item.paid)}</b>Paid</span><span><b className="block text-[13px] text-mr-coral-ink">{money(item.balance)}</b>Balance</span></div></div>)}{!(data.home?.commissions || []).length && <Empty title="No commission records" copy="No commission ledger rows are linked to your broker identity." />}</div></div></div>}

            {!loading && tab === 'overview' && membership?.portal_type === 'PROFESSIONAL' && <div className="divide-y divide-mr-line">{certifications.map((item) => <article key={item.id} className="p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[15px] font-semibold">Certification #{item.id}</h2><Badge variant="outline" className="rounded-full">{title(item.status)}</Badge><Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-[10px]" onClick={() => setThread({ type: 'CERTIFICATION', id: item.id, label: `Certification #${item.id}` })}><MessageSquare className="mr-1 h-3 w-3" />Discuss</Button></div><p className="mt-1 text-[11px] text-mr-muted">{date(item.period_start)} – {date(item.period_end)} · {item.work_package_name || item.construction_project_name}</p></div><div className="text-left sm:text-right"><p className="text-2xl font-semibold tracking-[-0.04em]">{Number(item.proposed_certified_progress_pct || 0).toFixed(1)}%</p><p className="text-[10px] text-mr-faint">proposed certified progress</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]"><div><Progress value={Number(item.proposed_certified_progress_pct || 0)} className="h-1.5" /><p className="mt-3 text-[12px] leading-5 text-mr-muted">{item.review_notes || 'No review notes recorded yet.'}</p></div>{item.allowed_transitions?.length > 0 && <Button size="sm" className="rounded-full bg-mr-ink" onClick={() => { setReviewing(item); setReviewNotes(''); }}>Review assignment</Button>}</div></article>)}{!certifications.length && <Empty title="No certification assignments" copy="Certifications appear only when your stakeholder record is assigned as the professional." />}</div>}

            {!loading && tab === 'documents' && <div className="divide-y divide-mr-line">{data.documents.map((document) => <div key={document.grant_id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-mr-surface-2/60 sm:px-7"><button onClick={() => openDocument(document)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{document.title}</b><small className="block truncate text-[11px] text-mr-muted">{document.category} · released {date(document.released_at)}</small></span><ArrowDownToLine className="h-4 w-4 shrink-0 text-mr-faint" /></button>{discussionsEnabled && <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label={`Discuss ${document.title}`} onClick={() => setThread({ type: 'DOCUMENT', id: document.grant_id, label: document.title })}><MessageSquare className="h-3.5 w-3.5" /></Button>}</div>)}{!data.documents.length && <Empty icon={FileText} title="No released documents" copy="Internal documents remain private until an audience release is approved." />}</div>}

            {!loading && tab === 'updates' && <div className="divide-y divide-mr-line">{data.updates.map((update) => <article key={update.id} className="px-5 py-5 sm:px-7"><div className="flex gap-4"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-mr-aqua" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-[13px] font-semibold">{update.headline}</p>{discussionsEnabled && <Button variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2 text-[10px]" onClick={() => setThread({ type: 'PROJECT_UPDATE', id: update.id, label: update.headline })}><MessageSquare className="mr-1 h-3 w-3" />Discuss</Button>}</div><p className="mt-1 text-[12px] leading-5 text-mr-muted">{update.summary || 'A controlled project update was released.'}</p><p className="mt-2 text-[10px] text-mr-faint">{date(update.source_date || update.released_at)}{update.progress_pct != null ? ` · ${Number(update.progress_pct).toFixed(1)}% progress` : ''}</p></div></div></article>)}{!data.updates.length && <Empty icon={HardHat} title="No released updates" copy="Operational records are not exposed automatically. Released project updates will appear here." />}</div>}

            {!loading && tab === 'notifications' && <div><div className="grid gap-3 border-b border-mr-line bg-mr-surface-2/45 px-5 py-4 sm:grid-cols-3 sm:px-7">{[['email_enabled', 'Email'], ['sms_enabled', 'SMS'], ['dashboard_enabled', 'Dashboard']].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 rounded-control border border-mr-line bg-mr-surface px-3 py-2 text-[11px] font-medium"><span>{label}</span><Switch checked={Boolean(data.preferences?.[key])} onCheckedChange={(checked) => updatePreference(key, checked)} /></label>)}</div><div className="divide-y divide-mr-line">{data.notifications.map((notification) => <button key={notification.id} onClick={() => markNotificationRead(notification)} className={cn('flex w-full gap-4 px-5 py-4 text-left sm:px-7', !notification.read_at && 'bg-mr-blue-soft/35')}><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notification.read_at ? 'bg-mr-line' : 'bg-mr-blue')} /><span><b className="block text-[13px]">{notification.title}</b><small className="mt-1 block text-[11px] leading-5 text-mr-muted">{notification.message}</small><small className="mt-1 block text-[10px] text-mr-faint">{date(notification.created_at)}{notification.read_at ? ' · Read' : ' · Mark as read'}</small></span></button>)}{!data.notifications.length && <Empty icon={Bell} title="Your inbox is clear" copy="Released documents, inventory, and project updates create durable notifications here." />}</div></div>}
          </MotionSection>
        </AnimatePresence>
      </div>

      <AnimatePresence>{reviewing && <MotionDiv className="fixed inset-0 z-50 flex items-end justify-center bg-mr-ink/35 p-0 sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReviewing(null)}><MotionSection initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-t-[28px] bg-mr-surface p-6 shadow-2xl sm:rounded-[28px] sm:p-8"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mr-blue">Professional review</p><h2 className="mt-2 text-xl font-semibold">Certification #{reviewing.id}</h2><p className="mt-1 text-[12px] text-mr-muted">Submit a factual review note. Final certification remains an internal segregation-of-duties action.</p><Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="mt-5 min-h-32 rounded-control" placeholder="Record observations, evidence gaps, or the basis for submission…" /><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" className="rounded-full" onClick={() => setReviewing(null)}>Cancel</Button><Button variant="outline" className="rounded-full" onClick={() => transitionCertification('REVISION_REQUIRED')}>Request revision</Button><Button className="rounded-full bg-mr-ink" onClick={() => transitionCertification('INTERNAL_REVIEW')}>Submit review</Button></div></MotionSection></MotionDiv>}</AnimatePresence>
      <PortalDiscussionDialog thread={thread} onOpenChange={(open) => { if (!open) setThread(null); }} headers={headers()} documents={data.documents} />
    </main>
  );
}
