import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { useDocViewer } from '../components/DocViewer';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  ArrowLeft, UploadCloud, FileText, FileImage, Loader2, Trash2, Eye,
  X, Building2, Calendar, Ruler, User, ExternalLink, ChevronRight, FolderArchive,
} from 'lucide-react';

const STATUS_COLORS = {
  'COMPANY': 'bg-sky-50 text-sky-700 border-sky-200',
  'BOOKED': 'bg-blue-50 text-blue-700 border-blue-200',
  'REGISTRY': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'PENDING NOC': 'bg-amber-50 text-amber-700 border-amber-200',
  'CANCELLED': 'bg-red-50 text-red-700 border-red-200',
  'RESALE': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'TRANSFERRED': 'bg-sky-50 text-sky-700 border-sky-200',
};

const CATEGORY_OPTIONS = [
  { value: 'AGREEMENT', label: 'Agreement' },
  { value: 'MAP', label: 'Map / Layout' },
  { value: 'ALLOTMENT', label: 'Allotment Letter' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'ID_PROOF', label: 'ID Proof' },
  { value: 'OTHER', label: 'Other' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));
const CAT_COLORS = {
  AGREEMENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MAP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ALLOTMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  RECEIPT: 'bg-blue-50 text-blue-700 border-blue-200',
  ID_PROOF: 'bg-slate-50 text-slate-600 border-slate-200',
  OTHER: 'bg-slate-50 text-slate-600 border-slate-200',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
const isImg = (d) => (d?.mime_type ? d.mime_type.startsWith('image/') : /\.(jpe?g|png|webp|gif)$/i.test(d?.original_name || d?.file_path || ''));
const isPdf = (d) => (d?.mime_type ? d.mime_type === 'application/pdf' : /\.pdf$/i.test(d?.original_name || d?.file_path || ''));

export default function PlotDocumentDetail() {
  const { plotId } = useParams();
  const navigate = useNavigate();
  const { canManage, hasPermission } = useAuth();
  const openDoc = useDocViewer();
  const canWrite = canManage && hasPermission('plot_payments', 'write');
  const canDelete = canManage && hasPermission('plot_payments', 'delete');

  const [plot, setPlot] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload form
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('AGREEMENT');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null); // doc
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/plot-documents/${plotId}`);
      setPlot(res.data?.plot || null);
      setDocuments(res.data?.documents || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [plotId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const pickFile = (f) => {
    if (!f) return;
    const okType = /\.(jpe?g|png|webp|pdf|docx?)$/i.test(f.name)
      || f.type.startsWith('image/')
      || ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.type);
    if (!okType) { toast.error('Allowed file types: JPG, PNG, WEBP, PDF, DOC, and DOCX'); return; }
    if (f.size > 25 * 1024 * 1024) { toast.error('File is too large (max 25 MB)'); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Choose a file first'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      if (title.trim()) fd.append('title', title.trim());
      await api.post(`/plot-documents/${plotId}`, fd);
      toast.success('Document uploaded');
      setFile(null);
      setTitle('');
      setCategory('AGREEMENT');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/plot-documents/doc/${deleteTarget.id}`);
      toast.success('Document deleted');
      setDeleteTarget(null);
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const docLabel = (d) => d.title || CATEGORY_LABEL[d.category] || d.original_name || 'Document';

  const headerStat = useMemo(() => ([
    { icon: User, label: 'Buyer', value: plot?.buyer_name || '—' },
    { icon: Ruler, label: 'Size', value: plot?.plot_size || '—' },
    { icon: User, label: 'Booking By', value: plot?.booking_by || '—' },
    { icon: Calendar, label: 'Date', value: plot?.booking_date ? fmtDate(plot.booking_date) : '—' },
  ]), [plot]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400">
        <button type="button" onClick={() => navigate('/plot-documents')} className="inline-flex items-center gap-1 hover:text-blue-700 transition-colors font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> Plot Documents
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-semibold">Plot {plot?.plot_no || ''}</span>
      </nav>

      {/* Plot hero */}
      <Motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-slate-200/80 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-linear-to-r from-blue-600 via-sky-500 to-cyan-400" />
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-slate-900 leading-tight">Plot {plot?.plot_no || ''}</h1>
                    {plot?.status && (
                      <Badge variant="outline" className={`text-[10px] font-medium ${STATUS_COLORS[plot.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{plot.status}</Badge>
                    )}
                    {plot?.block && <span className="text-xs text-slate-400 font-medium">Block {plot.block}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{documents.length} document{documents.length === 1 ? '' : 's'} on file</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">{documents.length}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">document{documents.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {headerStat.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <s.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="leading-tight">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-medium">{s.label}</p>
                    <p className="text-xs font-semibold text-slate-800">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Motion.div>

      {/* Upload */}
      {canWrite && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4">
            <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-all duration-200 ${dragOver ? 'border-blue-400 bg-blue-50/60 scale-[1.005]' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                  <AnimatePresence mode="wait" initial={false}>
                    {file ? (
                      <Motion.div key="file" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center justify-center gap-2 text-sm text-slate-700">
                        {isPdf({ mime_type: file.type, original_name: file.name }) ? <FileText className="w-5 h-5 text-rose-500" /> : <FileImage className="w-5 h-5 text-blue-500" />}
                        <span className="font-medium truncate max-w-[260px]">{file.name}</span>
                        <span className="text-xs text-slate-400">({fmtSize(file.size)})</span>
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-slate-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                      </Motion.div>
                    ) : (
                      <Motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-slate-500">
                        <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1.5">
                          <UploadCloud className="w-5.5 h-5.5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Drop a file here <span className="text-slate-400 font-normal">or click to browse</span></p>
                        <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP, PDF or Word · up to 25 MB</p>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Title (optional)</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sale Agreement" className="h-9 rounded-xl" />
                  </div>
                </div>
              </div>
              <Button onClick={handleUpload} disabled={!file || uploading} className="h-9 gap-2 md:self-stretch md:h-auto md:px-6 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-md shadow-blue-500/20">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><UploadCloud className="w-4 h-4" /> Upload</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents grid */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
            </div>
          ) : documents.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <FolderArchive className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No documents yet for this plot.</p>
              {canWrite && <p className="text-xs text-slate-400 mt-1">Upload the first one above.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <AnimatePresence initial={false}>
                {documents.map((d, idx) => (
                  <Motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(idx * 0.02, 0.2) }}
                    className="group rounded-2xl border border-slate-200 overflow-hidden bg-white hover:border-blue-200 hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Thumbnail */}
                    <button
                      type="button"
                      onClick={() => openDoc({ url: d.file_url, title: docLabel(d), subtitle: `${CATEGORY_LABEL[d.category] || d.category || 'Doc'} · ${fmtDate(d.created_at)}`, mime: d.mime_type })}
                      className="relative aspect-[4/3] bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden"
                      title="Preview"
                    >
                      {isImg(d) && d.file_url ? (
                        <img src={d.file_url} alt={docLabel(d)} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300" />
                      ) : isPdf(d) ? (
                        <div className="w-full h-full bg-linear-to-br from-rose-50 to-red-50 flex items-center justify-center">
                          <FileText className="w-10 h-10 text-rose-400" />
                        </div>
                      ) : (
                        <FileImage className="w-10 h-10 text-slate-300" />
                      )}
                      <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <span className="h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center">
                          <Eye className="w-4.5 h-4.5 text-slate-700" />
                        </span>
                      </span>
                    </button>
                    {/* Meta */}
                    <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                      <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2" title={docLabel(d)}>{docLabel(d)}</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${CAT_COLORS[d.category] || CAT_COLORS.OTHER}`}>{CATEGORY_LABEL[d.category] || d.category || 'Doc'}</Badge>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${d.uploaded_source === 'ACCOUNT' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {d.uploaded_source === 'ACCOUNT' ? 'Account' : 'Booking'}
                        </Badge>
                      </div>
                      {d.booking_no && <p className="text-[10px] text-slate-400">Booking {d.booking_no}</p>}
                      <p className="text-[10px] text-slate-400 mt-auto">{fmtDate(d.created_at)}{d.file_size ? ` · ${fmtSize(d.file_size)}` : ''}</p>
                      {/* Actions */}
                      <div className="flex items-center gap-1 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1 rounded-lg" disabled={!d.file_url} onClick={() => openDoc({ url: d.file_url, title: docLabel(d), mime: d.mime_type })}>
                          <ExternalLink className="w-3 h-3" /> Open
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)} className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Delete document?</DialogTitle>
            <DialogDescription className="text-sm">
              &ldquo;{deleteTarget ? docLabel(deleteTarget) : ''}&rdquo; will be permanently removed from storage. This also removes it from the Booking app. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
