import { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../api/api';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  FileText, FileImage, UploadCloud, Trash2, ExternalLink, Loader2,
  FolderOpen, Sparkles, CheckCircle2, AlertCircle, RefreshCw, LockKeyhole,
} from 'lucide-react';
import { prepareDocForUpload, humanSize } from '../lib/compressDoc';
import { useDocViewer } from '../components/DocViewer';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx';
const MAX_BYTES = 25 * 1024 * 1024;
const REGISTRY_CATEGORIES = ['REGISTRY', 'NOC'];
const categoryLabel = (value) => value === 'REGISTRY' ? 'Registry deed' : 'NOC';

const docIcon = (mime = '') =>
  /image\//.test(mime) ? <FileImage className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-blue-600" />;

/** Registry Documents — upload optimized files and list the plot's deed/NOC
 * documents through registry-owned, registry-permission endpoints. */
const RegistryDocuments = ({
  plotId,
  plotNo,
  canWrite = false,
  canDelete = false,
  registryDeedAllowed = false,
  onDocumentsChange,
}) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState('REGISTRY');
  // upload stage: null | { stage: 'optimizing'|'uploading', name, note }
  const [job, setJob] = useState(null);
  const fileInputRef = useRef(null);
  const documentRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const openDoc = useDocViewer();
  const categoryLocked = category === 'REGISTRY' && !registryDeedAllowed;
  const uploadAllowed = canWrite && !categoryLocked;

  const fetchDocs = useCallback(async () => {
    if (!mountedRef.current) return [];
    const requestId = ++documentRequestRef.current;
    if (!plotId) {
      setDocs([]);
      setLoading(false);
      setLoadError('');
      onDocumentsChange?.([]);
      return [];
    }
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get(`/registries/documents/plot/${plotId}`);
      if (requestId !== documentRequestRef.current || !mountedRef.current) return [];
      const nextDocs = data.documents || [];
      setDocs(nextDocs);
      onDocumentsChange?.(nextDocs);
      return nextDocs;
    } catch (err) {
      if (requestId !== documentRequestRef.current || !mountedRef.current) return [];
      setDocs([]);
      setLoadError(err.response?.data?.message || 'Documents could not be loaded.');
      return [];
    } finally {
      if (requestId === documentRequestRef.current) setLoading(false);
    }
  }, [plotId, onDocumentsChange]);

  useEffect(() => {
    mountedRef.current = true;
    fetchDocs();
    return () => {
      mountedRef.current = false;
      documentRequestRef.current += 1;
    };
  }, [fetchDocs]);

  const handleFiles = async (fileList) => {
    if (!uploadAllowed || job) {
      if (categoryLocked) toast.error('Generate the NOC first, or enable the workflow override in Settings.');
      return;
    }
    const files = Array.from(fileList || []);
    if (!files.length) return;

    let uploaded = 0;
    for (const file of files) {
      const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
      if (!ACCEPT.split(',').includes(ext)) {
        toast.error(`${file.name}: use PDF, DOC, DOCX, JPG, PNG, or WEBP.`);
        continue;
      }

      try {
        setJob({ stage: 'optimizing', name: file.name, note: 'Preparing file…' });
        const { file: prepared, originalSize, finalSize } = await prepareDocForUpload(file);
        if (finalSize > MAX_BYTES) {
          toast.error(`${file.name} is ${humanSize(finalSize)}; the limit is 25 MB.`);
          continue;
        }
        const savedNote = finalSize < originalSize
          ? `${humanSize(originalSize)} → ${humanSize(finalSize)}`
          : humanSize(finalSize);
        setJob({ stage: 'uploading', name: file.name, note: `Uploading ${savedNote}…` });

        const fd = new FormData();
        fd.append('file', prepared);
        fd.append('category', category);
        fd.append('title', file.name.replace(/\.[^.]+$/, ''));
        // The API client has no forced content type, so the browser supplies
        // the multipart boundary for this FormData request.
        await api.post(`/registries/documents/plot/${plotId}`, fd);
        uploaded += 1;
      } catch (err) {
        toast.error(err.response?.data?.message || `Failed to upload ${file.name}.`);
      }
    }

    setJob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (uploaded) {
      toast.success(`${uploaded} ${uploaded === 1 ? 'document' : 'documents'} uploaded.`);
      await fetchDocs();
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.title || doc.original_name}"?`)) return;
    const snapshot = docs;
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    try {
      await api.delete(`/registries/documents/${doc.id}`);
      if (!mountedRef.current) return;
      toast.success('Document deleted');
      onDocumentsChange?.(snapshot.filter((item) => item.id !== doc.id));
    } catch (err) {
      if (!mountedRef.current) return;
      setDocs(snapshot);
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <Card className="shadow-none border-slate-200 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Registry Documents</h2>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-slate-500">{docs.length}</Badge>
          </div>
          {plotNo && <span className="text-[10px] text-slate-400">Plot {plotNo}</span>}
        </div>

        {!plotId ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">
            No plot record is linked to this registry — link a plot to upload its registry documents.
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {canWrite && (
              <div className="flex gap-2 items-stretch flex-wrap sm:flex-nowrap">
                <div
                  onDragOver={(e) => { e.preventDefault(); if (uploadAllowed) setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (uploadAllowed) handleFiles(e.dataTransfer.files); }}
                  onClick={() => !job && uploadAllowed && fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (!job && uploadAllowed && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={job || !uploadAllowed ? -1 : 0}
                  aria-disabled={!uploadAllowed}
                  aria-label={categoryLocked ? 'Registry deed upload is locked until the NOC is generated' : `Upload ${categoryLabel(category)} documents`}
                  className={`flex-1 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all duration-200 ${
                    job ? 'border-blue-200 bg-blue-50/60 cursor-wait'
                      : categoryLocked ? 'border-slate-200 bg-slate-100/80 text-slate-400 cursor-not-allowed'
                      : dragOver ? 'border-blue-500 bg-blue-50 scale-[1.01] cursor-copy'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30'
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept={ACCEPT} multiple disabled={!uploadAllowed} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                  <AnimatePresence mode="wait" initial={false}>
                    {job ? (
                      <Motion.div key="job" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center justify-center gap-2 text-xs text-blue-700">
                        {job.stage === 'optimizing'
                          ? <Sparkles className="w-4 h-4 animate-pulse" />
                          : <Loader2 className="w-4 h-4 animate-spin" />}
                        <span className="font-medium truncate max-w-[220px]">{job.name}</span>
                        <span className="text-blue-600/80">{job.note}</span>
                      </Motion.div>
                    ) : categoryLocked ? (
                      <Motion.div key="locked" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center justify-center gap-2 text-xs text-slate-500">
                        <LockKeyhole className="h-4 w-4" />
                        <span>Generate the NOC first, or enable the workflow override in Settings.</span>
                      </Motion.div>
                    ) : (
                      <Motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center justify-center gap-2 text-xs text-slate-500">
                        <UploadCloud className="w-4 h-4" />
                        <span>Drop files here or click to browse <span className="font-semibold">PDF, Word, or images</span></span>
                      </Motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Select value={category} onValueChange={setCategory} disabled={!!job}>
                  <SelectTrigger className="h-auto w-28 text-xs shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGISTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{categoryLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}</div>
            ) : loadError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{loadError}</span>
                <Button variant="ghost" size="sm" onClick={fetchDocs} className="h-7 shrink-0 text-red-700 hover:bg-red-100 hover:text-red-800">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : docs.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-3">No registry documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {docs.map((d) => (
                    <Motion.li
                      key={d.id} layout
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 hover:border-slate-200 hover:shadow-sm transition-all"
                    >
                      {docIcon(d.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{d.title || d.original_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {[humanSize(d.file_size), d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : '', d.uploaded_by_name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 uppercase ${d.category === 'NOC' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {d.category}
                      </Badge>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {d.file_url && (
                        <Button variant="ghost" size="sm" onClick={() => openDoc({ url: d.file_url, title: d.title || d.original_name || 'Document', mime: d.mime_type })} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="Open">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDelete && d.uploaded_source === 'PLOT_REGISTRY' && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(d)} className="h-7 w-7 p-0 text-slate-300 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </Motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistryDocuments;
