import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  FolderArchive, Search, Eye, FileText, Building2, X, MapPin,
  LayoutGrid, Files, FolderCheck, ChevronRight,
} from 'lucide-react';

// ── Shared styling/helpers (mirrors PlotPayments.jsx) ──
const STATUS_COLORS = {
  'COMPANY': 'bg-purple-50 text-purple-700 border-purple-200',
  'CREATED': 'bg-purple-50 text-purple-700 border-purple-200',
  'BOOKED': 'bg-blue-50 text-blue-700 border-blue-200',
  'REGISTRY': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'PENDING NOC': 'bg-amber-50 text-amber-700 border-amber-200',
  'CANCELLATION': 'bg-rose-50 text-rose-700 border-rose-200',
  'CANCEL': 'bg-red-50 text-red-700 border-red-200',
  'CANCELLED': 'bg-red-50 text-red-700 border-red-200',
  'RESALE': 'bg-violet-50 text-violet-700 border-violet-200',
  'UNDER CANCELLATION': 'bg-rose-50 text-rose-700 border-rose-200',
  'AGREEMENT': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'REGISTERED': 'bg-green-50 text-green-800 border-green-300',
  'COMPLETED': 'bg-green-50 text-green-800 border-green-300',
  'HOLD': 'bg-slate-50 text-slate-600 border-slate-200',
  'TRANSFERRED': 'bg-sky-50 text-sky-700 border-sky-200',
};

