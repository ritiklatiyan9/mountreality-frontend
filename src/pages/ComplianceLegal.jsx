import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { sanitizeSpreadsheetRows } from '../lib/spreadsheetSecurity';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarDays,
  CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock3, Download, FileClock, FileSpreadsheet, Filter, Gavel, Inbox, Landmark,
  LayoutDashboard, ListChecks, Loader2, Plus, RefreshCw, Scale, Search, Settings2,
  ShieldAlert, ShieldCheck, Sparkles, Upload, UserRound, XCircle,
} from 'lucide-react';
import {
  COMPLIANCE_TYPES, fmtDate, isoDate, labelize, money, RISK_OPTIONS, RISK_STYLE,
  STATUS_OPTIONS, STATUS_STYLE,
} from '../components/compliance/complianceUi';

const COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#84cc16'];
const FREQUENCIES = ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'EVENT_BASED', 'CUSTOM'];
const CASE_TYPES = ['CIVIL', 'CONSUMER', 'REVENUE', 'LAND_DISPUTE', 'TITLE_DISPUTE', 'CONTRACT', 'RECOVERY', 'CRIMINAL', 'ARBITRATION', 'RERA', 'LABOUR', 'TAX', 'CUSTOMER', 'VENDOR', 'FARMER', 'OTHER'];
const NOTICE_TYPES = ['GOVERNMENT', 'COURT', 'TAX', 'RERA', 'CUSTOMER_LEGAL', 'VENDOR', 'FARMER', 'EMPLOYEE', 'ADVOCATE', 'SHOW_CAUSE', 'DEMAND', 'RECOVERY', 'OTHER'];
const INSPECTION_TYPES = ['SITE_INSPECTION', 'AUTHORITY_INSPECTION', 'FIRE_INSPECTION', 'ELECTRICAL_INSPECTION', 'ENVIRONMENTAL_INSPECTION', 'LABOUR_INSPECTION', 'TAX_HEARING', 'LEGAL_HEARING', 'RERA_HEARING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT'];
const REPORT_TYPES = [
  'COMPLIANCE_SUMMARY', 'UPCOMING_DUE', 'OVERDUE_COMPLIANCE', 'COMPLIANCE_COMPLETION',
  'COMPLIANCE_BY_PROJECT', 'COMPLIANCE_BY_AUTHORITY', 'COMPLIANCE_BY_RESPONSIBLE_USER',
  'COMPLIANCE_RISK',
  'APPROVAL_EXPIRY', 'LICENCE_RENEWAL', 'LEGAL_CASE_SUMMARY', 'HEARING_CALENDAR',
  'NOTICE_REPLY', 'LEGAL_FINANCIAL_EXPOSURE', 'DOCUMENT_EXPIRY',
  'INSPECTION_CORRECTIVE_ACTION', 'COMPLIANCE_AUDIT_TRAIL', 'PENALTY_FEE',
];

const pill = (value, map) => (
  <Badge variant="outline" className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold', map[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>
    {labelize(value)}
  </Badge>
);

const Empty = ({ title = 'Nothing here yet', copy = 'Create the first record to begin tracking this workflow.' }) => (
  <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Inbox className="h-5 w-5" /></span>
    <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{copy}</p>
  </div>
);

const Panel = ({ children, className }) => (
  <section className={cn('overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,.45)]', className)}>
    {children}
  </section>
);

const Head = ({ eyebrow, title, copy, icon, actions }) => (
  <header className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-950/10 sm:px-7">
    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
    <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">{createElement(icon, { className: 'h-6 w-6 text-blue-200' })}</span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-200">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-300">{copy}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  </header>
);

const FilterBar = ({ search, setSearch, children, onRefresh, loading }) => (
  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 lg:flex-row lg:items-center">
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records…" className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-xs" />
    </div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
    {onRefresh && <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={onRefresh} disabled={loading}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>}
  </div>
);

const NativeSelect = ({ value, onChange, children, className }) => (
  <select value={value} onChange={onChange} className={cn('h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-400', className)}>
    {children}
  </select>
);

const DistributionPanel = ({ title, copy, rows = [], color = 'bg-blue-500' }) => {
  const max = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  return <Panel className="p-5"><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{copy}</p><div className="mt-5 space-y-3">{rows.length ? rows.slice(0, 8).map((row) => <div key={row.label || row.month}><div className="mb-1 flex items-center justify-between gap-3 text-[10px]"><span className="truncate font-semibold text-slate-600">{labelize(row.label || row.month)}</span><span className="font-bold tabular-nums text-slate-700">{row.value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn('h-full rounded-full', color)} style={{ width: `${Math.max(Number(row.value) / max * 100, 4)}%` }} /></div></div>) : <p className="py-8 text-center text-xs text-slate-400">No data</p>}</div></Panel>;
};

