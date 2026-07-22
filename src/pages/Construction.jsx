import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { TableCell, TableRow } from '../components/ui/table';
import {
  HardHat, Plus, Search, Loader2, Trash2, ArrowRight,
  AlertTriangle, PackageOpen, ListChecks, TrendingUp, X, Boxes, Send,
} from 'lucide-react';

const STATUS = {
  PLANNING:  { label: 'Planning',  cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  ACTIVE:    { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  ON_HOLD:   { label: 'On Hold',   cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  DELAYED:   { label: 'Delayed',   cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  COMPLETED: { label: 'Completed', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-50 text-slate-400 border-slate-200', dot: 'bg-slate-300' },
};
const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'DELAYED', 'COMPLETED', 'CANCELLED'];
const TASK_STATUS = {
  PENDING:     { label: 'Pending',     cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700' },
  BLOCKED:     { label: 'Blocked',     cls: 'bg-red-100 text-red-700' },
  DONE:        { label: 'Done',        cls: 'bg-emerald-100 text-emerald-700' },
};
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
const REQ_STATUS = {
  DRAFT:               { label: 'Draft',     cls: 'bg-slate-100 text-slate-600' },
  REQUESTED:           { label: 'Requested', cls: 'bg-amber-100 text-amber-700' },
  PARTIALLY_FULFILLED: { label: 'Partial',   cls: 'bg-orange-100 text-orange-700' },
  FULFILLED:           { label: 'Fulfilled', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:           { label: 'Cancelled', cls: 'bg-slate-100 text-slate-400' },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

export default function Construction() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState({});
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status')?.toUpperCase() || 'all');
  const [search, setSearch] = useState('');

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null); // { project, tasks, material_requests }
  const [detailLoading, setDetailLoading] = useState(false);

  // Create project dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', status: 'PLANNING', budget: '', start_date: today(), target_end_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const [pRes, sRes] = await Promise.all([
        api.get(`/construction/projects?${params}`),
        api.get(`/construction/summary?site_id=${siteId}`),
      ]);
      setProjects(pRes.data.projects || []);
      setSummary(sRes.data.summary || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [siteId, statusFilter, search]);

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
    } catch (err) {
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

  const filtered = useMemo(() => projects, [projects]);

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <HardHat className="w-10 h-10" />
        <p className="text-sm">Select a site to manage construction</p>
      </div>
    );
  }

  const kpis = [
    { label: 'Active Projects', value: summary.active_projects ?? 0, icon: HardHat, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Delayed', value: summary.delayed_projects ?? 0, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
    { label: 'Avg Progress', value: `${summary.avg_progress ?? 0}%`, icon: TrendingUp, color: 'bg-sky-100 text-sky-600' },
    { label: 'Pending Requests', value: summary.pending_material_requests ?? 0, icon: PackageOpen, color: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Construction</h1>
          <p className="text-xs text-slate-500">Projects, tasks, material requests & site progress{currentSite?.name ? ` · ${currentSite.name}` : ''}</p>
        </div>
        <Button className="h-10 gap-2 rounded-xl bg-blue-600 px-4 font-semibold shadow-sm shadow-blue-600/25 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
            <CardContent className="p-4 flex items-center gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', color)}><Icon className="w-4 h-4" /></span>
              <div>
                <p className="text-xl font-bold text-slate-900">{loading ? '—' : value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          {['all', ...PROJECT_STATUSES].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                statusFilter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
              {s === 'all' ? 'All' : STATUS[s].label}
            </button>
          ))}
          <div className="relative flex-1 min-w-[180px] ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="Search project name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <HardHat className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No projects yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Project</Button>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    {['Project', 'Status', 'Progress', 'Budget', 'Actual', 'Tasks', 'Target', ''].map((h, i) => (
                      <th key={i} className={cn('text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2', i >= 3 && i <= 4 ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const st = STATUS[p.status] || STATUS.PLANNING;
                    const over = parseFloat(p.actual_cost) > parseFloat(p.budget) && parseFloat(p.budget) > 0;
                    return (
                      <TableRow key={p.id} className="group cursor-pointer" onClick={() => openDetail(p)}>
                        <TableCell className="py-2.5">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                            {p.name} <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </div>
                          {p.code && <div className="text-[11px] text-slate-400">{p.code}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className={cn('text-[10px] font-semibold gap-1', st.cls)}><span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}{p.is_overdue && p.status !== 'DELAYED' ? ' !' : ''}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[110px]"><Progress value={p.progress_pct} className="h-1.5 flex-1" /><span className="text-[10px] text-slate-500 w-8 text-right">{p.progress_pct}%</span></div>
                        </TableCell>
                        <TableCell className="text-right font-medium">₹{fmt(p.budget)}</TableCell>
                        <TableCell className={cn('text-right font-medium', over ? 'text-red-600' : 'text-slate-600')}>₹{fmt(p.actual_cost)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{p.done_task_count}/{p.task_count}{p.pending_requests > 0 && <span className="ml-1 text-amber-600">· {p.pending_requests} req</span>}</TableCell>
                        <TableCell className={cn('text-xs', p.is_overdue ? 'text-red-600 font-semibold' : 'text-slate-500')}>{fmtDate(p.target_end_date)}</TableCell>
                        <TableCell className="text-right"><ArrowRight className="w-3.5 h-3.5 text-slate-300 inline" /></TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New Construction Project</DialogTitle><DialogDescription>Create a project to track tasks, materials and cost.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Block A — Boundary Wall" required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Budget (₹)</Label><Input type="number" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Target End</Label><Input type="date" value={form.target_end_date} onChange={(e) => setForm({ ...form, target_end_date: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
            <div className="flex flex-1 items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : (
            <ProjectDetail detail={detail} materials={materials} onChanged={reloadDetail} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Project detail drawer body ──────────────────────────────
function ProjectDetail({ detail, materials, onChanged }) {
  const { project, tasks, material_requests } = detail;
  const st = STATUS[project.status] || STATUS.PLANNING;
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
    catch (err) { toast.error('Task update failed'); }
  };
  const delTask = async (taskId) => {
    try { await api.delete(`/construction/tasks/${taskId}`); onChanged(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-slate-100 px-6 py-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle className="text-base truncate">{project.name}</SheetTitle>
            <SheetDescription className="mt-0.5">{project.code || 'No code'} · {fmtDate(project.start_date)} → {fmtDate(project.target_end_date)}</SheetDescription>
          </div>
          <Select value={project.status} onValueChange={(v) => patchProject({ status: v })}>
            <SelectTrigger className={cn('h-8 w-36 text-xs font-semibold border', st.cls)}><SelectValue /></SelectTrigger>
            <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Progress + budget */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Progress</span><span className="text-sm font-bold">{project.progress_pct}%</span></div>
            <Progress value={project.progress_pct} className="h-2" />
            <input type="range" min="0" max="100" step="5" value={project.progress_pct}
              onChange={(e) => patchProject({ progress_pct: parseInt(e.target.value, 10) })}
              className="w-full mt-2 accent-blue-600" />
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Budget vs Actual</span>{over && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">Over</Badge>}</div>
            <Progress value={costPct} className={cn('h-2', over && '[&>div]:bg-red-500')} />
            <p className="mt-2 text-xs text-slate-500">₹{fmt(actual)} <span className="text-slate-300">of</span> ₹{fmt(budget)}</p>
          </div>
        </div>

        {/* Tasks */}
        <section>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2"><ListChecks className="w-4 h-4 text-slate-400" /> Tasks <span className="text-slate-400 font-normal">({tasks.length})</span></h3>
          <div className="flex gap-2 mb-3">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="Add a task…" className="h-9 text-sm" />
            <Button size="sm" onClick={addTask} disabled={busy}><Plus className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-xs text-slate-400 py-2">No tasks yet.</p>}
            {tasks.map((t) => {
              const ts = TASK_STATUS[t.status] || TASK_STATUS.PENDING;
              return (
                <div key={t.id} className="group flex items-center gap-2 rounded-lg border border-slate-200 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    <div className="mt-1 flex items-center gap-2"><Progress value={t.progress_pct} className="h-1 flex-1 max-w-[120px]" /><span className="text-[10px] text-slate-400">{t.progress_pct}%</span></div>
                  </div>
                  <Select value={t.status} onValueChange={(v) => patchTask(t.id, { status: v, progress_pct: v === 'DONE' ? 100 : t.progress_pct })}>
                    <SelectTrigger className={cn('h-7 w-28 text-[11px] font-semibold border-0', ts.cls)}><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS[s].label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => delTask(t.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Material Requests */}
        <MaterialRequestsSection project={project} requests={material_requests} materials={materials} onChanged={onChanged} />

        {/* Consumption */}
        <ConsumeSection project={project} materials={materials} onChanged={onChanged} />
      </div>
    </>
  );
}

// ── Material requests + issue flow ──────────────────────────
function MaterialRequestsSection({ project, requests, materials, onChanged }) {
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
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><PackageOpen className="w-4 h-4 text-slate-400" /> Material Requests <span className="text-slate-400 font-normal">({requests.length})</span></h3>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdding((v) => !v)}>{adding ? <X className="w-3.5 h-3.5" /> : <><Plus className="w-3.5 h-3.5 mr-1" /> New</>}</Button>
      </div>

      {adding && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-3 space-y-2">
          {materials.length === 0 && <p className="text-[11px] text-amber-600">No materials found — add materials in Inventory first.</p>}
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Select value={r.material_id || undefined} onValueChange={(v) => setRows(rows.map((x, j) => j === i ? { ...x, material_id: v } : x))}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Material" /></SelectTrigger>
                <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} <span className="text-slate-400">({m.unit}, avail {fmt(m.available)})</span></SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" step="0.001" placeholder="Qty" value={r.qty} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} className="h-8 w-24 text-xs" />
              {rows.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRows([...rows, { material_id: '', qty: '' }])}><Plus className="w-3 h-3 mr-1" /> Row</Button>
            <Button size="sm" className="h-7 text-xs ml-auto" onClick={submit} disabled={busy}>{busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Create Request</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {requests.length === 0 && <p className="text-xs text-slate-400 py-2">No material requests yet.</p>}
        {requests.map((r) => {
          const rs = REQ_STATUS[r.status] || REQ_STATUS.REQUESTED;
          const items = r.items || [];
          const hasShortage = items.some((it) => Number(it.qty_shortage) > 0);
          return (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px] font-semibold', rs.cls)}>{rs.label}</Badge>
                  <span className="text-[11px] text-slate-400">{fmtDate(r.created_at)}{r.requested_by_name ? ` · ${r.requested_by_name}` : ''}</span>
                </div>
                {r.status !== 'FULFILLED' && r.status !== 'CANCELLED' && (
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => issue(r.id)}><Send className="w-3 h-3" /> Issue available</Button>
                )}
              </div>
              <div className="space-y-1">
                {items.map((it) => {
                  const shortage = Number(it.qty_shortage) > 0;
                  return (
                    <div key={it.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{it.material_name} <span className="text-slate-400">({it.unit})</span></span>
                      <span className="tabular-nums">
                        <span className="text-emerald-600">{fmt(it.qty_issued)}</span>
                        <span className="text-slate-300"> / </span>
                        <span className="text-slate-700">{fmt(it.qty_requested)}</span>
                        {shortage && <Badge variant="outline" className="ml-2 text-[9px] bg-red-50 text-red-600 border-red-200">short {fmt(it.qty_shortage)}</Badge>}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hasShortage && r.status !== 'CANCELLED' && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="w-3 h-3" /> Shortage — raise a vendor commitment to procure the balance.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Consumption quick form ──────────────────────────────────
function ConsumeSection({ project, materials, onChanged }) {
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

  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2"><Boxes className="w-4 h-4 text-slate-400" /> Record Consumption</h3>
      <p className="text-[11px] text-slate-400 mb-2">Draws stock and adds to this project's actual cost.</p>
      <div className="flex gap-2">
        <Select value={materialId || undefined} onValueChange={setMaterialId}>
          <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Material" /></SelectTrigger>
          <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name} <span className="text-slate-400">(avail {fmt(m.available)} {m.unit})</span></SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" step="0.001" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 w-28 text-sm" />
        <Button onClick={submit} disabled={busy} className="h-9">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Consume'}</Button>
      </div>
      {mat && Number(qty) > mat.available && <p className="mt-1.5 text-[11px] text-red-600">Only {fmt(mat.available)} {mat.unit} available.</p>}
    </section>
  );
}
