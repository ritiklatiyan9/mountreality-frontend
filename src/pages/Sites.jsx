import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertCircle, Building2, Check, CircleDot, MapPin, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';

const STATUS = {
  active: { label: 'Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: 'bg-emerald-500' },
  inactive: { label: 'Inactive', className: 'border-slate-200 bg-slate-50 text-slate-600', icon: 'bg-slate-400' },
  completed: { label: 'Completed', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: 'bg-blue-500' },
};

const siteDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const Sites = () => {
  const { refreshSites } = useAuth();
  const [sitesList, setSitesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({ name: '', code: '', address: '', city: '', state: '', description: '', status: 'active' });

  const fetchSites = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/sites');
      setSitesList(response.data?.sites || []);
    } catch {
      setMessage({ type: 'error', text: 'Could not load sites. Please try again.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSites(); }, []);

  const resetForm = () => {
    setFormData({ name: '', code: '', address: '', city: '', state: '', description: '', status: 'active' });
    setEditingId(null);
    setMessage({ type: '', text: '' });
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (site) => {
    setFormData({ name: site.name || '', code: site.code || '', address: site.address || '', city: site.city || '', state: site.state || '', description: site.description || '', status: site.status || 'active' });
    setEditingId(site.id);
    setMessage({ type: '', text: '' });
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      if (editingId) await api.put(`/sites/${editingId}`, formData);
      else await api.post('/sites', formData);
      await Promise.all([fetchSites(), refreshSites()]);
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save this site.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this site? This cannot be undone.')) return;
    try {
      await api.delete(`/sites/${id}`);
      await Promise.all([fetchSites(), refreshSites()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete this site.' });
    }
  };

  const filteredSites = useMemo(() => sitesList.filter((site) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [site.name, site.code, site.city, site.state].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || site.status === statusFilter);
  }), [searchQuery, sitesList, statusFilter]);
  const counts = useMemo(() => ({ active: sitesList.filter((site) => site.status === 'active').length, completed: sitesList.filter((site) => site.status === 'completed').length }), [sitesList]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-900/[0.03] sm:px-7">
        <div className="pointer-events-none absolute right-0 top-0 h-44 w-80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_65%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600"><Building2 className="h-5 w-5" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-600">Project directory</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Sites & properties</h1><p className="mt-1 text-sm text-slate-500">Manage the places where your team, plots and financial records work together.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="rounded-full" onClick={() => fetchSites(true)} disabled={refreshing}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button><Button size="sm" className="rounded-full bg-cyan-600 hover:bg-cyan-700" onClick={openCreate}><Plus className="mr-1.5 h-3.5 w-3.5" />Add site</Button></div></div>
      </section>

      {message.text && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{message.text}</div>}

      <section className="grid gap-3 sm:grid-cols-3"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Building2 className="h-4.5 w-4.5" /></span><div><p className="text-xl font-bold text-slate-950">{sitesList.length}</p><p className="text-[11px] font-medium text-slate-500">Total sites</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CircleDot className="h-4.5 w-4.5" /></span><div><p className="text-xl font-bold text-emerald-800">{counts.active}</p><p className="text-[11px] font-medium text-emerald-700">Active projects</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/45 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Check className="h-4.5 w-4.5" /></span><div><p className="text-xl font-bold text-blue-800">{counts.completed}</p><p className="text-[11px] font-medium text-blue-700">Completed sites</p></div></div></section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.02] sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by site, code or location" className="h-10 rounded-xl border-slate-200 pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-10 w-full rounded-xl border-slate-200 sm:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select><span className="text-xs text-slate-400 sm:pl-1">{filteredSites.length} shown</span></div></section>

      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-56 animate-pulse rounded-[24px] border border-slate-200 bg-slate-50" />)}</div> : filteredSites.length ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredSites.map((site) => { const status = STATUS[site.status] || STATUS.inactive; const location = [site.city, site.state].filter(Boolean).join(', '); return <article key={site.id} className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.025] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.06]"><div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[80px] bg-cyan-50/80" /><div className="relative flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Building2 className="h-5 w-5" /></span><Badge variant="outline" className={`gap-1.5 rounded-full px-2.5 text-[10px] font-bold ${status.className}`}><span className={`h-1.5 w-1.5 rounded-full ${status.icon}`} />{status.label}</Badge></div><div className="relative mt-5"><h2 className="truncate text-base font-bold text-slate-900">{site.name}</h2><p className="mt-1 font-mono text-[11px] text-slate-400">{site.code || 'No site code'}</p></div><div className="relative mt-5 min-h-11"><p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" />{location || site.address || 'Location not added yet'}</p></div><p className="relative mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">{site.description || 'No description added for this site.'}</p><footer className="relative mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] text-slate-400">Created {siteDate(site.created_at)}</span><span className="flex gap-1"><Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700" onClick={() => openEdit(site)} aria-label={`Edit ${site.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(site.id)} aria-label={`Delete ${site.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></span></footer></article>; })}</section> : <section className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-20 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm"><MapPin className="h-5 w-5" /></span><h2 className="mt-4 text-sm font-bold text-slate-700">No sites found</h2><p className="mt-1 text-xs text-slate-400">Try a different search, or add a new property workspace.</p><Button size="sm" className="mt-5 rounded-full bg-cyan-600 hover:bg-cyan-700" onClick={openCreate}><Plus className="mr-1.5 h-3.5 w-3.5" />Add site</Button></section>}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[24px] sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2 text-lg"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-cyan-600"><Building2 className="h-4 w-4" /></span>{editingId ? 'Edit site' : 'Create a site'}</DialogTitle><DialogDescription>{editingId ? 'Update the workspace details for this property.' : 'Add a project site for its plots, accounting records and team activity.'}</DialogDescription></DialogHeader>{message.text && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{message.text}</div>}<form onSubmit={handleSubmit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Name *</Label><Input value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} placeholder="Green Valley Residency" required /></div><div className="space-y-1.5"><Label>Code</Label><Input value={formData.code} onChange={(event) => setFormData((current) => ({ ...current, code: event.target.value }))} placeholder="GVR-001" /></div></div><div className="space-y-1.5"><Label>Address</Label><Input value={formData.address} onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))} placeholder="Full street address" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>City</Label><Input value={formData.city} onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))} placeholder="Mumbai" /></div><div className="space-y-1.5"><Label>State</Label><Input value={formData.state} onChange={(event) => setFormData((current) => ({ ...current, state: event.target.value }))} placeholder="Maharashtra" /></div></div><div className="space-y-1.5"><Label>Description</Label><Textarea value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} placeholder="A short description for the team" rows={3} /></div><div className="space-y-1.5"><Label>Status</Label><Select value={formData.status} onValueChange={(status) => setFormData((current) => ({ ...current, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">{submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create site'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
};

export default Sites;
