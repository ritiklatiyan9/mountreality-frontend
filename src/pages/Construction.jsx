import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Slider } from '../components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TableCell, TableRow } from '../components/ui/table';
import { PageHeader, EmptyBlock, PRIMARY_BTN, StatusDot } from '../components/ui/page';
import { SkeletonBlock, EmptyState } from '../components/dashboard/primitives';
import { ACCENT } from '../components/dashboard/accents';
import StockLevelIndicator from '../components/inventory/StockLevelIndicator';
import { statusTone, toneClasses, title as toTitle, money } from '../components/construction/constructionUi';
import {
  HardHat, Plus, Search, Loader2, Trash2, ArrowRight, ArrowUpRight,
  AlertTriangle, PackageOpen, ListChecks, TrendingUp, Boxes, Send, ShieldCheck, X,
} from 'lucide-react';

const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CANCELLED'];
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const PROGRESS_PRESETS = [0, 25, 50, 75, 100];
const TONE_TO_DOT = { success: 'positive', danger: 'negative', warning: 'attention', info: 'info', neutral: 'neutral' };
const dotTone = (status) => TONE_TO_DOT[statusTone(status)] || 'neutral';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

export default function Construction() {
  const { currentSite, hasPermission } = useAuth();
  const navigate = useNavigate();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('construction', 'write');
  const canUpdate = hasPermission('construction', 'update');
  const canDelete = hasPermission('construction', 'delete');

  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState({});
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status')?.toUpperCase() || 'all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  const requestSeq = useRef(0);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null); // { project, tasks, material_requests }
  const [detailLoading, setDetailLoading] = useState(false);

  // Create project dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', status: 'PLANNING', budget: '', start_date: today(), target_end_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const fetchProjects = useCallback(async () => {
    if (!siteId) return;
    const requestId = ++requestSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const [pRes, sRes] = await Promise.all([
        api.get(`/construction/projects?${params}`),
        api.get(`/construction/summary?site_id=${siteId}`),
      ]);
      if (requestId !== requestSeq.current) return;
      setProjects(pRes.data.projects || []);
      setSummary(sRes.data.summary || {});
    } catch (err) {
      if (requestId === requestSeq.current) toast.error(err.response?.data?.message || 'Failed to load projects');
    } finally {
      if (requestId === requestSeq.current) setLoading(false);
    }
  }, [siteId, statusFilter, debouncedSearch]);

  const fetchMaterials = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/inventory/materials?site_id=${siteId}`);
      setMaterials(res.data.materials || []);
    } catch {
      setMaterials([]); // construction user may lack inventory read — degrade gracefully
    }
  }, [siteId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const openDetail = async (project) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await api.get(`/construction/projects/${project.id}`);
      setDetail(res.data);
    } catch {
      toast.error('Failed to load project');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };
  const reloadDetail = async () => {
    if (!detail?.project) return;
    const res = await api.get(`/construction/projects/${detail.project.id}`);
    setDetail(res.data);
    fetchProjects();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    setSaving(true);
    try {
      await api.post('/construction/projects', { site_id: siteId, ...form, budget: form.budget || 0 });
      toast.success('Project created');
      setCreateOpen(false);
      setForm({ name: '', code: '', status: 'PLANNING', budget: '', start_date: today(), target_end_date: '', notes: '' });
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  if (!currentSite) {
    return <EmptyBlock icon={HardHat} title="Select a site to manage construction" description="Projects, tasks and material requests are scoped to one site at a time." tall />;
  }

  const kpis = [
    { label: 'Active Projects', value: summary.active_projects ?? 0, icon: HardHat, accent: 'blue' },
    { label: 'Delayed', value: summary.delayed_projects ?? 0, icon: AlertTriangle, accent: 'coral' },
    { label: 'Avg Progress', value: `${summary.avg_progress ?? 0}%`, icon: TrendingUp, accent: 'lime' },
    { label: 'Pending Requests', value: summary.pending_material_requests ?? 0, icon: PackageOpen, accent: 'amber' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-16">
      <PageHeader
        title="Construction"
        description={`Projects, tasks, material requests & site progress${currentSite?.name ? ` · ${currentSite.name}` : ''}`}
        actions={(
          <>
            <Button variant="outline" className="h-10 gap-1.5 rounded-control border-mr-line px-3.5 font-semibold" onClick={() => navigate('/construction/governance')}>
              Governance <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
            {canWrite && (
              <button type="button" className={PRIMARY_BTN} onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2} /> New Project
              </button>
            )}
          </>
        )}
      />

      {/* KPI strip */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-mr-line bg-mr-line sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center gap-3 bg-mr-surface px-4 py-4">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', ACCENT[kpi.accent].chip)}><Icon className="h-4 w-4" strokeWidth={2} /></span>
              <div className="min-w-0">
                <dd className="text-xl font-semibold tabular-nums text-mr-text">{loading ? '—' : kpi.value}</dd>
                <dt className="truncate text-[11px] font-medium text-mr-muted">{kpi.label}</dt>
              </div>
            </div>
          );
        })}
      </dl>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-mr-line pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['all', ...PROJECT_STATUSES].map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s ? 'border-mr-ink bg-mr-ink text-white' : 'border-mr-line bg-mr-surface text-mr-muted hover:border-mr-faint hover:text-mr-text')}>
              {s === 'all' ? 'All' : toTitle(s)}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mr-faint" />
          <Input placeholder="Search project name or code…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-full border-mr-line bg-mr-surface-2 pl-8 text-xs shadow-none focus-visible:bg-mr-surface" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={HardHat}
            title="No projects yet"
            description="Create a construction project to start tracking tasks, materials and cost."
            action={canWrite && (
              <button type="button" className={cn(PRIMARY_BTN, 'mt-1')} onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Project
              </button>
            )}
          />
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-zinc-900 text-zinc-300">
                <tr>
                  {['Project', 'Status', 'Progress', 'Budget', 'Actual', 'Tasks', 'Target', ''].map((h, i) => (
                    <th key={i} className={cn('px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-300', i >= 3 && i <= 4 ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const over = parseFloat(p.actual_cost) > parseFloat(p.budget) && parseFloat(p.budget) > 0;
                  return (
                    <TableRow key={p.id} className="group cursor-pointer border-mr-line hover:bg-mr-surface-2/70" onClick={() => openDetail(p)}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1 font-semibold text-mr-text transition-colors group-hover:text-mr-blue">
                          {p.name} <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                        </div>
                        {p.code && <div className="text-[11px] text-mr-faint">{p.code}</div>}
                      </TableCell>
                      <TableCell>
                        <StatusDot tone={dotTone(p.status)}>{toTitle(p.status)}{p.is_overdue && p.status !== 'DELAYED' ? ' · Overdue' : ''}</StatusDot>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[110px] items-center gap-2">
                          <Progress value={p.progress_pct} className="h-1.5 flex-1 bg-mr-surface-2 [&>div]:bg-mr-ink" />
                          <span className="w-8 text-right text-[10px] tabular-nums text-mr-muted">{p.progress_pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-mr-text">{money(p.budget)}</TableCell>
                      <TableCell className={cn('text-right font-medium tabular-nums', over ? 'text-mr-coral-ink' : 'text-mr-muted')}>{money(p.actual_cost)}</TableCell>
                      <TableCell className="text-xs text-mr-muted">
                        {p.done_task_count}/{p.task_count}
                        {p.pending_requests > 0 && <span className="ml-1 text-mr-amber-ink">· {p.pending_requests} req</span>}
                      </TableCell>
                      <TableCell className={cn('text-xs tabular-nums', p.is_overdue ? 'font-semibold text-mr-coral-ink' : 'text-mr-muted')}>{fmtDate(p.target_end_date)}</TableCell>
                      <TableCell className="text-right"><ArrowRight className="inline h-3.5 w-3.5 text-mr-faint" /></TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-panel border-mr-line sm:max-w-lg">
          <DialogHeader><DialogTitle>New Construction Project</DialogTitle><DialogDescription>Create a project to track tasks, materials and cost.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs text-mr-muted">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Block A — Boundary Wall" required /></div>
              <div className="space-y-1.5"><Label className="text-xs text-mr-muted">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-mr-muted">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{toTitle(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-mr-muted">Budget (₹)</Label><Input type="number" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-mr-muted">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-mr-muted">Target End</Label><Input type="date" value={form.target_end_date} onChange={(e) => setForm({ ...form, target_end_date: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs text-mr-muted">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Create Project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
          {detailLoading || !detail ? (
            <div className="space-y-3 p-6">
              <SkeletonBlock className="h-6 w-2/3" />
              <SkeletonBlock className="h-4 w-1/3" />
              <SkeletonBlock className="mt-4 h-28 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </div>
          ) : (
            <ProjectDetail detail={detail} materials={materials} canWrite={canWrite} canUpdate={canUpdate} canDelete={canDelete} onChanged={reloadDetail} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── A draggable, tap-friendly progress control ──────────────
// Local optimistic state keeps the drag feel instant; the PUT only
// fires once on release (or on a preset tap), not on every tick.
function ProgressControl({ value, onCommit, disabled, size = 'md' }) {
  const safeValue = value ?? 0;
  const [local, setLocal] = useState(safeValue);
  const [trackedValue, setTrackedValue] = useState(safeValue);
  if (safeValue !== trackedValue) {
    setTrackedValue(safeValue);
    setLocal(safeValue);
  }

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <Slider min={0} max={100} step={10} value={[local]} disabled={disabled}
          onValueChange={([v]) => setLocal(v)} onValueCommit={([v]) => onCommit(v)}
          className="max-w-[140px]" />
        <span className="w-8 shrink-0 text-[10px] tabular-nums text-mr-faint">{local}%</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Progress</span>
        <span className="text-lg font-semibold tabular-nums text-mr-text">{local}%</span>
      </div>
      <Slider min={0} max={100} step={5} value={[local]} disabled={disabled}
        onValueChange={([v]) => setLocal(v)} onValueCommit={([v]) => onCommit(v)}
        className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PROGRESS_PRESETS.map((p) => (
          <button key={p} type="button" disabled={disabled} onClick={() => { setLocal(p); onCommit(p); }}
            className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
              local === p ? 'border-mr-ink bg-mr-ink text-white' : 'border-mr-line text-mr-muted hover:border-mr-faint hover:text-mr-text')}>
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Project detail drawer body ──────────────────────────────
function ProjectDetail({ detail, materials, canWrite, canUpdate, canDelete, onChanged }) {
  const navigate = useNavigate();
  const { project, tasks, material_requests } = detail;
  const budget = parseFloat(project.budget) || 0;
  const actual = parseFloat(project.actual_cost) || 0;
  const costPct = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0;
  const over = actual > budget && budget > 0;

  const [newTask, setNewTask] = useState('');
  const [busy, setBusy] = useState(false);

  const patchProject = async (patch) => {
    try { await api.put(`/construction/projects/${project.id}`, patch); onChanged(); }
    catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };
  const addTask = async () => {
    if (!newTask.trim()) return;
    setBusy(true);
    try { await api.post(`/construction/projects/${project.id}/tasks`, { name: newTask.trim() }); setNewTask(''); onChanged(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to add task'); }
    finally { setBusy(false); }
  };
  const patchTask = async (taskId, patch) => {
    try { await api.put(`/construction/tasks/${taskId}`, patch); onChanged(); }
    catch { toast.error('Task update failed'); }
  };
  const delTask = async (taskId) => {
    try { await api.delete(`/construction/tasks/${taskId}`); onChanged(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-mr-line px-6 py-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="truncate text-base">{project.name}</SheetTitle>
            <SheetDescription className="mt-0.5">{project.code || 'No code'} · {fmtDate(project.start_date)} → {fmtDate(project.target_end_date)}</SheetDescription>
          </div>
          {canUpdate ? (
            <Select value={project.status} onValueChange={(v) => patchProject({ status: v })}>
              <SelectTrigger className={cn('h-8 w-36 shrink-0 border text-xs font-semibold', toneClasses[statusTone(project.status)])}><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{toTitle(s)}</SelectItem>)}</SelectContent>
            </Select>
          ) : <StatusDot tone={dotTone(project.status)} className="shrink-0">{toTitle(project.status)}</StatusDot>}
        </div>
      </SheetHeader>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-mr-line px-6 pt-3">
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="text-[13px]">Overview</TabsTrigger>
            <TabsTrigger value="tasks" className="text-[13px]">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="materials" className="text-[13px]">Materials ({material_requests.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-control border border-mr-line p-4">
            <ProgressControl value={project.progress_pct} disabled={!canUpdate} onCommit={(v) => patchProject({ progress_pct: v })} />
          </div>

          <div className="rounded-control border border-mr-line p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Budget vs Actual</span>
              {over && <StatusDot tone="negative">Over budget</StatusDot>}
            </div>
            <Progress value={costPct} className={cn('h-2 bg-mr-surface-2', over ? '[&>div]:bg-mr-coral' : '[&>div]:bg-mr-ink')} />
            <p className="mt-2 text-xs text-mr-muted">{money(actual)} <span className="text-mr-faint">of</span> {money(budget)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-control border border-mr-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Tasks</p>
              <p className="mt-1 font-semibold text-mr-text">{tasks.filter((t) => t.status === 'DONE').length} / {tasks.length} done</p>
            </div>
            <div className="rounded-control border border-mr-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Material Requests</p>
              <p className="mt-1 font-semibold text-mr-text">{material_requests.filter((r) => r.status !== 'FULFILLED' && r.status !== 'CANCELLED').length} pending</p>
            </div>
          </div>

          {project.notes && (
            <div className="rounded-control border border-mr-line p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mr-faint">Notes</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-mr-muted">{project.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-0 flex-1 overflow-y-auto px-6 py-5">
          {canWrite && (
            <div className="mb-3 flex gap-2">
              <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Add a task…" className="h-9 text-sm" />
              <Button size="sm" onClick={addTask} disabled={busy}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          )}
          <div className="space-y-2">
            {tasks.length === 0 && <EmptyState icon={ListChecks} title="No tasks yet" description={canWrite ? 'Add the first task above.' : 'Nothing has been scheduled for this project yet.'} />}
            {tasks.map((t) => (
              <div key={t.id} className="group flex items-center gap-3 rounded-control border border-mr-line p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mr-text">{t.name}</p>
                  <div className="mt-1.5">
                    <ProgressControl value={t.progress_pct} disabled={!canUpdate} size="sm" onCommit={(v) => patchTask(t.id, { progress_pct: v })} />
                  </div>
                </div>
                {canUpdate ? (
                  <Select value={t.status} onValueChange={(v) => patchTask(t.id, { status: v, progress_pct: v === 'DONE' ? 100 : t.progress_pct })}>
                    <SelectTrigger className={cn('h-7 w-28 shrink-0 border-0 text-[11px] font-semibold', toneClasses[statusTone(t.status)])}><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{toTitle(s)}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <StatusDot tone={dotTone(t.status)} className="shrink-0">{toTitle(t.status)}</StatusDot>}
                {canDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => delTask(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-mr-coral-ink" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="materials" className="mt-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="flex items-start gap-2 rounded-control border border-mr-blue/15 bg-mr-blue-soft px-3 py-2.5 text-[12px] leading-5 text-mr-blue">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
            <p>Requests and consumption below draw from live Inventory stock for this site — quantities and shortages update in real time.
              {' '}<button type="button" onClick={() => navigate('/inventory')} className="font-semibold underline underline-offset-2 hover:no-underline">Open Inventory <ArrowUpRight className="inline h-3 w-3" /></button>
            </p>
          </div>

          <MaterialRequestsSection project={project} requests={material_requests} materials={materials} canWrite={canWrite} onChanged={onChanged} onOpenInventory={() => navigate('/inventory')} />
          <div className="border-t border-mr-line pt-6">
            <ConsumeSection project={project} materials={materials} canWrite={canWrite} onChanged={onChanged} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ── Material requests + issue flow ──────────────────────────
function MaterialRequestsSection({ project, requests, materials, canWrite, onChanged, onOpenInventory }) {
  const [adding, setAdding] = useState(false);
  const [rows, setRows] = useState([{ material_id: '', qty: '' }]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const items = rows.map((r) => ({ material_id: r.material_id, qty: Number(r.qty) })).filter((r) => r.material_id && r.qty > 0);
    if (items.length === 0) return toast.error('Add at least one material with qty');
    setBusy(true);
    try {
      await api.post(`/construction/projects/${project.id}/material-requests`, { items });
      toast.success('Material request created');
      setAdding(false); setRows([{ material_id: '', qty: '' }]); onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };
  const issue = async (reqId) => {
    try {
      const res = await api.post(`/construction/material-requests/${reqId}/issue`);
      const n = (res.data.issued || []).length;
      toast.success(n ? `Issued ${n} line(s)${res.data.has_shortage ? ' — shortage remains' : ''}` : 'Nothing available to issue');
      onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Issue failed'); }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-mr-text"><PackageOpen className="w-4 h-4 text-mr-faint" /> Material Requests <span className="font-normal text-mr-faint">({requests.length})</span></h3>
        {canWrite && (
          <Button variant="outline" size="sm" className="h-7 border-mr-line text-xs" onClick={() => setAdding((v) => !v)}>
            {adding ? <X className="w-3.5 h-3.5" /> : <><Plus className="w-3.5 h-3.5 mr-1" /> New</>}
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-control border border-mr-line bg-mr-surface-2/50 p-3">
          {materials.length === 0 && (
            <p className="text-[11px] text-mr-amber-ink">
              No materials found — <button type="button" className="underline underline-offset-2" onClick={onOpenInventory}>add materials in Inventory first</button>.
            </p>
          )}
          {rows.map((r, i) => {
            const mat = materials.find((m) => String(m.id) === r.material_id);
            return (
              <div key={i} className="space-y-1.5 rounded-control border border-mr-line/70 p-2">
                <div className="flex gap-2">
                  <Select value={r.material_id || undefined} onValueChange={(v) => setRows(rows.map((x, j) => j === i ? { ...x, material_id: v } : x))}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Material" /></SelectTrigger>
                    <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} <span className="text-mr-faint">({m.unit}, avail {Number(m.available || 0).toLocaleString('en-IN')})</span></SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.001" placeholder="Qty" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} className="h-8 w-24 text-xs" />
                  {rows.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-mr-coral-ink" /></Button>}
                </div>
                {mat && <StockLevelIndicator current={mat.available} minimum={mat.min_stock} unit={mat.unit} className="pl-1" />}
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 border-mr-line text-xs" onClick={() => setRows([...rows, { material_id: '', qty: '' }])}><Plus className="w-3 h-3 mr-1" /> Row</Button>
            <Button size="sm" className="ml-auto h-7 text-xs" onClick={submit} disabled={busy}>{busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Create Request</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {requests.length === 0 && <p className="py-2 text-xs text-mr-faint">No material requests yet.</p>}
        {requests.map((r) => {
          const items = r.items || [];
          const hasShortage = items.some((it) => Number(it.qty_shortage) > 0);
          return (
            <div key={r.id} className="rounded-control border border-mr-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot tone={dotTone(r.status)}>{toTitle(r.status)}</StatusDot>
                  <span className="text-[11px] text-mr-faint">{fmtDate(r.created_at)}{r.requested_by_name ? ` · ${r.requested_by_name}` : ''}</span>
                </div>
                {canWrite && r.status !== 'FULFILLED' && r.status !== 'CANCELLED' && (
                  <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => issue(r.id)}><Send className="w-3 h-3" /> Issue available</Button>
                )}
              </div>
              <div className="space-y-1">
                {items.map((it) => {
                  const shortage = Number(it.qty_shortage) > 0;
                  return (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <span className="text-mr-text">{it.material_name} <span className="text-mr-faint">({it.unit})</span></span>
                      <span className="tabular-nums">
                        <span className="text-mr-lime-ink">{Number(it.qty_issued || 0).toLocaleString('en-IN')}</span>
                        <span className="text-mr-faint"> / </span>
                        <span className="text-mr-text">{Number(it.qty_requested || 0).toLocaleString('en-IN')}</span>
                        {shortage && <span className="ml-2"><StatusDot tone="negative">short {Number(it.qty_shortage).toLocaleString('en-IN')}</StatusDot></span>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hasShortage && r.status !== 'CANCELLED' && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-mr-amber-ink"><AlertTriangle className="w-3 h-3" /> Shortage — raise a vendor commitment to procure the balance.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Consumption quick form ──────────────────────────────────
function ConsumeSection({ project, materials, canWrite, onChanged }) {
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const mat = materials.find((m) => String(m.id) === materialId);

  const submit = async () => {
    if (!materialId || !(Number(qty) > 0)) return toast.error('Pick a material and qty');
    setBusy(true);
    try {
      await api.post(`/construction/projects/${project.id}/consume`, { material_id: Number(materialId), qty: Number(qty) });
      toast.success('Consumption recorded');
      setMaterialId(''); setQty(''); onChanged();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  if (!canWrite) {
    return (
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-mr-text"><Boxes className="w-4 h-4 text-mr-faint" /> Record Consumption</h3>
        <p className="mt-1 text-[11px] text-mr-faint">You don't have permission to draw stock for this project.</p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mr-text"><Boxes className="w-4 h-4 text-mr-faint" /> Record Consumption</h3>
      <p className="mb-2 text-[11px] text-mr-faint">Draws stock and adds to this project's actual cost.</p>
      <div className="flex gap-2">
        <Select value={materialId || undefined} onValueChange={setMaterialId}>
          <SelectTrigger className="h-9 flex-1 text-sm"><SelectValue placeholder="Material" /></SelectTrigger>
          <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} <span className="text-mr-faint">(avail {Number(m.available || 0).toLocaleString('en-IN')} {m.unit})</span></SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" step="0.001" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 w-28 text-sm" />
        <Button onClick={submit} disabled={busy} className="h-9">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Consume'}</Button>
      </div>
      {mat && (
        <div className="mt-2.5">
          <StockLevelIndicator current={mat.available} minimum={mat.min_stock} unit={mat.unit} />
          {Number(qty) > mat.available && <p className="mt-1.5 text-[11px] text-mr-coral-ink">Only {Number(mat.available).toLocaleString('en-IN')} {mat.unit} available.</p>}
        </div>
      )}
    </section>
  );
}
