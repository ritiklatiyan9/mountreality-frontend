import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Check, CheckCircle2, Copy, CreditCard, Eye, FileText, Globe2,
  Home, KeyRound, Link2, Loader2, LockKeyhole, MessageSquare, MonitorSmartphone,
  RefreshCw, Save, Send, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';

const DEFAULT_CONFIGURATION = {
  portal_enabled: true,
  modules: {
    overview: true,
    transactions: true,
    upcoming_installments: true,
    documents: true,
    project_updates: true,
    discussions: true,
  },
  transaction_visibility: { scope: 'ALL', selected_modes: [] },
};

const MODULES = [
  { key: 'overview', label: 'Property overview', description: 'Booking, property, registry, possession and payment position.', icon: Home, preview: 'Overview' },
  { key: 'transactions', label: 'Transactions', description: 'Approved payment entries filtered by the mode policy below.', icon: CreditCard, preview: 'Transactions' },
  { key: 'upcoming_installments', label: 'Upcoming installments', description: 'Open installment balances, due dates and overdue status.', icon: CalendarClock, preview: 'Installments' },
  { key: 'documents', label: 'Released documents', description: 'Only documents explicitly released to the client audience.', icon: FileText, preview: 'Documents' },
  { key: 'project_updates', label: 'Project updates', description: 'Only published updates from the controlled release workflow.', icon: MonitorSmartphone, preview: 'Updates' },
  { key: 'discussions', label: 'Client discussions', description: 'Allow comments only inside records the client can already access.', icon: MessageSquare },
];

const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: 'All modes', description: 'Show every approved cash and non-cash receipt.' },
  { value: 'CASH', label: 'Cash only', description: 'Show entries classified in the cash book.' },
  { value: 'BANK', label: 'Bank only', description: 'Show every approved non-cash entry.' },
  { value: 'SELECTED', label: 'Selected modes', description: 'Choose exact modes such as UPI, cheque or NEFT.' },
];

const normalizeConfiguration = (value) => ({
  ...DEFAULT_CONFIGURATION,
  ...(value || {}),
  modules: { ...DEFAULT_CONFIGURATION.modules, ...(value?.modules || {}) },
  transaction_visibility: { ...DEFAULT_CONFIGURATION.transaction_visibility, ...(value?.transaction_visibility || {}) },
});
const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

function SecurityItem({ icon: Icon, title, copy }) {
  return <div className="flex gap-3 rounded-[18px] border border-mr-line bg-mr-surface px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-mr-lime-ink">{createElement(Icon, { className: 'h-4 w-4' })}</span><div><p className="text-[12px] font-semibold">{title}</p><p className="mt-0.5 text-[10px] leading-4 text-mr-muted">{copy}</p></div></div>;
}

function Empty({ title, copy }) {
  return <div className="px-6 py-14 text-center"><Users className="mx-auto h-6 w-6 text-mr-faint" /><p className="mt-3 text-[13px] font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-mr-muted">{copy}</p></div>;
}