const fmtDate = (d) => {
  if (!d) return '—';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const naturalSortPlotNo = (a, b) => {
  const ax = (a || '').match(/([A-Za-z]*)\s*(\d*)(.*)/);
  const bx = (b || '').match(/([A-Za-z]*)\s*(\d*)(.*)/);
  const ap = ax[1].toLowerCase(), bp = bx[1].toLowerCase();
  if (ap !== bp) return ap < bp ? -1 : 1;
  const an = ax[2] ? parseInt(ax[2], 10) : 0;
  const bn = bx[2] ? parseInt(bx[2], 10) : 0;
  if (an !== bn) return an - bn;
  return (ax[3] || '').localeCompare(bx[3] || '');
};

const TH = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-3 text-left whitespace-nowrap';

// ── Memoized table row ──
const PlotRow = memo(function PlotRow({ pl, onNavigate }) {
  return (
    <tr
      className="group border-b border-slate-100 last:border-0 hover:bg-fuchsia-50/40 cursor-pointer transition-colors"
      onClick={() => onNavigate(pl.id)}
    >
      <td className="sticky left-0 z-10 bg-white group-hover:bg-fuchsia-50/40 px-3 py-2.5 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1 h-4 rounded-full bg-linear-to-b from-fuchsia-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-sm font-bold text-slate-800 group-hover:text-fuchsia-700 transition-colors">{pl.plot_no}</span>
          {pl.plot_tag && (
            <Badge variant="outline" className={`text-[9px] leading-none px-1.5 py-0.5 font-bold ${pl.plot_tag === 'OLD' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{pl.plot_tag}</Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] font-medium ${STATUS_COLORS[pl.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{pl.status || '—'}</Badge>
      </td>
      <td className="px-3 py-2.5"><span className="text-sm font-medium text-slate-800">{pl.buyer_name || '—'}</span></td>
      <td className="px-3 py-2.5"><span className="text-sm text-slate-500">{pl.block || '—'}</span></td>
      <td className="px-3 py-2.5"><span className="text-xs text-slate-500 tabular-nums">{pl.plot_size || '—'}</span></td>
      <td className="px-3 py-2.5"><span className="text-xs text-slate-600">{pl.booking_by || '—'}</span></td>
      <td className="px-3 py-2.5"><span className="text-xs text-slate-500 tabular-nums">{pl.booking_date ? fmtDate(pl.booking_date) : '—'}</span></td>
      <td className="px-3 py-2.5">
        {pl.doc_count > 0 ? (
          <Badge variant="outline" className="gap-1 text-[11px] font-semibold bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200">
            <FileText className="w-3 h-3" /> {pl.doc_count}
          </Badge>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="text-right px-3 py-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-fuchsia-600 transition-colors">
          <Eye className="w-3.5 h-3.5" /> View
          <ChevronRight className="w-3.5 h-3.5 -ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </td>
    </tr>
  );
});

// ── Sleek stat card ──
function StatCard({ icon: Icon, label, value, tile, valueClass }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm">
      <div className={`h-9 w-9 rounded-xl bg-linear-to-br ${tile} text-white shadow-md flex items-center justify-center shrink-0`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className={`text-lg font-bold leading-none tabular-nums ${valueClass || 'text-slate-900'}`}>{value}</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function PlotDocuments() {
  const navigate = useNavigate();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBookingBy, setFilterBookingBy] = useState('all');
  const [filterDocs, setFilterDocs] = useState('all'); // all | with | without

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPlots = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/plot-documents?site_id=${siteId}`);
      setPlots(res.data?.plots || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plots');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchPlots(); }, [fetchPlots]);

  const statusOptions = useMemo(() => Array.from(new Set(plots.map((p) => p.status).filter(Boolean))).sort(), [plots]);
  const bookingByOptions = useMemo(() => Array.from(new Set(plots.map((p) => p.booking_by).filter(Boolean))).sort(), [plots]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return plots
      .filter((p) => {
        if (filterStatus !== 'all' && p.status !== filterStatus) return false;
        if (filterBookingBy !== 'all' && p.booking_by !== filterBookingBy) return false;
        if (filterDocs === 'with' && !(p.doc_count > 0)) return false;
        if (filterDocs === 'without' && p.doc_count > 0) return false;
        if (q) {
          const hay = `${p.plot_no || ''} ${p.buyer_name || ''} ${p.block || ''} ${p.booking_by || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => naturalSortPlotNo(a.plot_no, b.plot_no));
  }, [plots, debouncedSearch, filterStatus, filterBookingBy, filterDocs]);

  const totalDocs = useMemo(() => plots.reduce((s, p) => s + (p.doc_count || 0), 0), [plots]);
  const withDocs = useMemo(() => plots.filter((p) => p.doc_count > 0).length, [plots]);
  const hasActiveFilters = search || filterStatus !== 'all' || filterBookingBy !== 'all' || filterDocs !== 'all';
  const clearFilters = () => { setSearch(''); setFilterStatus('all'); setFilterBookingBy('all'); setFilterDocs('all'); };
  const handleNavigate = useCallback((id) => navigate(`/plot-documents/${id}`), [navigate]);

  if (!siteId) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-3 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-slate-400" />
            </div>
            Select a site to view plot documents.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-linear-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/25 flex items-center justify-center">
            <FolderArchive className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">Plot Documents</h1>
            <p className="text-sm text-slate-500">Documents stored per plot — shared live with the Booking app</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatCard icon={LayoutGrid} label="Plots" value={plots.length} tile="from-fuchsia-500 to-purple-600 shadow-fuchsia-200" />
          <StatCard icon={FolderCheck} label="With Docs" value={withDocs} tile="from-blue-500 to-indigo-600 shadow-blue-200" />
          <StatCard icon={Files} label="Documents" value={totalDocs} tile="from-emerald-500 to-green-600 shadow-emerald-200" valueClass="text-emerald-700" />
        </div>
      </motion.div>

      {/* Filters */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plot no, buyer, block, booking by…"
                className="pl-9 h-10 rounded-xl border-slate-200 focus-visible:ring-fuchsia-400/40"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl border-slate-200"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBookingBy} onValueChange={setFilterBookingBy}>
              <SelectTrigger className="w-[160px] h-10 rounded-xl border-slate-200"><SelectValue placeholder="Booking By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Booking By</SelectItem>
                {bookingByOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDocs} onValueChange={setFilterDocs}>
              <SelectTrigger className="w-[150px] h-10 rounded-xl border-slate-200"><SelectValue placeholder="Documents" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plots</SelectItem>
                <SelectItem value="with">With Documents</SelectItem>
                <SelectItem value="without">Without Documents</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 text-slate-500 gap-1 rounded-xl">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <div className="h-1 bg-linear-to-r from-fuchsia-500 via-purple-500 to-indigo-500" />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2.5">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
            </div>
          ) : error ? (
            <div className="py-16 text-center text-rose-600 text-sm">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">{hasActiveFilters ? 'No plots match your filters.' : 'No plots found for this site.'}</p>
            </div>
          ) : (
            <div className="overflow-auto relative z-0" style={{ maxHeight: 'calc(100vh - 250px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full caption-bottom text-sm border-collapse">
                <thead className="sticky top-0 z-30 bg-linear-to-b from-slate-50 to-slate-50/95 backdrop-blur-sm" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className={`${TH} sticky left-0 z-40 bg-slate-50`}>Plot No</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Buyer</th>
                    <th className={TH}>Block</th>
                    <th className={TH}>Size</th>
                    <th className={TH}>Booking By</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Docs</th>
                    <th className={`${TH} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pl) => (
                    <PlotRow key={pl.id} pl={pl} onNavigate={handleNavigate} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {filtered.length} of {plots.length} plots · click a row to view &amp; upload documents
        </p>
      )}
    </div>
  );
}
