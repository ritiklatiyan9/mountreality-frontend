import { createElement, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Folder } from '../components/ui/folder-components';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Library, Search, ArrowLeft, FolderOpen, MapPin, User, LayoutGrid,
  UploadCloud, Sparkles, Loader2, FileText, FileImage, ExternalLink,
  Trash2, ChevronRight, Files, FolderCheck, CalendarDays, AlertCircle,
  RefreshCw, ShieldCheck, LockKeyhole,
} from 'lucide-react';
import { prepareDocForUpload, humanSize } from '../lib/compressDoc';
import ScanButton from '../components/ScanButton';
import { useDocViewer } from '../components/DocViewer';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';
const MAX_BYTES = 25 * 1024 * 1024;
const REGISTRY_CATEGORIES = ['REGISTRY', 'NOC'];
const categoryLabel = (value) => value === 'REGISTRY' ? 'Registry deed' : 'NOC';

const STATUS_COLORS = {
  REGISTRY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'PENDING NOC': 'bg-amber-50 text-amber-700 border-amber-200',
  REGISTERED: 'bg-green-50 text-green-700 border-green-200',
  BOOKED: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPANY: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const isImage = (mime = '') => /image\//.test(mime);

// ── Document card (grid tile with preview) ──────────────────────────────────
function DocCard({ doc, canDelete, onDelete }) {
  const openDoc = useDocViewer();
  return (
    <Motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
    >
      {/* Preview */}
      <button
        type="button"
        className="block w-full cursor-pointer"
        onClick={() => doc.file_url && openDoc({ url: doc.file_url, title: doc.title || doc.original_name, mime: doc.mime_type })}
      >
        <div className="h-32 bg-slate-50 flex items-center justify-center overflow-hidden">
          {isImage(doc.mime_type) && doc.file_url ? (
            <img src={doc.file_url} alt={doc.title || doc.original_name} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-300 group-hover:text-slate-400 transition-colors">
              <FileText className="w-10 h-10" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                {(doc.original_name || '').split('.').pop() || 'doc'}
              </span>
            </div>
          )}
        </div>
      </button>

      <Badge
        variant="outline"
        className={`absolute top-2 left-2 text-[9px] h-4.5 px-1.5 uppercase backdrop-blur-sm ${doc.category === 'NOC' ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200' : 'bg-blue-50/90 text-blue-700 border-blue-200'}`}
      >
        {doc.category}
      </Badge>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.file_url && (
          <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" title="Open" onClick={() => openDoc({ url: doc.file_url, title: doc.title || doc.original_name, mime: doc.mime_type })}>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
        {canDelete && (
          <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm text-red-500 hover:text-red-600" title="Delete" onClick={() => onDelete(doc)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800 truncate" title={doc.title || doc.original_name}>
          {doc.title || doc.original_name}
        </p>
        <p className="text-[10px] text-slate-400 truncate mt-0.5">
          {[humanSize(doc.file_size), fmtDate(doc.created_at), doc.uploaded_by_name].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Motion.div>
  );
}

// ── Folder detail: the plot's registry documents ────────────────────────────
function PlotFolderView({ plot, siteName, canWrite, canDelete, workflowUnlocked, onBack, onDocsChanged }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [registryDeedAllowed, setRegistryDeedAllowed] = useState(Boolean(workflowUnlocked));
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState('REGISTRY');
  const [catTab, setCatTab] = useState('ALL');
  const [job, setJob] = useState(null); // { stage: 'optimizing'|'uploading', name, note }
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const fileInputRef = useRef(null);
  const documentRequestRef = useRef(0);
  const categoryLocked = category === 'REGISTRY' && !registryDeedAllowed;
  const uploadAllowed = canWrite && !categoryLocked;

  const fetchDocs = useCallback(async () => {
    const requestId = ++documentRequestRef.current;
    setLoading(true);
    setLoadError('');
    setRegistryDeedAllowed(Boolean(workflowUnlocked));
    try {
      const { data } = await api.get(`/registries/documents/plot/${plot.id}`);
      if (requestId !== documentRequestRef.current) return;
      setDocs(data.documents || []);
      setRegistryDeedAllowed(Boolean(data.workflow?.registry_deed_allowed));
    } catch (err) {
      if (requestId !== documentRequestRef.current) return;
      setDocs([]);
      setLoadError(err.response?.data?.message || 'Documents could not be loaded.');
    } finally {
      if (requestId === documentRequestRef.current) setLoading(false);
    }
  }, [plot.id, workflowUnlocked]);

  useEffect(() => {
    fetchDocs();
    return () => { documentRequestRef.current += 1; };
  }, [fetchDocs]);

  useEffect(() => {
    if (workflowUnlocked) setRegistryDeedAllowed(true);
  }, [workflowUnlocked]);

  const handleFiles = async (fileList) => {
    if (!uploadAllowed || job) {
      if (categoryLocked) toast.error('Generate the NOC first, or enable the workflow override in Settings.');
      return;
    }
    // Uploads run one-by-one so the compression note stays readable; any number of files is fine.
    for (const file of Array.from(fileList || [])) {
      const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
      if (!ACCEPT.split(',').includes(ext)) { toast.error(`${file.name}: allowed types are pdf, doc, docx, jpg, png, webp`); continue; }
      try {
        setJob({ stage: 'optimizing', name: file.name, note: 'Preparing file…' });
        const { file: prepared, originalSize, finalSize } = await prepareDocForUpload(file);
        if (finalSize > MAX_BYTES) {
          toast.error(`${file.name} is too large even after optimization (${humanSize(finalSize)}, max 25 MB)`);
          continue;
        }
        const savedNote = finalSize < originalSize ? `${humanSize(originalSize)} → ${humanSize(finalSize)}` : humanSize(finalSize);
        setJob({ stage: 'uploading', name: file.name, note: `Uploading ${savedNote}…` });

        const fd = new FormData();
        fd.append('file', prepared);
        fd.append('category', category);
        fd.append('title', file.name.replace(/\.[^.]+$/, ''));
        // The browser supplies the multipart boundary for this FormData request.
        await api.post(`/registries/documents/plot/${plot.id}`, fd);
        toast.success(finalSize < originalSize ? `${file.name} uploaded (${savedNote})` : `${file.name} uploaded`);
      } catch (err) {
        toast.error(err.response?.data?.message || `Failed to upload ${file.name}`);
      }
    }
    setJob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchDocs();
    onDocsChanged?.();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/registries/documents/${deleting.id}`);
      toast.success('Document deleted');
      setDeleting(null);
      await fetchDocs();
      onDocsChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  const visibleDocs = useMemo(
    () => (catTab === 'ALL' ? docs : docs.filter((d) => String(d.category).toUpperCase() === catTab)),
    [docs, catTab]
  );
  const countOf = (cat) => docs.filter((d) => String(d.category).toUpperCase() === cat).length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400">
        <button type="button" onClick={onBack} className="hover:text-blue-700 transition-colors font-medium">Registry Documents</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-semibold">Plot {plot.plot_no}</span>
      </nav>

      {/* Plot header card */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-linear-to-r from-blue-600 via-blue-500 to-cyan-400" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} title="Back to folders">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="h-11 w-11 rounded-xl bg-linear-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-200 flex items-center justify-center shrink-0">
                <FolderOpen className="h-5.5 w-5.5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                  Plot {plot.plot_no}{plot.block ? ` · Block ${plot.block}` : ''}
                  {plot.status && (
                    <Badge variant="outline" className={STATUS_COLORS[String(plot.status).toUpperCase()] || 'bg-slate-50 text-slate-600 border-slate-200'}>
                      {plot.status}
                    </Badge>
                  )}
                </h1>
                <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {plot.buyer_name && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{plot.buyer_name}</span>}
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{siteName}</span>
                  {plot.booking_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(plot.booking_date)}</span>}
                </p>
              </div>
            </div>
            <div className="text-right">
              {workflowUnlocked && (
                <Badge variant="outline" className="mb-2 border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Workflow override
                </Badge>
              )}
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{docs.length}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">document{docs.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload zone */}
      {canWrite && (
        <div className="flex gap-2 items-stretch flex-wrap sm:flex-nowrap">
          <div
            onDragOver={(e) => { e.preventDefault(); if (uploadAllowed) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (uploadAllowed) handleFiles(e.dataTransfer.files); }}
            onClick={() => !job && uploadAllowed && fileInputRef.current?.click()}
            className={`flex-1 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 ${
              job ? 'border-blue-300 bg-blue-50/70 cursor-wait'
                : categoryLocked ? 'border-slate-200 bg-slate-100/80 cursor-not-allowed'
                : dragOver ? 'border-blue-500 bg-blue-50 scale-[1.005] cursor-copy'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30'
            }`}
            role="button"
            tabIndex={job || !uploadAllowed ? -1 : 0}
            aria-disabled={!uploadAllowed}
            aria-label={categoryLocked ? 'Registry deed upload is locked until the NOC is generated' : `Upload ${categoryLabel(category)} documents`}
            onKeyDown={(e) => {
              if (!job && uploadAllowed && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input ref={fileInputRef} type="file" accept={ACCEPT} multiple disabled={!uploadAllowed} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <AnimatePresence mode="wait" initial={false}>
              {job ? (
                <Motion.div key="job" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col items-center gap-1.5 text-blue-700">
                  {job.stage === 'optimizing' ? <Sparkles className="w-6 h-6 animate-pulse" /> : <Loader2 className="w-6 h-6 animate-spin" />}
                  <span className="text-sm font-semibold truncate max-w-[280px]">{job.name}</span>
                  <span className="text-xs text-blue-600/80">{job.note}</span>
                </Motion.div>
              ) : categoryLocked ? (
                <Motion.div key="locked" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col items-center gap-1.5 text-slate-500">
                  <div className="h-11 w-11 rounded-xl bg-slate-200/80 text-slate-500 flex items-center justify-center mb-1">
                    <LockKeyhole className="w-5.5 h-5.5" />
                  </div>
                  <p className="text-sm font-semibold">Registry deed upload is locked</p>
                  <p className="text-xs text-slate-400">Generate the NOC first, or enable the workflow override in Settings. You can still select NOC.</p>
                </Motion.div>
              ) : (
                <Motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col items-center gap-1.5">
                  <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                    <UploadCloud className="w-5.5 h-5.5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    Drop registry documents here <span className="text-slate-400 font-normal">or click to browse</span>
                  </p>
                  <p className="text-xs text-slate-400">Upload one or more PDF, Word, or image files · up to 25 MB each</p>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
          <Select value={category} onValueChange={setCategory} disabled={!!job}>
            <SelectTrigger className="h-auto w-32 shrink-0 text-xs font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REGISTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{categoryLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Registry deeds/NOCs are multi-page → feeder scan to one PDF, uploaded
              into the selected category. Renders only on computers running the
              scan bridge (see <repo>/Bookings/scan-bridge/). */}
          <ScanButton
            className="shrink-0"
            label="Scan"
            disabled={!!job || !uploadAllowed}
            format="pdf"
            source="feeder"
            onScanned={(files) => handleFiles(files)}
          />
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center justify-between gap-3">
        <Tabs value={catTab} onValueChange={setCatTab}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="ALL">All ({docs.length})</TabsTrigger>
            <TabsTrigger value="REGISTRY">Registry ({countOf('REGISTRY')})</TabsTrigger>
            <TabsTrigger value="NOC">NOC ({countOf('NOC')})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Documents grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : loadError ? (
        <Card className="border-red-100 bg-red-50/60">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-red-700">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span>
            <Button variant="outline" size="sm" onClick={fetchDocs} className="border-red-200 bg-white text-red-700 hover:bg-red-50">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : visibleDocs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileImage className="h-7 w-7 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {docs.length === 0 ? 'This folder is empty' : `No ${catTab === 'NOC' ? 'NOC' : 'registry'} documents`}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {canWrite ? 'Drop files above to add the first document.' : 'Documents will appear here once uploaded.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence initial={false}>
            {visibleDocs.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                canDelete={canDelete && d.uploaded_source === 'PLOT_REGISTRY'}
                onDelete={setDeleting}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(v) => { if (!deleteBusy && !v) setDeleting(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete Document
            </DialogTitle>
            <DialogDescription>
              Permanently delete &ldquo;{deleting?.title || deleting?.original_name}&rdquo; from Plot {plot.plot_no}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy} className="gap-1.5">
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Page: folder grid + folder detail ───────────────────────────────────────
export default function PlotRegistryDocuments() {
  const { currentSite, canManage, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plots, setPlots] = useState([]);
  const [plotsSiteId, setPlotsSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [workflowUnlocked, setWorkflowUnlocked] = useState(false);
  const [q, setQ] = useState('');
  const plotListRequestRef = useRef(0);
  const previousSiteIdRef = useRef(String(currentSite?.id || ''));
  const activeSiteIdRef = useRef(currentSite?.id);
  activeSiteIdRef.current = currentSite?.id;

  const canWrite = canManage && hasPermission('plot_registry', 'write');
  const canDelete = canManage && hasPermission('plot_registry', 'delete');

  const openPlotId = searchParams.get('plot');
  const openPlot = useMemo(
    () => (plotsSiteId === String(currentSite?.id || '')
      ? plots.find((p) => String(p.id) === String(openPlotId)) || null
      : null),
    [currentSite?.id, plots, plotsSiteId, openPlotId]
  );

  const fetchPlots = useCallback(async () => {
    const requestedSiteId = currentSite?.id;
    if (String(activeSiteIdRef.current || '') !== String(requestedSiteId || '')) return;
    const requestId = ++plotListRequestRef.current;
    if (!requestedSiteId) {
      setPlots([]);
      setPlotsSiteId('');
      setLoading(false);
      return;
    }
    setLoadError('');
    try {
      const { data } = await api.get('/registries/documents/plots', { params: { site_id: requestedSiteId } });
      if (requestId !== plotListRequestRef.current
          || String(activeSiteIdRef.current || '') !== String(requestedSiteId)) return;
      setPlots(data.plots || []);
      setPlotsSiteId(String(requestedSiteId));
    } catch (err) {
      if (requestId !== plotListRequestRef.current) return;
      setPlots([]);
      setPlotsSiteId('');
      setLoadError(err.response?.data?.message || 'Plot folders could not be loaded.');
    } finally {
      if (requestId === plotListRequestRef.current) setLoading(false);
    }
  }, [currentSite?.id]);

  useEffect(() => {
    const nextSiteId = String(currentSite?.id || '');
    plotListRequestRef.current += 1;
    setPlots([]);
    setPlotsSiteId('');
    setLoadError('');
    setLoading(Boolean(nextSiteId));
    if (previousSiteIdRef.current && previousSiteIdRef.current !== nextSiteId) {
      setSearchParams({});
    }
    previousSiteIdRef.current = nextSiteId;
    fetchPlots();
  }, [currentSite?.id, fetchPlots, setSearchParams]);

  useEffect(() => {
    let active = true;
    setWorkflowUnlocked(false);
    if (!currentSite?.id) {
      return () => { active = false; };
    }
    api.get('/settings/features', { params: { site_id: currentSite.id } })
      .then(({ data }) => {
        if (active) setWorkflowUnlocked(Boolean(data.features?.plot_registry_workflow_unlocked));
      })
      .catch(() => { if (active) setWorkflowUnlocked(false); });
    return () => { active = false; };
  }, [currentSite?.id]);

  const currentSitePlots = useMemo(
    () => (plotsSiteId === String(currentSite?.id || '') ? plots : []),
    [currentSite?.id, plots, plotsSiteId]
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return currentSitePlots;
    return currentSitePlots.filter((p) =>
      [p.plot_no, p.block, p.buyer_name].some((v) => (v || '').toLowerCase().includes(needle))
    );
  }, [currentSitePlots, q]);

  const totals = useMemo(() => ({
    plots: currentSitePlots.length,
    withDocs: currentSitePlots.filter((p) => p.doc_count > 0).length,
    docs: currentSitePlots.reduce((n, p) => n + (p.doc_count || 0), 0),
  }), [currentSitePlots]);

  if (openPlot) {
    return (
      <PlotFolderView
        plot={openPlot}
        siteName={currentSite?.name}
        canWrite={canWrite}
        canDelete={canDelete}
        workflowUnlocked={workflowUnlocked}
        onBack={() => setSearchParams({})}
        onDocsChanged={fetchPlots}
      />
    );
  }

  const statCards = [
    { label: 'Plot Folders', value: totals.plots, icon: LayoutGrid, tile: 'from-blue-700 to-blue-500 shadow-blue-200' },
    { label: 'With Documents', value: totals.withDocs, icon: FolderCheck, tile: 'from-sky-600 to-cyan-500 shadow-sky-200' },
    { label: 'Total Documents', value: totals.docs, icon: Files, tile: 'from-slate-700 to-slate-500 shadow-slate-200' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-linear-to-br from-blue-700 to-cyan-500 text-white shadow-lg shadow-blue-200">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Registry Documents</h1>
            <p className="text-sm text-slate-500">One folder per plot — open a folder to view and upload its registry documents</p>
          </div>
        </div>
        <div className="relative min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9 bg-white" placeholder="Search plot, block, buyer…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-slate-200/80 shadow-sm">
            <CardContent className="p-3.5 flex items-center gap-2.5">
              <div className={`h-9 w-9 rounded-xl bg-linear-to-br ${stat.tile} text-white shadow-md flex items-center justify-center shrink-0`}>
                {createElement(stat.icon, { className: 'h-4.5 w-4.5' })}
              </div>
              <div>
                <p className="text-xl font-bold leading-none tabular-nums">{stat.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workflowUnlocked && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Workflow override is enabled for this site. Authorized users can upload registry documents out of sequence.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="size-32 rounded-[32px] mx-auto" />)}
        </div>
      ) : loadError ? (
        <Card className="border-red-100 bg-red-50/60">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-red-700">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm font-medium">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchPlots(); }} className="border-red-200 bg-white text-red-700 hover:bg-red-50">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <LayoutGrid className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">{currentSitePlots.length === 0 ? 'No plots in this site yet' : 'No plots match your search'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="group flex flex-col items-center gap-2 focus:outline-none"
              onClick={() => setSearchParams({ plot: String(p.id) })}
              title={`Open Plot ${p.plot_no}`}
            >
              <Folder
                size="md"
                color={p.doc_count > 0 ? 'blue' : 'grey'}
                label={p.doc_count > 0 ? `${p.doc_count} file${p.doc_count === 1 ? '' : 's'}` : 'empty'}
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
                  {p.plot_no}{p.block ? ` · ${p.block}` : ''}
                </p>
                {p.buyer_name && <p className="text-[11px] text-slate-500 max-w-[130px] truncate">{p.buyer_name}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