function DashboardView({ siteId }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canViewLegal = hasPermission('legal', 'read');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [filters, setFilters] = useState({
    state: '', category: '', authority_id: '', responsible_user_id: '',
    risk: '', status: '', from: '', to: '',
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries({ site_id: siteId, ...filters }).filter(([, value]) => value));
      const [dashboard, people, master] = await Promise.all([
        api.get('/compliance/dashboard', { params }),
        api.get('/compliance/users', { params: siteId ? { site_id: siteId } : {} }),
        api.get('/compliance/authorities'),
      ]);
      setData(dashboard.data);
      setUsers(people.data.users || []);
      setAuthorities(master.data.authorities || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load compliance dashboard');
    } finally { setLoading(false); }
  }, [filters, siteId]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);
  const summary = data?.summary || {};
  const cards = [
    ['Active obligations', summary.active, ClipboardCheck, 'text-blue-700 bg-blue-50', ''],
    ['Due today', summary.due_today, Clock3, 'text-amber-700 bg-amber-50', '?from=' + isoDate() + '&to=' + isoDate()],
    ['Due in 7 days', summary.due_7, CalendarDays, 'text-cyan-700 bg-cyan-50', `?to=${isoDate(addDays(new Date(), 7))}`],
    ['Due in 30 days', summary.due_30, CalendarRange, 'text-indigo-700 bg-indigo-50', `?to=${isoDate(addDays(new Date(), 30))}`],
    ['Overdue', summary.overdue, AlertOctagon, 'text-red-700 bg-red-50', '?overdue=true'],
    ['Completed this month', summary.completed_month, CheckCircle2, 'text-emerald-700 bg-emerald-50', '?status=COMPLETED'],
    ['Expiring approvals', summary.expiring_approvals, FileClock, 'text-orange-700 bg-orange-50', '/compliance/licences'],
    ['Open legal cases', summary.open_legal_cases, Gavel, 'text-violet-700 bg-violet-50', '/legal/cases'],
    ['Pending notices', summary.pending_notices, ShieldAlert, 'text-rose-700 bg-rose-50', '/legal/notices'],
    ['High-risk items', summary.high_risk, AlertTriangle, 'text-red-700 bg-red-50', '?risk=HIGH'],
  ].filter(([label]) => canViewLegal || !['Open legal cases', 'Pending notices'].includes(label));
  if (loading) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-[20px]" />)}</div>;
  return (
    <div className="space-y-5">
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Input aria-label="State filter" placeholder="State" value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })} />
          <Input aria-label="Category filter" placeholder="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
          <NativeSelect aria-label="Authority filter" value={filters.authority_id} onChange={(event) => setFilters({ ...filters, authority_id: event.target.value })}><option value="">All authorities</option>{authorities.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect>
          <NativeSelect aria-label="Responsible employee filter" value={filters.responsible_user_id} onChange={(event) => setFilters({ ...filters, responsible_user_id: event.target.value })}><option value="">All employees</option>{users.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect>
          <NativeSelect aria-label="Risk filter" value={filters.risk} onChange={(event) => setFilters({ ...filters, risk: event.target.value })}><option value="">All risks</option>{RISK_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</NativeSelect>
          <NativeSelect aria-label="Status filter" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</NativeSelect>
          <Input aria-label="Due from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <div className="flex gap-2"><Input aria-label="Due to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /><Button type="button" variant="outline" size="icon" title="Clear dashboard filters" onClick={() => setFilters({ state: '', category: '', authority_id: '', responsible_user_id: '', risk: '', status: '', from: '', to: '' })}><Filter className="h-4 w-4" /></Button></div>
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value, icon, tone, target]) => (
          <button key={label} type="button" onClick={() => navigate(target.startsWith('/') ? target : `/compliance/register${target}`)} className="rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>{createElement(icon, { className: 'h-4 w-4' })}</span>
            <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">{Number(value || 0).toLocaleString('en-IN')}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{label}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold text-slate-900">Due versus completed</h2><p className="mt-1 text-xs text-slate-500">Twelve-month compliance movement</p></div>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={data?.charts?.monthly || []}><defs><linearGradient id="due" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={.24}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false}/><YAxis tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false}/><ChartTooltip/><Area type="monotone" dataKey="due" stroke="#2563eb" fill="url(#due)" strokeWidth={2}/><Area type="monotone" dataKey="completed" stroke="#10b981" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold text-slate-900">Risk distribution</h2><p className="mt-1 text-xs text-slate-500">Current portfolio exposure</p></div>
          <div className="grid min-h-72 place-items-center p-4">
            {(data?.charts?.risk || []).length ? <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={data.charts.risk} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={4}>{data.charts.risk.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}</Pie><ChartTooltip formatter={(value, name) => [value, labelize(name)]}/></PieChart></ResponsiveContainer> : <Empty title="No risk data" />}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Panel>
          <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold text-slate-900">Priority control queue</h2><p className="mt-1 text-xs text-slate-500">Critical, overdue and approaching obligations</p></div><Sparkles className="h-4 w-4 text-amber-500" /></div>
          {data?.priority?.length ? <div className="divide-y divide-slate-100">{data.priority.map((item) => (
            <button type="button" key={item.id} onClick={() => navigate(`/compliance/register/${item.id}`)} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{pill(item.risk_level, RISK_STYLE)}<p className="truncate text-sm font-semibold text-slate-800">{item.title}</p></div><p className="mt-1 text-[11px] text-slate-500">{item.site_name || 'Organisation-wide'} · {item.assigned_to_name || 'Unassigned'} · due {fmtDate(item.current_due_date)}</p></div>
              <span className={cn('text-xs font-bold tabular-nums', item.days_remaining < 0 ? 'text-red-600' : 'text-slate-500')}>{item.days_remaining < 0 ? `${Math.abs(item.days_remaining)}d overdue` : `${item.days_remaining ?? '—'}d left`}</span>
            </button>
          ))}</div> : <Empty title="No priority items" copy="Nothing critical or overdue is currently in the queue." />}
        </Panel>
        <Panel>
          <div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold text-slate-900">By authority</h2><p className="mt-1 text-xs text-slate-500">Highest workload departments</p></div>
          <div className="h-72 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.charts?.authorities || []} layout="vertical" margin={{ left: 14, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" hide/><YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100}/><ChartTooltip/><Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]}/></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <DistributionPanel title="Status" copy="Portfolio workflow distribution" rows={data?.charts?.status} color="bg-cyan-500" />
        <DistributionPanel title="By project" copy="Obligations by site" rows={data?.charts?.sites} color="bg-blue-500" />
        <DistributionPanel title="By employee" copy="Responsible workload" rows={data?.charts?.employees} color="bg-emerald-500" />
        {canViewLegal && <DistributionPanel title="Legal stage" copy="Open matters by stage" rows={data?.charts?.legal_stages} color="bg-violet-500" />}
        <DistributionPanel title="Expiry timeline" copy="Licences and documents, 12 months" rows={data?.charts?.expiry_timeline} color="bg-orange-500" />
      </div>
    </div>
  );
}