export default function EcosystemControlCentre() {
  const { sites, currentSite, organization } = useAuth();
  const [view, setView] = useState('experience');
  const [siteId, setSiteId] = useState(String(currentSite?.id || sites[0]?.id || ''));
  const [configuration, setConfiguration] = useState(DEFAULT_CONFIGURATION);
  const [savedConfiguration, setSavedConfiguration] = useState(DEFAULT_CONFIGURATION);
  const [availableModes, setAvailableModes] = useState([]);
  const [identity, setIdentity] = useState({ invitations: [], memberships: [] });
  const [members, setMembers] = useState([]);
  const [entitled, setEntitled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ domain_entity_id: '', email: '' });
  const [inviteLink, setInviteLink] = useState('');

  const dirty = useMemo(() => JSON.stringify(configuration) !== JSON.stringify(savedConfiguration), [configuration, savedConfiguration]);
  const selectedSite = sites.find((site) => String(site.id) === siteId);
  const eligibleMembers = useMemo(() => members.filter((member) => ['CLIENT', 'MEMBER'].includes(String(member.member_type || '').toUpperCase())), [members]);
  const activeClients = useMemo(() => (identity.memberships || []).filter((item) => item.portal_type === 'BUYER' && String(item.site_id) === siteId && item.status === 'ACTIVE'), [identity.memberships, siteId]);
  const pendingInvitations = useMemo(() => (identity.invitations || []).filter((item) => item.portal_type === 'BUYER' && String(item.site_id) === siteId && item.status === 'PENDING'), [identity.invitations, siteId]);
  const enabledModuleCount = Object.values(configuration.modules).filter(Boolean).length;

  const load = useCallback(async (quiet = false) => {
    if (!siteId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    const headers = { 'X-Site-ID': siteId };
    const results = await Promise.allSettled([
      api.get(`/phase4/admin/client-portal-configuration?site_id=${siteId}`, { headers }),
      api.get('/phase4/admin/portal-identities'),
      api.get(`/members?site_id=${siteId}`, { headers }),
      api.get('/phase4/admin/entitlements'),
    ]);
    if (results[0].status === 'fulfilled') {
      const next = normalizeConfiguration(results[0].value.data.configuration);
      setConfiguration(next);
      setSavedConfiguration(next);
      setAvailableModes(results[0].value.data.available_transaction_modes || []);
    } else toast.error(results[0].reason?.response?.data?.message || 'Client portal settings could not be loaded.');
    if (results[1].status === 'fulfilled') setIdentity(results[1].value.data);
    if (results[2].status === 'fulfilled') setMembers(results[2].value.data.members || []);
    if (results[3].status === 'fulfilled') {
      const buyer = (results[3].value.data.entitlements || []).find((item) => item.feature_key === 'buyer_portal');
      setEntitled(buyer ? Boolean(buyer.enabled) : true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [siteId]);

  useEffect(() => { void load(); }, [load]);

  const setModule = (key, enabled) => setConfiguration((current) => ({
    ...current,
    modules: { ...current.modules, [key]: enabled },
  }));

  const setVisibility = (scope) => setConfiguration((current) => ({
    ...current,
    transaction_visibility: { ...current.transaction_visibility, scope },
  }));

  const toggleMode = (mode) => setConfiguration((current) => {
    const selected = current.transaction_visibility.selected_modes || [];
    return {
      ...current,
      transaction_visibility: {
        ...current.transaction_visibility,
        selected_modes: selected.includes(mode) ? selected.filter((item) => item !== mode) : [...selected, mode],
      },
    };
  });

  const save = async () => {
    if (configuration.transaction_visibility.scope === 'SELECTED' && !configuration.transaction_visibility.selected_modes.length) {
      return toast.error('Select at least one transaction mode.');
    }
    setSaving(true);
    try {
      const { data } = await api.put('/phase4/admin/client-portal-configuration', { site_id: Number(siteId), configuration }, { headers: { 'X-Site-ID': siteId } });
      const next = normalizeConfiguration(data.configuration);
      setConfiguration(next);
      setSavedConfiguration(next);
      toast.success('Client portal policy saved and enforced');
    } catch (error) { toast.error(error.response?.data?.message || 'Client portal settings could not be saved.'); }
    finally { setSaving(false); }
  };

  const selectMember = (memberId) => {
    const member = eligibleMembers.find((item) => String(item.id) === memberId);
    setInvite({ domain_entity_id: memberId, email: member?.email || '' });
    setInviteLink('');
  };

  const sendInvitation = async (event) => {
    event.preventDefault();
    if (!invite.domain_entity_id || !invite.email.trim()) return toast.error('Select a client and enter their email.');
    const actions = [];
    if (configuration.modules.overview) actions.push('view_booking');
    if (configuration.modules.transactions || configuration.modules.upcoming_installments) actions.push('view_payments');
    if (configuration.modules.documents) actions.push('view_documents');
    if (configuration.modules.project_updates) actions.push('view_updates');
    if (configuration.modules.discussions) actions.push('comment');
    setInviting(true);
    try {
      const { data } = await api.post('/phase4/admin/portal-invitations', {
        portal_type: 'BUYER', site_id: Number(siteId), domain_entity_id: Number(invite.domain_entity_id),
        email: invite.email.trim(), permission_policy: { actions },
      }, { headers: { 'X-Site-ID': siteId } });
      setInviteLink(data.invitation_url || '');
      toast.success(data.email_delivery === 'SENT' ? 'Secure portal invitation sent' : 'Invitation created—copy the secure link below');
      setInvite({ domain_entity_id: '', email: '' });
      await load(true);
    } catch (error) { toast.error(error.response?.data?.message || 'Client invitation could not be created.'); }
    finally { setInviting(false); }
  };

  const revoke = async (kind, id) => {
    if (!window.confirm(`Revoke this ${kind === 'membership' ? 'client access' : 'invitation'} now?`)) return;
    try {
      await api.delete(`/phase4/admin/${kind === 'membership' ? 'portal-memberships' : 'portal-invitations'}/${id}`);
      toast.success('Portal access revoked and active sessions invalidated');
      await load(true);
    } catch (error) { toast.error(error.response?.data?.message || 'Access could not be revoked.'); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast.success('Invitation link copied'); }
    catch { toast.error('Copy failed. Select the link manually.'); }
  };

  if (!siteId) return <div className="rounded-[24px] border border-mr-line bg-mr-surface"><Empty title="Create a Site first" copy="Client portal policy is isolated per Site, so a Site is required before portal access can be configured." /></div>;

  return (
    <div className="space-y-5 pb-12">
      <section className="overflow-hidden rounded-[28px] border border-mr-line bg-[linear-gradient(125deg,#101827_0%,#18294a_58%,#123f49_100%)] px-5 py-6 text-white shadow-[0_28px_70px_-44px_rgba(15,23,42,0.85)] sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl"><div className="flex items-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Globe2 className="h-5 w-5" /></span><Badge className={cn('rounded-full border-0', configuration.portal_enabled ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-100')}>{configuration.portal_enabled ? 'Portal live' : 'Portal paused'}</Badge></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">Client portal control center</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.045em] sm:text-4xl">Decide exactly what clients can see.</h1><p className="mt-2 text-[12px] leading-5 text-white/60">One secure place to configure the client experience, payment visibility, upcoming installments and login access. Hidden modules are blocked by the API as well as the interface.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Select value={siteId} onValueChange={(value) => { setSiteId(value); setInviteLink(''); }}><SelectTrigger className="h-10 min-w-56 rounded-full border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent>{sites.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10 hover:text-white" onClick={() => load(true)} aria-label="Refresh portal settings"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button><Button onClick={save} disabled={!dirty || saving || loading} className="h-10 rounded-full bg-white px-5 text-slate-950 hover:bg-white/90"><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : dirty ? 'Save policy' : 'Saved'}</Button></div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4"><div><p className="text-2xl font-semibold">{enabledModuleCount}</p><p className="text-[10px] text-white/45">Modules enabled</p></div><div><p className="text-2xl font-semibold">{activeClients.length}</p><p className="text-[10px] text-white/45">Active clients</p></div><div><p className="text-2xl font-semibold">{pendingInvitations.length}</p><p className="text-[10px] text-white/45">Pending invites</p></div><div><p className="text-2xl font-semibold">{configuration.transaction_visibility.scope === 'SELECTED' ? configuration.transaction_visibility.selected_modes.length : configuration.transaction_visibility.scope}</p><p className="text-[10px] text-white/45">Transaction policy</p></div></div>
      </section>

      {!entitled && <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-[12px] font-semibold">Client portal is not enabled on the current plan</p><p className="mt-0.5 text-[10px] leading-4">Configuration can be reviewed, but new invitations are blocked until the Buyer Portal entitlement is enabled.</p></div></div>}

      <div className="flex gap-1 overflow-x-auto rounded-full border border-mr-line bg-mr-surface p-1 shadow-sm sm:w-fit">
        {[['experience', 'Portal experience', SlidersHorizontal], ['access', 'Client access', UserPlus]].map(([key, label, Icon]) => <button key={key} onClick={() => setView(key)} className={cn('flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[12px] font-medium transition', view === key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text')}>{createElement(Icon, { className: 'h-3.5 w-3.5' })}{label}</button>)}
      </div>

      {loading ? <section className="flex min-h-96 items-center justify-center rounded-[26px] border border-mr-line bg-mr-surface"><Loader2 className="h-5 w-5 animate-spin text-mr-faint" /></section> : null}

      {!loading && view === 'experience' && <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-mr-line px-5 py-4 sm:px-6"><div><h2 className="text-[15px] font-semibold">Portal availability</h2><p className="mt-1 text-[11px] text-mr-muted">Pause immediately to deny every client data API for {selectedSite?.name}.</p></div><label className="flex items-center gap-3 rounded-full border border-mr-line bg-mr-surface-2 px-3 py-2 text-[11px] font-semibold"><span>{configuration.portal_enabled ? 'Live' : 'Paused'}</span><Switch checked={configuration.portal_enabled} onCheckedChange={(checked) => setConfiguration((current) => ({ ...current, portal_enabled: checked }))} /></label></div><div className="grid gap-px bg-mr-line sm:grid-cols-2">{MODULES.map(({ key, label, description, icon: Icon }) => <div key={key} className="flex gap-4 bg-mr-surface px-5 py-5 sm:px-6"><span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', configuration.modules[key] ? 'bg-mr-blue-soft text-mr-blue' : 'bg-mr-surface-2 text-mr-faint')}>{createElement(Icon, { className: 'h-4 w-4' })}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-[12px] font-semibold">{label}</p><Switch checked={configuration.modules[key]} onCheckedChange={(checked) => setModule(key, checked)} /></div><p className="mt-1 text-[10px] leading-4 text-mr-muted">{description}</p></div></div>)}</div></section>

          <section className={cn('overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface shadow-sm transition', !configuration.modules.transactions && 'opacity-60')}><div className="border-b border-mr-line px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-mr-blue" /><h2 className="text-[15px] font-semibold">Transaction visibility</h2></div><p className="mt-1 text-[11px] text-mr-muted">The selected rule is applied inside the payment query, so blocked modes never reach the client browser.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">{VISIBILITY_OPTIONS.map((option) => { const selected = configuration.transaction_visibility.scope === option.value; return <button key={option.value} disabled={!configuration.modules.transactions} onClick={() => setVisibility(option.value)} className={cn('flex items-start gap-3 rounded-[20px] border p-4 text-left transition', selected ? 'border-mr-blue bg-mr-blue-soft/55' : 'border-mr-line hover:bg-mr-surface-2')}><span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', selected ? 'border-mr-blue bg-mr-blue text-white' : 'border-mr-line')}>{selected && <Check className="h-3 w-3" />}</span><span><b className="block text-[12px]">{option.label}</b><small className="mt-1 block text-[10px] leading-4 text-mr-muted">{option.description}</small></span></button>; })}</div>{configuration.modules.transactions && configuration.transaction_visibility.scope === 'SELECTED' && <div className="border-t border-mr-line bg-mr-surface-2/45 px-5 py-5 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-mr-faint">Select exact modes</p><div className="mt-3 flex flex-wrap gap-2">{availableModes.map((mode) => { const selected = configuration.transaction_visibility.selected_modes.includes(mode); return <button key={mode} onClick={() => toggleMode(mode)} className={cn('rounded-full border px-3 py-1.5 text-[10px] font-semibold transition', selected ? 'border-mr-ink bg-mr-ink text-white' : 'border-mr-line bg-mr-surface text-mr-muted hover:text-mr-text')}>{selected && <Check className="mr-1 inline h-3 w-3" />}{mode}</button>; })}</div></div>}</section>
        </div>

        <aside className="space-y-5"><section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface shadow-sm"><div className="flex items-center justify-between border-b border-mr-line px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mr-blue">Live structure preview</p><h2 className="mt-1 text-[14px] font-semibold">Client navigation</h2></div><Eye className="h-4 w-4 text-mr-faint" /></div><div className="bg-[linear-gradient(135deg,#111827,#1e3a5f)] p-5 text-white"><p className="text-[10px] text-white/45">{organization?.name || 'Your company'}</p><p className="mt-1 text-lg font-semibold">Welcome to {selectedSite?.name}</p><p className="mt-1 text-[10px] text-white/45">Secure external workspace</p></div><div className="p-3">{MODULES.filter((item) => item.preview && configuration.modules[item.key]).map((item) => <div key={item.key} className="flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[11px] font-medium">{createElement(item.icon, { className: 'h-3.5 w-3.5 text-mr-blue' })}{item.preview}<CheckCircle2 className="ml-auto h-3.5 w-3.5 text-mr-lime-ink" /></div>)}<div className="flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[11px] font-medium"><Users className="h-3.5 w-3.5 text-mr-blue" />Inbox<span className="ml-auto text-[9px] text-mr-faint">Always available</span></div>{!configuration.portal_enabled && <div className="m-2 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-900">Portal paused: clients see no project modules or data.</div>}</div></section><section className="rounded-[26px] border border-mr-line bg-mr-surface p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-mr-lime-ink" /><h2 className="text-[14px] font-semibold">Security enforced</h2></div><div className="mt-4 space-y-2"><SecurityItem icon={KeyRound} title="Protected login" copy="Per-IP and per-account throttling, password lockout and timing-safe unknown-account checks." /><SecurityItem icon={LockKeyhole} title="Tenant-isolated data" copy="Every request must match the user, organization, Site and active membership." /><SecurityItem icon={ShieldCheck} title="Server-side visibility" copy="Disabled modules and payment modes are denied before data is returned." /><SecurityItem icon={FileText} title="Released documents only" copy="Private source files never appear without an active portal release." /></div></section></aside>
      </div>}

      {!loading && view === 'access' && <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]"><section className="h-fit rounded-[26px] border border-mr-line bg-mr-surface p-5 shadow-sm sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-mr-blue-soft text-mr-blue"><UserPlus className="h-4 w-4" /></div><h2 className="mt-4 text-[16px] font-semibold">Invite a client</h2><p className="mt-1 text-[11px] leading-5 text-mr-muted">The client must already exist in this Site and have an active booking. Invitations expire automatically and store only a token hash.</p><form onSubmit={sendInvitation} className="mt-5 space-y-4"><div><Label className="text-[11px] text-mr-muted">Client identity</Label><Select value={invite.domain_entity_id} onValueChange={selectMember}><SelectTrigger className="mt-1.5 h-11 rounded-control"><SelectValue placeholder="Select booked client" /></SelectTrigger><SelectContent>{eligibleMembers.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.full_name}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-[11px] text-mr-muted">Login email</Label><Input type="email" autoComplete="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 h-11 rounded-control" placeholder="client@example.com" /></div><Button className="h-11 w-full rounded-full bg-mr-ink" disabled={inviting || !entitled}><Send className="mr-2 h-4 w-4" />{inviting ? 'Creating secure invite…' : 'Send secure invitation'}</Button></form>{inviteLink && <div className="mt-4 rounded-[18px] border border-mr-line bg-mr-surface-2 p-3"><p className="text-[10px] font-semibold text-mr-muted">Invitation link</p><div className="mt-2 flex gap-2"><Input readOnly value={inviteLink} className="h-9 text-[10px]" /><Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={copyLink}><Copy className="h-3.5 w-3.5" /></Button></div></div>}<div className="mt-5 border-t border-mr-line pt-4 text-[10px] leading-4 text-mr-faint"><Link2 className="mr-1 inline h-3 w-3" />Portal sign-in: <span className="font-medium text-mr-muted">{window.location.origin}/login</span></div></section><section className="overflow-hidden rounded-[26px] border border-mr-line bg-mr-surface shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-mr-line px-5 py-4 sm:px-6"><div><h2 className="text-[15px] font-semibold">Client access register</h2><p className="mt-1 text-[11px] text-mr-muted">Active memberships and pending invitations for {selectedSite?.name}.</p></div><div className="flex gap-2"><Badge variant="outline" className="rounded-full">{activeClients.length} active</Badge><Badge variant="outline" className="rounded-full">{pendingInvitations.length} pending</Badge></div></div><div className="divide-y divide-mr-line">{activeClients.map((item) => <div key={`membership-${item.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mr-lime-soft text-mr-lime-ink"><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[12px] font-semibold">{item.name}</p><Badge className="rounded-full border-0 bg-mr-lime-soft text-mr-lime-ink">Active</Badge></div><p className="mt-1 truncate text-[10px] text-mr-muted">{item.email} · since {date(item.effective_from || item.created_at)}</p></div><Button variant="ghost" size="sm" className="self-start rounded-full text-mr-coral-ink sm:self-auto" onClick={() => revoke('membership', item.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Revoke</Button></div>)}{pendingInvitations.map((item) => <div key={`invitation-${item.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mr-amber-soft text-mr-amber-ink"><Send className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[12px] font-semibold">{item.email}</p><Badge className="rounded-full border-0 bg-mr-amber-soft text-mr-amber-ink">Pending</Badge></div><p className="mt-1 text-[10px] text-mr-muted">Expires {date(item.expires_at)}</p></div><Button variant="ghost" size="sm" className="self-start rounded-full text-mr-coral-ink sm:self-auto" onClick={() => revoke('invitation', item.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Revoke</Button></div>)}{!activeClients.length && !pendingInvitations.length && <Empty title="No client portal access yet" copy="Invite a booked client to create the first secure portal membership for this Site." />}</div></section></div>}
    </div>
  );
}
