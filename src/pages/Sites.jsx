import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AlertCircle, Building2, Check, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import { EmptyState, SkeletonBlock } from '../components/dashboard/primitives';
import SiteRow from '../components/sites/SiteRow';
import SiteFormDialog from '../components/sites/SiteFormDialog';
import { useNavigate } from 'react-router-dom';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'completed', label: 'Completed' },
];

export const Sites = () => {
  const { refreshSites, setCurrentSite } = useAuth();
  const navigate = useNavigate();
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
      let createdSite = null;
      if (editingId) {
        await api.put(`/sites/${editingId}`, formData);
        await Promise.all([fetchSites(), refreshSites()]);
      } else {
        const response = await api.post('/sites', formData);
        createdSite = response.data?.site || null;
        const [, refreshedSites] = await Promise.all([fetchSites(), refreshSites()]);
        const selected = (refreshedSites || []).find((site) => site.id === createdSite?.id) || createdSite;
        if (selected) setCurrentSite(selected);
      }
      setDialogOpen(false);
      resetForm();
      if (createdSite?.id) {
        navigate(`/settings?tab=operating-profile&site=${createdSite.id}&mode=setup`);
      }
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
    <div className="mx-auto w-full max-w-[1280px] space-y-6">
      {/* ── Header — plain on the canvas, no banner surface ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-mr-text">
            Sites
          </h1>
          <p className="mt-1 text-[13px] text-mr-muted">
            The projects your plots, accounting records and team activity belong to
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchSites(true)}
            disabled={refreshing}
            className="h-10 rounded-full border-mr-line text-[13px]"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.9} />
            Refresh
          </Button>
          <Button
            onClick={openCreate}
            className="h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
          >
            <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Add site
          </Button>
        </div>
      </div>

      {message.text && !dialogOpen && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-control border px-4 py-3 text-[13px] ${
            message.type === 'error'
              ? 'border-mr-coral-ink/15 bg-mr-coral-soft text-mr-coral-ink'
              : 'border-mr-lime-ink/15 bg-mr-lime-soft text-mr-lime-ink'
          }`}
        >
          {message.type === 'error'
            ? <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            : <Check className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />}
          {message.text}
        </div>
      )}

      {/* ── Counts — a typographic strip on the canvas, no boxes ── */}
      <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-4 border-b border-mr-line pb-5">
        {[
          { label: 'Total sites', value: sitesList.length, tone: 'text-mr-text' },
          { label: 'Active', value: counts.active, tone: 'text-mr-lime-ink' },
          { label: 'Completed', value: counts.completed, tone: 'text-mr-blue' },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-[12px] text-mr-muted">{stat.label}</dt>
            <dd className={`mt-0.5 text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${stat.tone}`}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* ── Filters — inline, not wrapped in a panel ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="mr-site-search" className="sr-only">Search sites</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mr-faint" strokeWidth={1.9} aria-hidden="true" />
          <Input
            id="mr-site-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by site, code or location"
            className="h-10 rounded-full border-mr-line bg-mr-surface-2 pl-10 text-[13px] shadow-none focus-visible:border-mr-blue focus-visible:bg-mr-surface focus-visible:ring-2 focus-visible:ring-mr-blue/25"
          />
        </div>

        <div role="radiogroup" aria-label="Filter by status" className="mr-rail flex items-center gap-0.5 overflow-x-auto rounded-full border border-mr-line bg-mr-surface-2 p-1">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={statusFilter === option.key}
              onClick={() => setStatusFilter(option.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mr-blue focus-visible:ring-offset-1 ${
                statusFilter === option.key ? 'bg-mr-ink text-white' : 'text-mr-muted hover:text-mr-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[12px] text-mr-muted">
          {filteredSites.length} shown
        </span>
      </div>

      {/* ── Directory — one surface, sites as rows ── */}
      <section className="overflow-hidden rounded-panel border border-mr-line bg-mr-surface">
        {loading ? (
          <div className="space-y-3 p-5 sm:p-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14 w-full" />)}
          </div>
        ) : filteredSites.length === 0 ? (
          <EmptyState
            icon={sitesList.length === 0 ? Building2 : MapPin}
            title={sitesList.length === 0 ? 'No sites yet' : 'No sites match this filter'}
            description={sitesList.length === 0
              ? 'Create your first project site — plots, ledgers and team activity all hang off it.'
              : 'Try a different search term, or switch the status filter back to All.'}
            action={sitesList.length === 0 ? (
              <Button
                onClick={openCreate}
                className="mt-1 h-10 rounded-full bg-mr-ink px-4 text-[13px] font-semibold text-white hover:bg-mr-ink-2"
              >
                <Plus className="mr-1.5 h-4 w-4" strokeWidth={2} /> Add site
              </Button>
            ) : null}
          />
        ) : (
          <ul className="divide-y divide-mr-line">
            {filteredSites.map((site) => (
              <SiteRow key={site.id} site={site} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </section>

      <SiteFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}
        editing={!!editingId}
        form={formData}
        onChange={setFormData}
        onSubmit={handleSubmit}
        submitting={submitting}
        message={message}
      />
    </div>
  );
};

export default Sites;