function ComplianceForm({ open, onOpenChange, siteId, authorities, users, onSaved }) {
  const empty = { title: '', category: 'PROJECT_APPROVAL', compliance_type: 'ONE_TIME_APPROVAL', current_due_date: '', priority: 'MEDIUM', risk_level: 'MEDIUM', authority_id: '', assigned_to: '', description: '', approval_required: false };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await api.post('/compliance/items', {
        ...form, site_id: siteId, authority_id: form.authority_id || null,
        assigned_to: form.assigned_to || null,
        original_due_date: form.current_due_date || null,
        reminder_days: [30, 15, 7, 1, 0],
      });
      toast.success('Compliance obligation created');
      setForm(empty); onOpenChange(false); onSaved();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not create compliance item'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New compliance obligation</DialogTitle><DialogDescription>Create a site-scoped obligation with an auditable due date and owner.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Title</Label><Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quarterly project progress filing" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Compliance type</Label><NativeSelect className="mt-1.5 w-full" value={form.compliance_type} onChange={(e) => setForm({ ...form, compliance_type: e.target.value, category: e.target.value })}>{COMPLIANCE_TYPES.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}</NativeSelect></div>
          <div><Label>Current due date</Label><Input className="mt-1.5" type="date" value={form.current_due_date} onChange={(e) => setForm({ ...form, current_due_date: e.target.value })} /></div>
          <div><Label>Authority</Label><NativeSelect className="mt-1.5 w-full" value={form.authority_id} onChange={(e) => setForm({ ...form, authority_id: e.target.value })}><option value="">Not specified</option>{authorities.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect></div>
          <div><Label>Responsible person</Label><NativeSelect className="mt-1.5 w-full" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}><option value="">Unassigned</option>{users.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect></div>
          <div><Label>Priority</Label><NativeSelect className="mt-1.5 w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{RISK_OPTIONS.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div>
          <div><Label>Risk</Label><NativeSelect className="mt-1.5 w-full" value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>{RISK_OPTIONS.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div>
        </div>
        <div><Label>Description</Label><Textarea className="mt-1.5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700"><span>Require approval before completion</span><Switch checked={form.approval_required} onCheckedChange={(value) => setForm({ ...form, approval_required: value })} /></label>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create obligation</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function RegisterView({ siteId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = new URLSearchParams(location.search);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initial.get('status') || 'all');
  const [risk, setRisk] = useState(initial.get('risk') || 'all');
  const [overdue, setOverdue] = useState(initial.get('overdue') === 'true');
  const [from, setFrom] = useState(initial.get('from') || '');
  const [to, setTo] = useState(initial.get('to') || '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [authorities, setAuthorities] = useState([]);
  const [users, setUsers] = useState([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { site_id: siteId, page, limit: 30, q: search || undefined, status: status === 'all' ? undefined : status, risk: risk === 'all' ? undefined : risk, overdue: overdue || undefined, from: from || undefined, to: to || undefined };
      const [records, master, people] = await Promise.all([
        api.get('/compliance/items', { params }),
        api.get('/compliance/authorities'),
        api.get('/compliance/users', { params: { site_id: siteId } }),
      ]);
      setItems(records.data.items || []); setPagination(records.data.pagination || {});
      setAuthorities(master.data.authorities || []); setUsers(people.data.users || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not load compliance register'); }
    finally { setLoading(false); }
  }, [siteId, page, search, status, risk, overdue, from, to]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  return (
    <Panel>
      <FilterBar search={search} setSearch={(value) => { setSearch(value); setPage(1); }} onRefresh={load} loading={loading}>
        <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option>{STATUS_OPTIONS.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}</NativeSelect>
        <NativeSelect value={risk} onChange={(e) => { setRisk(e.target.value); setPage(1); }}><option value="all">All risks</option>{RISK_OPTIONS.map((v) => <option key={v} value={v}>{labelize(v)} risk</option>)}</NativeSelect>
        <Input aria-label="Due from" className="h-10 w-36 rounded-xl bg-white text-xs" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input aria-label="Due to" className="h-10 w-36 rounded-xl bg-white text-xs" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <Button variant={overdue ? 'default' : 'outline'} className="h-10 rounded-xl text-xs" onClick={() => { setOverdue(!overdue); setPage(1); }}><AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Overdue</Button>
        <Button className="h-10 rounded-xl text-xs" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New item</Button>
      </FilterBar>
      {loading ? <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div> : items.length ? (
        <>
          <Table><TableHeader><TableRow><TableHead>Compliance</TableHead><TableHead>Due date</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead>Risk</TableHead><TableHead className="text-right">Impact</TableHead></TableRow></TableHeader><TableBody>
            {items.map((item) => <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/compliance/register/${item.id}`)}>
              <TableCell><p className="max-w-md truncate text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.compliance_code} · {labelize(item.compliance_type)} · {item.authority_name || 'No authority'}</p></TableCell>
              <TableCell><p className={cn('text-xs font-semibold', item.days_remaining < 0 ? 'text-red-600' : 'text-slate-700')}>{fmtDate(item.current_due_date)}</p><p className="text-[10px] text-slate-400">{item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} days overdue` : item.days_remaining === null ? 'No deadline' : `${item.days_remaining} days remaining`}</p></TableCell>
              <TableCell><p className="text-xs text-slate-700">{item.assigned_to_name || 'Unassigned'}</p><p className="text-[10px] text-slate-400">{item.site_name || 'Organisation-wide'}</p></TableCell>
              <TableCell>{pill(item.status, STATUS_STYLE)}</TableCell><TableCell>{pill(item.risk_level, RISK_STYLE)}</TableCell>
              <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-700">{money(item.financial_impact)}</TableCell>
            </TableRow>)}
          </TableBody></Table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{pagination.total || 0} records</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= (pagination.pages || 1)} onClick={() => setPage(page + 1)}>Next</Button></div></div>
        </>
      ) : <Empty title="No compliance obligations match" copy="Clear the filters or create a new obligation for this site." />}
      <ComplianceForm open={createOpen} onOpenChange={setCreateOpen} siteId={siteId} authorities={authorities} users={users} onSaved={load} />
    </Panel>
  );
}

function CalendarView({ siteId }) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [mode, setMode] = useState('month');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const range = useMemo(() => {
    if (mode === 'day') return { from: cursor, to: cursor };
    if (mode === 'week') return { from: startOfWeek(cursor, { weekStartsOn: 1 }), to: endOfWeek(cursor, { weekStartsOn: 1 }) };
    return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
  }, [cursor, mode]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/compliance/calendar', { params: { site_id: siteId, from: isoDate(range.from), to: isoDate(range.to) } });
      setEvents(data.events || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not load calendar'); }
    finally { setLoading(false); }
  }, [siteId, range]);
  useEffect(() => { load(); }, [load]);
  const days = eachDayOfInterval(range);
  const byDay = (day) => events.filter((event) => isSameDay(new Date(event.event_date), day));
  const openEvent = (event) => {
    if (event.event_type === 'COMPLIANCE') navigate(`/compliance/register/${event.id}`);
    else if (event.event_type === 'LEGAL_HEARING') navigate(`/legal/cases/${event.id}`);
    else if (event.event_type === 'LICENCE_EXPIRY') navigate('/compliance/licences');
    else if (event.event_type === 'NOTICE_REPLY') navigate('/legal/notices');
    else navigate('/legal/inspections');
  };
  const exportIcs = () => {
    const body = events.map((event) => `BEGIN:VEVENT\nUID:${event.event_type}-${event.id}@mountreality\nDTSTART;VALUE=DATE:${isoDate(event.event_date).replaceAll('-', '')}\nSUMMARY:${String(event.title).replaceAll('\n', ' ')}\nDESCRIPTION:${event.event_type}\nEND:VEVENT`).join('\n');
    const blob = new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MountReality//Compliance//EN\n${body}\nEND:VCALENDAR`], { type: 'text/calendar' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `mountreality-compliance-${isoDate()}.ics`; link.click(); URL.revokeObjectURL(link.href);
  };
  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2"><Button size="icon" variant="outline" onClick={() => setCursor(mode === 'month' ? subMonths(cursor, 1) : addDays(cursor, mode === 'week' ? -7 : -1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" className="min-w-44" onClick={() => setCursor(new Date())}>{format(cursor, mode === 'month' ? 'MMMM yyyy' : 'dd MMMM yyyy')}</Button><Button size="icon" variant="outline" onClick={() => setCursor(mode === 'month' ? addMonths(cursor, 1) : addDays(cursor, mode === 'week' ? 7 : 1))}><ChevronRight className="h-4 w-4" /></Button></div>
        <div className="flex flex-wrap gap-2"><div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">{['month','week','day','agenda','timeline'].map((value) => <button key={value} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-semibold', mode === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500')} onClick={() => setMode(value)}>{labelize(value)}</button>)}</div><Button variant="outline" className="h-10 rounded-xl text-xs" onClick={exportIcs}><Download className="mr-1.5 h-4 w-4" />iCal</Button></div>
      </div>
      {loading ? <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">{Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-none" />)}</div> : ['agenda','timeline'].includes(mode) ? (
        events.length ? <div className="relative divide-y divide-slate-100">{events.map((event) => <button type="button" key={`${event.event_type}-${event.id}`} onClick={() => openEvent(event)} className="grid w-full gap-2 px-5 py-4 text-left hover:bg-slate-50 sm:grid-cols-[120px_1fr_auto] sm:items-center"><p className="text-xs font-semibold text-slate-500">{fmtDate(event.event_date, true)}</p><div><p className="text-sm font-semibold text-slate-800">{event.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{labelize(event.event_type)} · {event.site_name || 'Organisation-wide'}</p></div>{pill(event.risk_level, RISK_STYLE)}</button>)}</div> : <Empty title="No events in this period" />
      ) : (
        <div className={cn('grid gap-px bg-slate-200', mode === 'day' ? 'grid-cols-1' : 'grid-cols-7')}>
          {days.map((day) => <div key={day.toISOString()} className={cn('min-h-32 bg-white p-2', mode === 'month' && !isSameMonth(day, cursor) && 'bg-slate-50 text-slate-300')}>
            <p className={cn('mb-2 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold', isSameDay(day, new Date()) && 'bg-blue-600 text-white')}>{format(day, 'd')}</p>
            <div className="space-y-1">{byDay(day).slice(0, mode === 'day' ? 50 : 4).map((event) => <button key={`${event.event_type}-${event.id}`} type="button" onClick={() => openEvent(event)} className={cn('block w-full truncate rounded-md px-2 py-1 text-left text-[9px] font-semibold', event.event_type === 'LEGAL_HEARING' ? 'bg-violet-100 text-violet-700' : event.event_type === 'LICENCE_EXPIRY' ? 'bg-orange-100 text-orange-700' : event.risk_level === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700')}>{event.title}</button>)}{byDay(day).length > 4 && mode !== 'day' && <p className="px-1 text-[9px] text-slate-400">+{byDay(day).length - 4} more</p>}</div>
          </div>)}
        </div>
      )}
    </Panel>
  );
}

const ENTITY_COPY = {
  licences: { endpoint: 'licences', key: 'licences', title: 'Approval & licence register', copy: 'Validity, renewal status, conditions and expiry warnings.', icon: ShieldCheck, permission: 'compliance' },
  cases: { endpoint: 'legal-cases', key: 'cases', title: 'Legal cases', copy: 'Case exposure, stages, hearings and next actions.', icon: Gavel, permission: 'legal' },
  notices: { endpoint: 'notices', key: 'notices', title: 'Notices & replies', copy: 'Incoming and outgoing notices with reply deadlines.', icon: ShieldAlert, permission: 'legal' },
  inspections: { endpoint: 'inspections', key: 'inspections', title: 'Inspections & hearings', copy: 'Authority visits, audits, hearings and corrective actions.', icon: CalendarRange, permission: 'compliance' },
};

function EntityForm({ kind, open, onOpenChange, siteId, users, authorities, onSaved }) {
  const base = kind === 'licences' ? { name: '', licence_type: 'PROJECT_APPROVAL', licence_number: '', expiry_date: '', authority_id: '', responsible_person_id: '' }
    : kind === 'cases' ? { title: '', case_type: 'CIVIL', court_authority: '', case_number: '', next_hearing_date: '', risk_level: 'MEDIUM', internal_owner_id: '' }
      : kind === 'notices' ? { subject: '', notice_type: 'GOVERNMENT', notice_number: '', reply_due_date: '', risk_level: 'MEDIUM', responsible_person_id: '', authority_id: '' }
        : { inspection_type: 'SITE_INSPECTION', scheduled_at: '', location: '', meeting_mode: 'OFFLINE', responsible_person_id: '', authority_id: '' };
  const [form, setForm] = useState(base);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) setForm(base); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await api.post(`/compliance/${ENTITY_COPY[kind].endpoint}`, { ...form, site_id: siteId });
      toast.success(`${ENTITY_COPY[kind].title} record created`); onOpenChange(false); onSaved();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not create record'); }
    finally { setSaving(false); }
  };
  const field = (label, name, type = 'text') => <div><Label>{label}</Label><Input className="mt-1.5" type={type} value={form[name] || ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></div>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>New {ENTITY_COPY[kind].title}</DialogTitle><DialogDescription>{ENTITY_COPY[kind].copy}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}>
    {kind === 'licences' && <><div className="grid gap-4 sm:grid-cols-2">{field('Approval / licence name', 'name')}{field('Licence number', 'licence_number')}{field('Expiry date', 'expiry_date', 'date')}<div><Label>Type</Label><NativeSelect className="mt-1.5 w-full" value={form.licence_type} onChange={(e) => setForm({ ...form, licence_type: e.target.value })}>{COMPLIANCE_TYPES.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div></div></>}
    {kind === 'cases' && <><div className="grid gap-4 sm:grid-cols-2">{field('Case title', 'title')}{field('Case number', 'case_number')}{field('Court / tribunal', 'court_authority')}{field('Next hearing', 'next_hearing_date', 'datetime-local')}<div><Label>Case type</Label><NativeSelect className="mt-1.5 w-full" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>{CASE_TYPES.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div><div><Label>Risk</Label><NativeSelect className="mt-1.5 w-full" value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>{RISK_OPTIONS.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div></div></>}
    {kind === 'notices' && <><div className="grid gap-4 sm:grid-cols-2">{field('Subject', 'subject')}{field('Notice number', 'notice_number')}{field('Reply due date', 'reply_due_date', 'date')}<div><Label>Notice type</Label><NativeSelect className="mt-1.5 w-full" value={form.notice_type} onChange={(e) => setForm({ ...form, notice_type: e.target.value })}>{NOTICE_TYPES.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div></div></>}
    {kind === 'inspections' && <><div className="grid gap-4 sm:grid-cols-2">{field('Scheduled date & time', 'scheduled_at', 'datetime-local')}{field('Location', 'location')}<div><Label>Inspection / hearing type</Label><NativeSelect className="mt-1.5 w-full" value={form.inspection_type} onChange={(e) => setForm({ ...form, inspection_type: e.target.value })}>{INSPECTION_TYPES.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div></div></>}
    <div className="grid gap-4 sm:grid-cols-2">
      {kind !== 'cases' && <div><Label>Authority</Label><NativeSelect className="mt-1.5 w-full" value={form.authority_id || ''} onChange={(e) => setForm({ ...form, authority_id: e.target.value })}><option value="">Not specified</option>{authorities.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect></div>}
      <div><Label>Responsible person</Label><NativeSelect className="mt-1.5 w-full" value={form.responsible_person_id || form.internal_owner_id || ''} onChange={(e) => setForm({ ...form, [kind === 'cases' ? 'internal_owner_id' : 'responsible_person_id']: e.target.value })}><option value="">Unassigned</option>{users.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect></div>
    </div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create record</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function EntityRegister({ kind, siteId }) {
  const navigate = useNavigate();
  const cfg = ENTITY_COPY[kind];
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, people, master] = await Promise.all([
        api.get(`/compliance/${cfg.endpoint}`, { params: { site_id: siteId, q: search || undefined, limit: 100 } }),
        api.get(cfg.permission === 'legal' ? '/compliance/legal-users' : '/compliance/users', { params: { site_id: siteId } }),
        api.get(cfg.permission === 'legal' ? '/compliance/legal-authorities' : '/compliance/authorities'),
      ]);
      setRows(records.data[cfg.key] || []); setUsers(people.data.users || []); setAuthorities(master.data.authorities || []);
    } catch (error) { toast.error(error.response?.data?.message || `Could not load ${cfg.title}`); }
    finally { setLoading(false); }
  }, [cfg.endpoint, cfg.key, cfg.permission, cfg.title, siteId, search]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);
  const titleFor = (row) => row.name || row.title || row.subject || labelize(row.inspection_type);
  const dateFor = (row) => row.expiry_date || row.next_hearing_date || row.reply_due_date || row.scheduled_at;
  const statusFor = (row) => row.renewal_status || row.status || row.stage;
  return <Panel><FilterBar search={search} setSearch={setSearch} onRefresh={load} loading={loading}><Button className="h-10 rounded-xl text-xs" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New record</Button></FilterBar>
    {loading ? <div className="space-y-2 p-5">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div> : rows.length ? <Table><TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Date / deadline</TableHead><TableHead>Responsible</TableHead><TableHead>Status / stage</TableHead><TableHead>Risk / authority</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => kind === 'cases' ? navigate(`/legal/cases/${row.id}`) : kind === 'notices' ? navigate(`/legal/notices/${row.id}`) : undefined}><TableCell><p className="max-w-md truncate text-xs font-semibold text-slate-800">{titleFor(row)}</p><p className="mt-0.5 text-[10px] text-slate-400">{row.case_code || row.licence_number || row.notice_number || labelize(row.case_type || row.licence_type || row.notice_type || row.meeting_mode)}</p></TableCell><TableCell className="text-xs font-medium">{fmtDate(dateFor(row), kind === 'cases' || kind === 'inspections')}</TableCell><TableCell className="text-xs">{row.responsible_name || 'Unassigned'}</TableCell><TableCell>{pill(statusFor(row), STATUS_STYLE)}</TableCell><TableCell>{row.risk_level ? pill(row.risk_level, RISK_STYLE) : <span className="text-xs text-slate-500">{row.authority_name || '—'}</span>}</TableCell></TableRow>)}</TableBody></Table> : <Empty title={`No ${cfg.title.toLowerCase()} records`} />}
    <EntityForm kind={kind} open={open} onOpenChange={setOpen} siteId={siteId} users={users} authorities={authorities} onSaved={load} />
  </Panel>;
}

function TemplatesView({ siteId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const initial = { name: '', category: 'RERA_COMPLIANCE', compliance_type: 'RECURRING_FILING', frequency: 'QUARTERLY', start_date: isoDate(), end_date: '', applicable_site_ids: siteId ? [siteId] : [], default_risk: 'MEDIUM', default_reminder_days: '30,15,7,1,0', due_type: 'DAYS_AFTER_QUARTER_END', due_days: 15, approval_required: true };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const { data } = await api.get('/compliance/templates'); setRows(data.templates || []); } catch (error) { toast.error(error.response?.data?.message || 'Could not load templates'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm((cur) => ({ ...cur, applicable_site_ids: siteId ? [siteId] : [] })); }, [siteId]);
  const create = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await api.post('/compliance/templates', { ...form, due_date_rule: { type: form.due_type, days: Number(form.due_days) || 0 }, default_reminder_days: form.default_reminder_days.split(',').map(Number), required_checklist: [{ title: 'Prepare required documents', is_mandatory: true }, { title: 'Obtain submission acknowledgement', is_mandatory: true, required_document_type: 'ACKNOWLEDGEMENT' }] });
      toast.success('Compliance template created'); setOpen(false); setForm(initial); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Could not create template'); } finally { setSaving(false); }
  };
  const apply = async (template) => {
    try {
      const { data } = await api.post(`/compliance/templates/${template.id}/apply`, { site_ids: [siteId], start_date: template.start_date || isoDate(), through_date: isoDate(addMonths(new Date(), 12)) });
      toast.success(`${data.generated} obligations generated · ${data.skipped} already existed`);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not apply template'); }
  };
  const duplicate = async (template) => {
    try { await api.post(`/compliance/templates/${template.id}/duplicate`, { name: `${template.name} Copy` }); toast.success('Template duplicated'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not duplicate template'); }
  };
  const toggleActive = async (template) => {
    try { await api.patch(`/compliance/templates/${template.id}`, { is_active: !template.is_active }); toast.success(template.is_active ? 'Template deactivated' : 'Template activated'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not update template'); }
  };
  const exportAll = async () => {
    try {
      const { data } = await api.get('/compliance/templates-export');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `compliance-templates-${isoDate()}.json`; link.click(); URL.revokeObjectURL(link.href);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not export templates'); }
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { data } = await api.post('/compliance/templates-import', { templates: parsed.templates || parsed });
      toast.success(`${data.imported} imported · ${data.skipped} skipped`); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Template import file is invalid'); }
  };
  return <Panel><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold text-slate-900">Configurable compliance templates</h2><p className="mt-1 text-xs text-slate-500">No legal dates are hard-coded; administrators define applicability and due rules.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl text-xs" onClick={exportAll}><Download className="mr-1.5 h-4 w-4" />Export</Button><label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50"><Upload className="mr-1.5 h-4 w-4" />Import<input type="file" accept=".json,application/json" className="hidden" onChange={importFile} /></label><Button className="rounded-xl text-xs" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New template</Button></div></div>
    {loading ? <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div> : rows.length ? <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <div key={row.id} className={cn('rounded-2xl border p-4', row.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50 opacity-70')}><div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ListChecks className="h-4 w-4" /></span><div className="flex gap-1.5">{pill(row.default_risk, RISK_STYLE)}{pill(row.is_active ? 'ACTIVE' : 'INACTIVE', STATUS_STYLE)}</div></div><h3 className="mt-4 text-sm font-bold text-slate-900">{row.name}</h3><p className="mt-1 text-xs text-slate-500">{labelize(row.frequency)} · {row.authority_name || 'Any authority'}</p><p className="mt-3 line-clamp-2 min-h-10 text-[11px] leading-5 text-slate-500">{row.description || labelize(row.compliance_type)}</p><div className="mt-4 grid grid-cols-3 gap-2"><Button size="sm" className="rounded-xl text-xs" onClick={() => apply(row)} disabled={!siteId || !row.is_active}>Apply</Button><Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => duplicate(row)}>Duplicate</Button><Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</Button></div></div>)}</div> : <Empty title="No templates configured" />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>New compliance template</DialogTitle><DialogDescription>Define recurrence and due-date calculation without hard-coding a state rule.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={create}><div><Label>Template name</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Frequency</Label><NativeSelect className="mt-1.5 w-full" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>{FREQUENCIES.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div><div><Label>Risk</Label><NativeSelect className="mt-1.5 w-full" value={form.default_risk} onChange={(e) => setForm({ ...form, default_risk: e.target.value })}>{RISK_OPTIONS.map((v) => <option key={v}>{labelize(v)}</option>)}</NativeSelect></div><div><Label>Start date</Label><Input className="mt-1.5" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div><div><Label>End date (optional)</Label><Input className="mt-1.5" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div><div><Label>Due-date rule</Label><NativeSelect className="mt-1.5 w-full" value={form.due_type} onChange={(e) => setForm({ ...form, due_type: e.target.value })}><option>DAYS_AFTER_MONTH_END</option><option>DAYS_AFTER_QUARTER_END</option><option>DAYS_AFTER_FINANCIAL_YEAR_END</option><option>FIXED_DAY_OF_MONTH</option><option>DAYS_AFTER_EVENT</option><option>MANUAL</option></NativeSelect></div><div><Label>Days / fixed day</Label><Input className="mt-1.5" type="number" value={form.due_days} onChange={(e) => setForm({ ...form, due_days: e.target.value })} /></div></div><div><Label>Reminder days</Label><Input className="mt-1.5" value={form.default_reminder_days} onChange={(e) => setForm({ ...form, default_reminder_days: e.target.value })} placeholder="30,15,7,1,0" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create template</Button></DialogFooter></form></DialogContent></Dialog>
  </Panel>;
}

function AuthoritiesView() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', department_name: '', authority_type: '', state: '', district: '', contact_person: '', phone: '', email: '', website: '' });
  const load = useCallback(async () => { try { const { data } = await api.get('/compliance/authorities'); setRows(data.authorities || []); } catch (error) { toast.error(error.response?.data?.message || 'Could not load authorities'); } }, []);
  // Initial server fetch; subsequent writes explicitly refresh this list.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const create = async (e) => { e.preventDefault(); try { await api.post('/compliance/authorities', form); toast.success('Authority created'); setOpen(false); setForm({ name: '', department_name: '', authority_type: '', state: '', district: '', contact_person: '', phone: '', email: '', website: '' }); load(); } catch (error) { toast.error(error.response?.data?.message || 'Could not create authority'); } };
  return <Panel><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold text-slate-900">Authorities & departments</h2><p className="mt-1 text-xs text-slate-500">Organisation-specific master; no hard-coded government directory.</p></div><Button className="rounded-xl text-xs" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add authority</Button></div>{rows.length ? <Table><TableHeader><TableRow><TableHead>Authority</TableHead><TableHead>Location</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Active obligations</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><p className="text-xs font-semibold">{row.name}</p><p className="text-[10px] text-slate-400">{row.department_name || labelize(row.authority_type)}</p></TableCell><TableCell className="text-xs">{[row.district,row.state].filter(Boolean).join(', ') || '—'}</TableCell><TableCell><p className="text-xs">{row.contact_person || '—'}</p><p className="text-[10px] text-slate-400">{row.phone || row.email}</p></TableCell><TableCell className="text-right text-xs font-bold">{row.compliance_count}</TableCell></TableRow>)}</TableBody></Table> : <Empty title="No authorities configured" />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add authority</DialogTitle><DialogDescription>Store department and portal contacts for this organisation.</DialogDescription></DialogHeader><form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>{Object.keys(form).map((key) => <div key={key} className={key === 'name' ? 'sm:col-span-2' : ''}><Label>{labelize(key)}</Label><Input className="mt-1.5" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}<DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button>Add authority</Button></DialogFooter></form></DialogContent></Dialog>
  </Panel>;
}

function ReportsView({ siteId, legalMode = false }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [filters, setFilters] = useState({ report_type: legalMode ? 'LEGAL_CASE_SUMMARY' : 'COMPLIANCE_SUMMARY', from: isoDate(addMonths(new Date(), -12)), to: isoDate(addMonths(new Date(), 12)), status: 'all', risk: 'all', authority_id: '', responsible_user_id: '' });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { site_id: siteId, report_type: filters.report_type, from: filters.from, to: filters.to, status: filters.status === 'all' ? undefined : filters.status, risk: filters.risk === 'all' ? undefined : filters.risk, authority_id: filters.authority_id || undefined, responsible_user_id: filters.responsible_user_id || undefined };
      const [result, people, master] = await Promise.all([
        api.get(legalMode ? '/compliance/legal-reports' : '/compliance/reports', { params }),
        api.get(legalMode ? '/compliance/legal-users' : '/compliance/users', { params: siteId ? { site_id: siteId } : {} }),
        api.get(legalMode ? '/compliance/legal-authorities' : '/compliance/authorities'),
      ]);
      setReport(result.data.report);
      setUsers(people.data.users || []);
      setAuthorities(master.data.authorities || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not generate report'); }
    finally { setLoading(false); }
  }, [siteId, filters, legalMode]);
  useEffect(() => { load(); }, [load]);
  const exportRows = (type) => {
    if (!report?.rows?.length) return toast.error('No rows to export');
    const rows = sanitizeSpreadsheetRows(report.rows.map((row) => Object.fromEntries(report.columns.map((key) => [labelize(key), row[key]]))));
    if (type === 'xlsx') { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Compliance'); XLSX.writeFile(book, `compliance-report-${isoDate()}.xlsx`); }
    else { const sheet = XLSX.utils.json_to_sheet(rows); const csv = XLSX.utils.sheet_to_csv(sheet); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `compliance-report-${isoDate()}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  };
  const display = (key, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'status' || key.endsWith('_status')) return pill(value, STATUS_STYLE);
    if (key === 'risk_level') return pill(value, RISK_STYLE);
    if (['financial_impact','financial_exposure','claim_amount','amount_involved','renewal_cost','security_deposit','debit','credit'].includes(key)) return money(value);
    if (key.includes('date') || key.endsWith('_at')) return fmtDate(value, key.endsWith('_at') || key.includes('hearing'));
    if (typeof value === 'object') return <span className="line-clamp-2 max-w-sm">{JSON.stringify(value)}</span>;
    return String(value);
  };
  const legalReports = ['LEGAL_CASE_SUMMARY','HEARING_CALENDAR','NOTICE_REPLY','LEGAL_FINANCIAL_EXPOSURE','COMPLIANCE_AUDIT_TRAIL'];
  const availableReports = legalMode ? REPORT_TYPES.filter((value) => legalReports.includes(value)) : REPORT_TYPES.filter((value) => !legalReports.includes(value));
  return <Panel><div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-end"><div><Label>Report</Label><NativeSelect className="mt-1 w-56" value={filters.report_type} onChange={(e) => setFilters({ ...filters, report_type: e.target.value, status: 'all', risk: 'all' })}>{availableReports.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</NativeSelect></div><div><Label>From</Label><Input type="date" className="mt-1 w-40" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div><div><Label>To</Label><Input type="date" className="mt-1 w-40" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div><NativeSelect aria-label="Status filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="all">All statuses</option>{STATUS_OPTIONS.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}</NativeSelect><NativeSelect aria-label="Risk filter" value={filters.risk} onChange={(e) => setFilters({ ...filters, risk: e.target.value })}><option value="all">All risks</option>{RISK_OPTIONS.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}</NativeSelect><NativeSelect aria-label="Authority filter" value={filters.authority_id} onChange={(e) => setFilters({ ...filters, authority_id: e.target.value })}><option value="">All authorities</option>{authorities.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect><NativeSelect aria-label="Responsible user filter" value={filters.responsible_user_id} onChange={(e) => setFilters({ ...filters, responsible_user_id: e.target.value })}><option value="">All users</option>{users.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</NativeSelect><div className="ml-auto flex gap-2"><Button variant="outline" onClick={() => exportRows('csv')}><Download className="mr-1.5 h-4 w-4" />CSV</Button><Button variant="outline" onClick={() => exportRows('xlsx')}><FileSpreadsheet className="mr-1.5 h-4 w-4" />XLSX</Button><Button onClick={() => window.print()}>Print</Button></div></div>
    {loading ? <div className="space-y-3 p-5"><Skeleton className="h-24 rounded-2xl"/><Skeleton className="h-72 rounded-2xl"/></div> : report ? <><div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3"><div className="rounded-2xl bg-blue-50 p-4"><p className="text-[10px] font-bold uppercase text-blue-600">Total records</p><p className="mt-2 text-2xl font-bold text-blue-950">{report.summary.total}</p></div><div className="rounded-2xl bg-red-50 p-4"><p className="text-[10px] font-bold uppercase text-red-600">Overdue</p><p className="mt-2 text-2xl font-bold text-red-950">{report.summary.overdue}</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-[10px] font-bold uppercase text-amber-600">Financial impact</p><p className="mt-2 text-2xl font-bold text-amber-950">{money(report.summary.financial_impact)}</p></div></div>{report.rows.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow>{report.columns.map((key) => <TableHead key={key} className="whitespace-nowrap">{labelize(key)}</TableHead>)}</TableRow></TableHeader><TableBody>{report.rows.slice(0, 1000).map((row, index) => <TableRow key={`${row.compliance_code || row.case_code || row.notice_number || row.expense_id || 'row'}-${index}`}>{report.columns.map((key) => <TableCell key={key} className="max-w-sm whitespace-nowrap text-xs">{display(key, row[key])}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <Empty title="No records in this report period" />}</> : null}
  </Panel>;
}

function DocumentExpiryView({ siteId }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [windowDays, setWindowDays] = useState('180');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/compliance-documents/expiring', {
        params: {
          site_id: siteId,
          q: search || undefined,
          to: windowDays === 'all' ? undefined : isoDate(addDays(new Date(), Number(windowDays))),
          page,
          limit: 25,
        },
      });
      setRows(data.documents || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load expiring documents');
    } finally { setLoading(false); }
  }, [siteId, search, windowDays]);
  useEffect(() => { const timer = window.setTimeout(() => load(1), 250); return () => window.clearTimeout(timer); }, [load]);
  const openDocument = async (id) => {
    try {
      const { data } = await api.get(`/compliance-documents/file/${id}`);
      if (data.document?.file_url) window.open(data.document.file_url, '_blank', 'noopener,noreferrer');
    } catch (error) { toast.error(error.response?.data?.message || 'Document access denied'); }
  };
  return <Panel>
    <FilterBar search={search} setSearch={setSearch} onRefresh={() => load(pagination.page)} loading={loading}>
      <NativeSelect value={windowDays} onChange={(event) => setWindowDays(event.target.value)}>
        <option value="30">Next 30 days</option><option value="60">Next 60 days</option>
        <option value="90">Next 90 days</option><option value="180">Next 180 days</option>
        <option value="365">Next year</option><option value="all">All expiries</option>
      </NativeSelect>
    </FilterBar>
    {loading ? <div className="space-y-2 p-5">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}</div>
      : rows.length ? <Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Related record</TableHead><TableHead>Site</TableHead><TableHead>Expiry</TableHead><TableHead>Verification</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
        const expired = Number(row.days_remaining) < 0;
        const dueSoon = Number(row.days_remaining) >= 0 && Number(row.days_remaining) <= 30;
        return <TableRow key={row.id} className="cursor-pointer" onClick={() => openDocument(row.id)}>
          <TableCell><p className="max-w-sm truncate text-xs font-semibold text-slate-800">{row.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{row.original_name} · v{row.version_no}</p></TableCell>
          <TableCell><p className="text-xs">{labelize(row.entity_type)}</p><p className="text-[10px] text-slate-400">#{row.entity_id} · {labelize(row.category)}</p></TableCell>
          <TableCell className="text-xs">{row.site_name || 'Organisation-wide'}</TableCell>
          <TableCell><p className={cn('text-xs font-bold', expired ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-slate-700')}>{fmtDate(row.expiry_date)}</p><p className="text-[10px] text-slate-400">{expired ? `${Math.abs(row.days_remaining)} days expired` : `${row.days_remaining} days left`}</p></TableCell>
          <TableCell>{pill(row.verification_status, STATUS_STYLE)}</TableCell>
        </TableRow>;
      })}</TableBody></Table> : <Empty title="No expiring documents" copy="Upload documents with an expiry date to track them here." />}
    {pagination.pages > 1 && <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-xs text-slate-500">{pagination.total} documents</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
  </Panel>;
}

function MyTasksView() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data: result } = await api.get('/compliance/my-tasks'); setData(result); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not load your compliance tasks'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-[22px]" />)}</div>;
  const groups = [
    ['Compliance obligations', data?.items || [], (row) => row.title, (row) => row.current_due_date, (row) => navigate(`/compliance/register/${row.id}`)],
    ['Legal cases & hearings', data?.legal_cases || [], (row) => row.title, (row) => row.next_hearing_date, (row) => navigate(`/legal/cases/${row.id}`)],
    ['Notices requiring action', data?.notices || [], (row) => row.subject, (row) => row.reply_due_date, () => navigate('/legal/notices')],
    ['Inspections & hearings', data?.inspections || [], (row) => labelize(row.inspection_type), (row) => row.scheduled_at, () => navigate('/legal/inspections')],
  ];
  return <div className="space-y-5">
    {(data?.approvals || []).length > 0 && <Panel><div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold">Awaiting my approval</h2><p className="mt-1 text-xs text-slate-500">Completion and workflow actions requiring review.</p></div><div className="divide-y divide-slate-100">{data.approvals.map((row) => <button key={row.id} type="button" onClick={() => navigate(`/compliance/register/${row.compliance_item_id}`)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"><div><p className="text-xs font-semibold">{row.compliance_title || `Compliance #${row.compliance_item_id}`}</p><p className="mt-1 text-[10px] text-slate-400">{labelize(row.action_type)}</p></div>{pill(row.status, STATUS_STYLE)}</button>)}</div></Panel>}
    <div className="grid gap-5 lg:grid-cols-2">{groups.map(([title, rows, nameFor, dateFor, open]) => <Panel key={title}><div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{rows.length} active item{rows.length === 1 ? '' : 's'}</p></div>{rows.length ? <div className="divide-y divide-slate-100">{rows.slice(0, 50).map((row) => <button key={row.id} type="button" onClick={() => open(row)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{nameFor(row)}</p><p className="mt-1 text-[10px] text-slate-400">{row.site_name || labelize(row.stage || row.status)}</p></div><div className="text-right"><p className="text-xs font-semibold">{fmtDate(dateFor(row), Boolean(String(dateFor(row) || '').includes('T')))}</p>{row.risk_level && <div className="mt-1">{pill(row.risk_level, RISK_STYLE)}</div>}</div></button>)}</div> : <Empty title="Nothing awaiting you" copy="Assigned work will appear here automatically." />}</Panel>)}</div>
  </div>;
}

function HearingsView({ siteId }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/compliance/legal-reports', {
        params: {
          report_type: 'HEARING_CALENDAR', site_id: siteId,
          from: isoDate(addMonths(new Date(), -1)), to: isoDate(addMonths(new Date(), 12)),
        },
      });
      setRows(data.report?.rows || []);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not load legal hearings'); }
    finally { setLoading(false); }
  }, [siteId]);
  useEffect(() => { load(); }, [load]);
  return <Panel><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-sm font-bold">Legal hearing calendar</h2><p className="mt-1 text-xs text-slate-500">Next hearing, court, advocate, owner and matter risk.</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" />Refresh</Button></div>{loading ? <div className="space-y-2 p-5">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}</div> : rows.length ? <Table><TableHeader><TableRow><TableHead>Hearing</TableHead><TableHead>Matter</TableHead><TableHead>Court / case</TableHead><TableHead>Owner / advocate</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={`${row.case_code}-${index}`} className="cursor-pointer" onClick={() => navigate(`/legal/cases/${row.id}`)}><TableCell className="text-xs font-semibold">{fmtDate(row.next_hearing_date, true)}</TableCell><TableCell><p className="max-w-sm truncate text-xs font-semibold">{row.title}</p><p className="text-[10px] text-slate-400">{labelize(row.stage)} · {labelize(row.status)}</p></TableCell><TableCell><p className="text-xs">{row.court_authority || '—'}</p><p className="text-[10px] text-slate-400">{row.case_number || row.case_code}</p></TableCell><TableCell><p className="text-xs">{row.responsible_user || 'Unassigned'}</p><p className="text-[10px] text-slate-400">{row.advocate || 'No advocate'}</p></TableCell><TableCell>{pill(row.risk_level, RISK_STYLE)}</TableCell></TableRow>)}</TableBody></Table> : <Empty title="No upcoming hearings" />}</Panel>;
}

function SettingsView() {
  const [settings, setSettings] = useState(null);
  const [audit, setAudit] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusJson, setStatusJson] = useState('{}');
  const [noticeJson, setNoticeJson] = useState('{}');
  const load = useCallback(async () => { try { const [s, a] = await Promise.all([api.get('/compliance/settings'), api.get('/compliance/audit', { params: { limit: 50 } })]); setSettings(s.data.settings); setStatusJson(JSON.stringify(s.data.settings.status_transitions || {}, null, 2)); setNoticeJson(JSON.stringify(s.data.settings.notice_status_transitions || {}, null, 2)); setAudit(a.data.audit || []); } catch (error) { toast.error(error.response?.data?.message || 'Could not load compliance settings'); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...settings, status_transitions: JSON.parse(statusJson), notice_status_transitions: JSON.parse(noticeJson) };
      const { data } = await api.put('/compliance/settings', payload);
      setSettings(data.settings);
      setStatusJson(JSON.stringify(data.settings.status_transitions || {}, null, 2));
      setNoticeJson(JSON.stringify(data.settings.notice_status_transitions || {}, null, 2));
      toast.success('Compliance settings saved');
    } catch (error) {
      toast.error(error instanceof SyntaxError ? 'Workflow transitions must be valid JSON' : error.response?.data?.message || 'Could not save settings');
    } finally { setSaving(false); }
  };
  if (!settings) return <Skeleton className="h-96 rounded-[22px]" />;
  const channelSet = new Set(settings.notification_channels || []);
  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><Panel className="p-5"><h2 className="text-sm font-bold text-slate-900">Workflow & reminders</h2><p className="mt-1 text-xs text-slate-500">Organisation-level defaults; individual records can override reminder days.</p><div className="mt-5 space-y-4"><div><Label>Timezone</Label><Input className="mt-1.5" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></div><div><Label>Default reminder days</Label><Input className="mt-1.5" value={(settings.default_reminder_days || []).join(',')} onChange={(e) => setSettings({ ...settings, default_reminder_days: e.target.value.split(',').map(Number) })} /></div><div><Label>Overdue escalation days</Label><Input className="mt-1.5" value={(settings.overdue_escalation_days || []).join(',')} onChange={(e) => setSettings({ ...settings, overdue_escalation_days: e.target.value.split(',').map(Number) })} /></div><div><Label>Legal case stages</Label><Textarea className="mt-1.5 min-h-20" value={(settings.legal_case_stages || []).join(', ')} onChange={(e) => setSettings({ ...settings, legal_case_stages: e.target.value.split(',').map((value) => value.trim().toUpperCase().replaceAll(' ', '_')).filter(Boolean) })} /><p className="mt-1 text-[10px] text-slate-400">Comma-separated and organisation-specific.</p></div><div><Label>Compliance status transitions</Label><Textarea className="mt-1.5 min-h-36 font-mono text-[10px]" value={statusJson} onChange={(event) => setStatusJson(event.target.value)} /><p className="mt-1 text-[10px] text-slate-400">JSON object mapping each status to its allowed next statuses.</p></div><div><Label>Notice status transitions</Label><Textarea className="mt-1.5 min-h-36 font-mono text-[10px]" value={noticeJson} onChange={(event) => setNoticeJson(event.target.value)} /><p className="mt-1 text-[10px] text-slate-400">Only known notice statuses are accepted by the server.</p></div><label className="flex items-center justify-between rounded-xl border p-3 text-xs font-semibold"><span>Approve due-date changes</span><Switch checked={settings.due_date_change_requires_approval} onCheckedChange={(v) => setSettings({ ...settings, due_date_change_requires_approval: v })} /></label><label className="flex items-center justify-between rounded-xl border p-3 text-xs font-semibold"><span>Approve completion</span><Switch checked={settings.completion_requires_approval} onCheckedChange={(v) => setSettings({ ...settings, completion_requires_approval: v })} /></label><div><Label>Notification channels</Label><div className="mt-2 grid grid-cols-2 gap-2">{['DASHBOARD','EMAIL','SMS','WHATSAPP'].map((channel) => <label key={channel} className="flex items-center justify-between rounded-xl border p-3 text-xs"><span>{labelize(channel)}</span><Switch checked={channelSet.has(channel)} onCheckedChange={(v) => setSettings({ ...settings, notification_channels: v ? [...channelSet, channel] : [...channelSet].filter((x) => x !== channel) })} /></label>)}</div><p className="mt-2 text-[10px] leading-4 text-slate-400">SMS uses the existing queue worker; WhatsApp requires the approved compliance template configured in the environment.</p></div><Button className="w-full rounded-xl" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save settings</Button></div></Panel><Panel><div className="border-b p-5"><h2 className="text-sm font-bold">Audit trail</h2><p className="mt-1 text-xs text-slate-500">Immutable record of significant compliance and legal actions.</p></div>{audit.length ? <div className="divide-y">{audit.map((row) => <div key={row.id} className="px-5 py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-800">{labelize(row.action)} · {labelize(row.entity_type)}</p><p className="text-[10px] text-slate-400">{fmtDate(row.created_at, true)}</p></div><p className="mt-1 text-[10px] text-slate-500">{row.user_name || 'System'} · {row.site_name || 'Organisation-wide'} {row.reason ? `· ${row.reason}` : ''}</p></div>)}</div> : <Empty title="No audit events" />}</Panel></div>;
}

const VIEW_META = {
  dashboard: ['Compliance control centre', 'A live view of deadlines, risk, legal exposure and management priorities.', LayoutDashboard],
  tasks: ['My compliance tasks', 'Your obligations, approvals, hearings, notices and inspections in one focused queue.', ListChecks],
  calendar: ['Compliance calendar', 'Month, week, day, agenda and timeline views across obligations, hearings and expiries.', CalendarDays],
  register: ['Compliance register', 'The audit-ready master register for every obligation and deadline.', ClipboardCheck],
  licences: ['Approvals & licences', 'Track issue, validity, renewal and expiry across every project.', ShieldCheck],
  templates: ['Templates & periodic filings', 'Configurable recurrence, due-date rules, checklists and future task generation.', ListChecks],
  authorities: ['Authorities & departments', 'Maintain organisation-specific government, regulator and department contacts.', Landmark],
  cases: ['Legal cases', 'Track matters, exposure, stages, hearings and next action.', Gavel],
  notices: ['Notices & replies', 'Control reply deadlines, review, submission and closure.', ShieldAlert],
  inspections: ['Inspections & hearings', 'Prepare for authority visits, audits, hearings and corrective action.', CalendarRange],
  hearings: ['Legal hearings', 'A focused calendar of court, tribunal and authority hearing dates.', Gavel],
  documents: ['Document expiry', 'Monitor compliance evidence, certificates and approvals approaching expiry.', FileClock],
  reports: ['Compliance reports', 'Filter and export management and audit-ready compliance data.', FileSpreadsheet],
  settings: ['Compliance settings', 'Configure approvals, notifications, escalation and audit controls.', Settings2],
};

export default function ComplianceLegal() {
  const { currentSite } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const view = path.includes('/calendar') ? 'calendar'
    : path.includes('/my-tasks') ? 'tasks'
    : path.includes('/register') ? 'register'
      : path.includes('/licences') ? 'licences'
        : path.includes('/documents') ? 'documents'
        : path.includes('/templates') || path.includes('/filings') ? 'templates'
          : path.includes('/authorities') ? 'authorities'
            : path.includes('/legal/cases') ? 'cases'
              : path.includes('/legal/notices') ? 'notices'
                : path.includes('/legal/hearings') ? 'hearings'
                  : path.includes('/inspections') ? 'inspections'
                  : path.includes('/reports') ? 'reports'
                    : path.includes('/settings') ? 'settings'
                      : 'dashboard';
  const [title, copy, Icon] = VIEW_META[view];
  if (!currentSite && !['authorities','settings','templates'].includes(view)) return <Empty title="Select a site" copy="Compliance records and legal matters are isolated by organisation and project site." />;
  const siteId = currentSite?.id;
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <Head eyebrow={`${currentSite?.name || 'Organisation'} · Compliance & legal`} title={title} copy={copy} icon={Icon} actions={<><Link to="/compliance/calendar"><Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"><CalendarDays className="mr-2 h-4 w-4" />Calendar</Button></Link><Link to="/compliance/register"><Button className="bg-white text-slate-950 hover:bg-slate-100"><ClipboardCheck className="mr-2 h-4 w-4" />Register</Button></Link></>} />
      {view === 'dashboard' && <DashboardView siteId={siteId} />}
      {view === 'tasks' && <MyTasksView />}
      {view === 'calendar' && <CalendarView siteId={siteId} />}
      {view === 'register' && <RegisterView siteId={siteId} />}
      {view === 'licences' && <EntityRegister kind="licences" siteId={siteId} />}
      {view === 'documents' && <DocumentExpiryView siteId={siteId} />}
      {view === 'cases' && <EntityRegister kind="cases" siteId={siteId} />}
      {view === 'notices' && <EntityRegister kind="notices" siteId={siteId} />}
      {view === 'inspections' && <EntityRegister kind="inspections" siteId={siteId} />}
      {view === 'hearings' && <HearingsView siteId={siteId} />}
      {view === 'templates' && <TemplatesView siteId={siteId} />}
      {view === 'authorities' && <AuthoritiesView />}
      {view === 'reports' && <ReportsView siteId={siteId} legalMode={path.startsWith('/legal/')} />}
      {view === 'settings' && <SettingsView />}
    </div>
  );
}
