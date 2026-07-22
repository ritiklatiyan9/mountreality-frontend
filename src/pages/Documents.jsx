import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  Files,
  FileUp,
  FolderSearch,
  HardDrive,
  Loader2,
  Pencil,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { prepareDocForUpload, humanSize } from '../lib/compressDoc';
import ScanButton from '../components/ScanButton';
import { useDocViewer } from '../components/DocViewer';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORIES,
  DOCUMENT_MAX_BYTES,
  assignUnassignedDocument,
  documentErrorMessage,
  listUnassignedDocuments,
  removeDocument,
  restartDocumentOcr,
  searchDocuments,
  updateDocument,
  uploadDocument,
} from '../services/documentSearch.service';

const PAGE_SIZE = 24;
const CATEGORY_MAP = Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [category.value, category]));
const ALLOWED_EXTENSIONS = new Set(DOCUMENT_ACCEPT.split(','));
const DATED_CATEGORIES = new Set(['SALE_DEED', 'AGREEMENT', 'REGISTRY']);
const EMPTY_SUMMARY = { total: 0, searchable: 0, processing: 0, failed: 0, expiring: 0 };

const METADATA_FIELDS = {
  KHATAUNI: [
    { key: 'village', label: 'Village', placeholder: 'Enter village name' },
    { key: 'khata_number', label: 'Khata number', placeholder: 'Enter khata number' },
    { key: 'khasra_number', label: 'Khasra / Gata number', placeholder: 'Enter khasra or gata number' },
    { key: 'owner_name', label: 'Owner name', placeholder: 'Enter recorded owner' },
  ],
  SALE_DEED: [
    { key: 'buyer_name', label: 'Buyer', placeholder: 'Enter buyer name' },
    { key: 'seller_name', label: 'Seller', placeholder: 'Enter seller name' },
    { key: 'plot_flat_no', label: 'Plot / flat number', placeholder: 'Enter property number' },
    { key: 'project_colony', label: 'Project / colony', placeholder: 'Enter project or colony' },
  ],
  AGREEMENT: [
    { key: 'buyer_name', label: 'First party', placeholder: 'Enter first party' },
    { key: 'seller_name', label: 'Second party', placeholder: 'Enter second party' },
    { key: 'plot_flat_no', label: 'Plot / flat number', placeholder: 'Enter property number' },
    { key: 'project_colony', label: 'Project / colony', placeholder: 'Enter project or colony' },
  ],
  REGISTRY: [
    { key: 'buyer_name', label: 'Buyer', placeholder: 'Enter buyer name' },
    { key: 'seller_name', label: 'Seller', placeholder: 'Enter seller name' },
    { key: 'plot_flat_no', label: 'Plot / flat number', placeholder: 'Enter property number' },
    { key: 'project_colony', label: 'Project / colony', placeholder: 'Enter project or colony' },
  ],
  MAP: [],
  OTHER: [],
};

const METADATA_LABELS = Object.values(METADATA_FIELDS)
  .flat()
  .reduce((labels, field) => ({ ...labels, [field.key]: field.label }), {});

const dateValue = (value) => (value ? String(value).slice(0, 10) : '');
const formatDate = (value) => {
  if (!value) return '';
  const raw = String(value);
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const isImage = (mime = '') => String(mime).startsWith('image/');
const daysUntil = (value) => {
  if (!value) return null;
  const expiry = new Date(`${dateValue(value)}T23:59:59`);
  return Math.ceil((expiry.getTime() - Date.now()) / 86400000);
};
const fileKey = (file) => `${file.name}:${file.size}:${file.lastModified}`;
const extensionOf = (file) => `.${String(file?.name || '').split('.').pop().toLowerCase()}`;
const baseFileName = (name = 'Document') => name.replace(/\.[^.]+$/, '');

function HighlightedSnippet({ text }) {
  if (!text) return null;
  const parts = String(text).split(/«|»/);
  return (
    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
      {parts.map((part, index) => (index % 2
        ? <mark key={`${part}-${index}`} className="rounded bg-blue-100 px-0.5 text-blue-900">{part}</mark>
        : <span key={`${part}-${index}`}>{part}</span>))}
    </p>
  );
}

function OcrStatus({ document, canRetry, onRetry }) {
  const status = document.ocr_status;
  if (status === 'PENDING' || status === 'PROCESSING') {
    return (
      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-[10px] text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" /> Extracting text
      </Badge>
    );
  }
  if (status === 'DONE') {
    const isArchiveOnly = document.ocr_engine === 'none';
    return (
      <Badge variant="outline" className={`gap-1 text-[10px] ${isArchiveOnly
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
        {isArchiveOnly ? <HardDrive className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
        {isArchiveOnly ? 'Stored' : 'Searchable'}
      </Badge>
    );
  }
  if (status === 'FAILED') {
    const badge = (
      <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-[10px] text-red-700">
        <AlertTriangle className="h-3 w-3" /> Extraction failed{canRetry ? ' · Retry' : ''}
      </Badge>
    );
    return canRetry ? (
      <button type="button" onClick={onRetry} title="Retry text extraction" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {badge}
      </button>
    ) : badge;
  }
  return null;
}

function MetadataFields({ category, values, onChange, docDate, expiryDate, onDates }) {
  const fields = METADATA_FIELDS[category] || [];
  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="space-y-1.5 text-xs font-medium text-slate-700">
              <span>{field.label}</span>
              <Input
                className="h-10 border-slate-200 focus-visible:ring-blue-500"
                value={values[field.key] || ''}
                placeholder={field.placeholder}
                onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      {DATED_CATEGORIES.has(category) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-slate-700">
            <span>Document date</span>
            <Input
              type="date"
              className="h-10 border-slate-200 focus-visible:ring-blue-500"
              value={docDate || ''}
              onChange={(event) => onDates({ docDate: event.target.value, expiryDate })}
            />
          </label>
          <label className="space-y-1.5 text-xs font-medium text-slate-700">
            <span>Expiry date</span>
            <Input
              type="date"
              min={docDate || undefined}
              className="h-10 border-slate-200 focus-visible:ring-blue-500"
              value={expiryDate || ''}
              onChange={(event) => onDates({ docDate, expiryDate: event.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function UploadDialog({ open, siteId, onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('KHATAUNI');
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState({});
  const [dates, setDates] = useState({ docDate: '', expiryDate: '' });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);
  const uploadAbortRef = useRef(null);

  const reset = () => {
    setFiles([]);
    setCategory('KHATAUNI');
    setTitle('');
    setMetadata({});
    setDates({ docDate: '', expiryDate: '' });
    setDragging(false);
    setBusy(false);
    setStatus('');
    setProgress(0);
    uploadAbortRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const valid = incoming.filter((file) => ALLOWED_EXTENSIONS.has(extensionOf(file)) && file.size > 0);
    const skipped = incoming.length - valid.length;
    if (skipped) toast.error(`${skipped} file${skipped === 1 ? ' was' : 's were'} skipped. Use PDF, Word, JPG, PNG, or WebP files.`);

    setFiles((current) => {
      const known = new Set(current.map(fileKey));
      const unique = valid.filter((file) => !known.has(fileKey(file)));
      const next = [...current, ...unique];
      if (next.length > 10) toast.error('A batch can contain up to 10 documents.');
      return next.slice(0, 10);
    });
  };

  const submit = async () => {
    if (!siteId) return toast.error('Select a site before uploading documents.');
    if (!files.length) return toast.error('Select at least one document.');
    if (dates.docDate && dates.expiryDate && dates.expiryDate < dates.docDate) {
      return toast.error('Expiry date cannot be earlier than the document date.');
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setBusy(true);
    const failed = [];
    const uploadedKeys = new Set();
    let uploaded = 0;
    let cancelled = false;

    for (let index = 0; index < files.length; index += 1) {
      const original = files[index];
      try {
        setProgress(0);
        setStatus(`Optimizing ${index + 1} of ${files.length}: ${original.name}`);
        const { file: prepared, finalSize } = await prepareDocForUpload(original);
        if (controller.signal.aborted) { cancelled = true; break; }
        if (finalSize > DOCUMENT_MAX_BYTES) {
          failed.push({ file: original, message: 'Still exceeds 25 MB after optimization' });
          continue;
        }

        setStatus(`Uploading ${index + 1} of ${files.length}: ${original.name}`);
        const customTitle = title.trim();
        const uploadTitle = customTitle
          ? (files.length > 1 ? `${customTitle} — ${index + 1}` : customTitle)
          : baseFileName(original.name);
        await uploadDocument({
          siteId,
          file: prepared,
          category,
          title: uploadTitle,
          metadata,
          docDate: dates.docDate,
          expiryDate: dates.expiryDate,
          signal: controller.signal,
          onProgress: setProgress,
        });
        uploaded += 1;
        uploadedKeys.add(fileKey(original));
      } catch (error) {
        if (controller.signal.aborted || error?.code === 'ERR_CANCELED') {
          cancelled = true;
          break;
        }
        failed.push({ file: original, message: documentErrorMessage(error, 'Upload failed') });
      }
    }

    setBusy(false);
    setStatus('');
    setProgress(0);
    uploadAbortRef.current = null;

    if (uploaded) {
      onUploaded();
      toast.success(`${uploaded} document${uploaded === 1 ? '' : 's'} uploaded successfully.`);
    }
    if (cancelled) toast.info('Upload cancelled.');

    if (!failed.length && !cancelled) {
      reset();
      onClose();
      return;
    }

    // Keep only failed or not-yet-attempted files. Successfully uploaded files
    // must not return to the queue after a partial failure or cancellation.
    const remaining = files.filter((file) => !uploadedKeys.has(fileKey(file)));
    setFiles(remaining);
    if (failed.length) {
      toast.error(`${failed.length} document${failed.length === 1 ? '' : 's'} could not be uploaded. ${failed[0].message}`);
    }
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-200 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <FileUp className="h-4 w-4" />
            </span>
            Upload documents
          </DialogTitle>
          <DialogDescription>
            Add up to 10 files. Images and PDFs are optimized, stored securely, and processed for full-text search.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (!busy) addFiles(event.dataTransfer.files);
              }}
              className={`group flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-slate-50/60 hover:border-blue-300 hover:bg-blue-50/60'} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }}
              />
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200">
                <UploadCloud className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">Drop files here or browse</span>
              <span className="mt-1 text-xs text-slate-500">PDF, Word, JPG, PNG, WebP · 25 MB each</span>
            </button>
            <ScanButton
              className="min-h-12 sm:min-h-32 sm:w-36 [&_button]:!border-blue-200 [&_button]:!text-blue-700 [&_button]:hover:!bg-blue-50"
              label="Scan document"
              format="pdf"
              source="feeder"
              disabled={busy}
              onScanned={addFiles}
            />
          </div>

          {files.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold text-slate-700">Upload queue</span>
                <span className="text-[11px] text-slate-500">{files.length} of 10 files</span>
              </div>
              <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto">
                {files.map((file) => (
                  <div key={fileKey(file)} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{humanSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              <span>Document type</span>
              <Select
                value={category}
                disabled={busy}
                onValueChange={(value) => { setCategory(value); setMetadata({}); setDates({ docDate: '', expiryDate: '' }); }}
              >
                <SelectTrigger className="h-10 border-slate-200 focus:ring-blue-500"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              <span>Custom title <span className="font-normal text-slate-400">(optional)</span></span>
              <Input
                className="h-10 border-slate-200 focus-visible:ring-blue-500"
                value={title}
                disabled={busy}
                maxLength={300}
                placeholder="Uses the file name when blank"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>

          <MetadataFields
            category={category}
            values={metadata}
            onChange={setMetadata}
            docDate={dates.docDate}
            expiryDate={dates.expiryDate}
            onDates={setDates}
          />

          {busy && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-blue-900">{status}</span>
                <span className="shrink-0 tabular-nums text-blue-700">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          {busy ? (
            <Button type="button" variant="outline" onClick={() => uploadAbortRef.current?.abort()} className="border-slate-300">
              Cancel upload
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          )}
          <Button
            type="button"
            disabled={busy || !files.length}
            onClick={submit}
            className="gap-2 bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {busy ? 'Uploading' : `Upload${files.length > 1 ? ` ${files.length} files` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ document, siteId, onClose, onSaved }) {
  const [category, setCategory] = useState(document.category || 'OTHER');
  const [title, setTitle] = useState(document.title || '');
  const [metadata, setMetadata] = useState(document.metadata || {});
  const [dates, setDates] = useState({
    docDate: dateValue(document.doc_date),
    expiryDate: dateValue(document.expiry_date),
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (dates.docDate && dates.expiryDate && dates.expiryDate < dates.docDate) {
      return toast.error('Expiry date cannot be earlier than the document date.');
    }
    setBusy(true);
    try {
      await updateDocument(document.id, siteId, {
        category,
        title,
        metadata,
        doc_date: dates.docDate || null,
        expiry_date: dates.expiryDate || null,
      });
      toast.success('Document details updated.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(documentErrorMessage(error, 'Document details could not be updated.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-200 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Pencil className="h-4 w-4" />
            </span>
            Edit document details
          </DialogTitle>
          <DialogDescription>Keep titles and structured details accurate to improve search results.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              <span>Document type</span>
              <Select value={category} disabled={busy} onValueChange={(value) => { setCategory(value); setMetadata({}); setDates({ docDate: '', expiryDate: '' }); }}>
                <SelectTrigger className="h-10 border-slate-200 focus:ring-blue-500"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-700">
              <span>Title</span>
              <Input
                className="h-10 border-slate-200 focus-visible:ring-blue-500"
                value={title}
                disabled={busy}
                maxLength={300}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>
          <MetadataFields
            category={category}
            values={metadata}
            onChange={setMetadata}
            docDate={dates.docDate}
            expiryDate={dates.expiryDate}
            onDates={setDates}
          />
        </div>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentCard({ document, canUpdate, canDelete, canRetry, onEdit, onDelete, onRetry }) {
  const openDocument = useDocViewer();
  const category = CATEGORY_MAP[document.category] || CATEGORY_MAP.OTHER;
  const expiryDays = daysUntil(document.expiry_date);
  const metadata = Object.entries(document.metadata || {}).filter(([, value]) => value).slice(0, 4);
  const displayTitle = document.title || document.original_name || 'Untitled document';
  const preview = () => {
    if (!document.file_url) return toast.error('A preview link is not available for this document.');
    openDocument({
      url: document.file_url,
      title: displayTitle,
      subtitle: category.label,
      mime: document.mime_type,
    });
  };

  return (
    <Motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="group flex min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60"
    >
      <button
        type="button"
        onClick={preview}
        className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Preview ${displayTitle}`}
      >
        {isImage(document.mime_type) && document.file_url ? (
          <img src={document.file_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <FileText className="h-8 w-8 text-blue-300" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-slate-950/65 py-1 text-[9px] font-semibold uppercase tracking-wide text-white">
          {String(document.original_name || '').split('.').pop() || 'FILE'}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={preview} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <h3 className="truncate text-sm font-semibold text-slate-900 hover:text-blue-700">{displayTitle}</h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{document.original_name}</p>
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            {document.file_url && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Preview" onClick={preview}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            {canUpdate && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-blue-50 hover:text-blue-700" title="Edit details" onClick={() => onEdit(document)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => onDelete(document)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">{category.label}</Badge>
          <OcrStatus document={document} canRetry={canRetry} onRetry={() => onRetry(document)} />
          {expiryDays !== null && expiryDays <= 30 && (
            <Badge variant="outline" className={`gap-1 text-[10px] ${expiryDays < 0
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              <Clock3 className="h-3 w-3" />
              {expiryDays < 0 ? `Expired ${Math.abs(expiryDays)}d ago` : expiryDays === 0 ? 'Expires today' : `${expiryDays}d remaining`}
            </Badge>
          )}
        </div>

        {metadata.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metadata.map(([key, value]) => (
              <span key={key} className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-600 ring-1 ring-inset ring-slate-100">
                <Tag className="h-2.5 w-2.5 shrink-0 text-blue-500" />
                <span className="truncate"><span className="text-slate-400">{METADATA_LABELS[key] || key}:</span> {String(value)}</span>
              </span>
            ))}
          </div>
        )}

        <HighlightedSnippet text={document.snippet} />
        <p className="mt-2 text-[10px] text-slate-400">
          {[
            humanSize(document.file_size),
            document.doc_date ? `Dated ${formatDate(document.doc_date)}` : null,
            document.created_at ? `Added ${formatDate(document.created_at)}` : null,
            document.uploaded_by_name ? `by ${document.uploaded_by_name}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Motion.article>
  );
}

function Metric({ icon, label, value, helper }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-blue-100">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-100">{icon}</span>
      </div>
      <p className="mt-1 text-[10px] text-blue-100/70">{helper}</p>
    </div>
  );
}

function LegacyDocumentReviewDialog({ open, site, onClose, onAssigned }) {
  const openDocument = useDocViewer();
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const loadQueue = useCallback(async ({ offset = 0, append = false, signal } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const result = await listUnassignedDocuments({ offset, limit: 20, signal });
      setDocuments((current) => (append ? [...current, ...result.documents] : result.documents));
      setTotal(result.total);
      setHasMore(result.hasMore);
      return result;
    } catch (requestError) {
      if (requestError?.code === 'ERR_CANCELED') return null;
      setError(documentErrorMessage(requestError, 'The legacy review queue could not be loaded.'));
      return null;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setConfirmingId(null);
    void loadQueue({ signal: controller.signal });
    return () => controller.abort();
  }, [loadQueue, open]);

  const preview = (document) => {
    if (!document.file_url) return toast.error('A preview link is not available for this document.');
    openDocument({
      url: document.file_url,
      title: document.title || document.original_name || 'Legacy document',
      subtitle: 'Unassigned legacy document',
      mime: document.mime_type,
    });
  };

  const assign = async (document) => {
    if (!site?.id) return toast.error('Select the destination site before assigning this document.');
    setAssigningId(document.id);
    try {
      await assignUnassignedDocument(document.id, site.id);
      const nextTotal = Math.max(0, total - 1);
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setTotal(nextTotal);
      setConfirmingId(null);
      toast.success(`Document assigned to ${site.name || 'the selected site'}.`);
      onAssigned(nextTotal);
      // Re-read the queue after every mutation so concurrent admin actions and
      // the banner count never leave this review screen stale.
      void loadQueue();
    } catch (assignError) {
      toast.error(documentErrorMessage(assignError, 'The document could not be assigned.'));
      void loadQueue();
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !assigningId) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-slate-200 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Review unassigned legacy documents
          </DialogTitle>
          <DialogDescription>
            These files predate site isolation and stay hidden from search until an administrator confirms their destination.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[66vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className={`rounded-xl border px-4 py-3 text-xs ${site?.id
            ? 'border-blue-200 bg-blue-50 text-blue-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {site?.id
              ? <>Destination: <span className="font-semibold">{site.name || `Site ${site.id}`}</span>. Every assignment requires a second confirmation.</>
              : 'Select a site from the main site selector before assigning a document.'}
          </div>

          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => loadQueue()} className="shrink-0 border-red-200 bg-white text-red-700">Retry</Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
            </div>
          ) : !error && documents.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Legacy review queue is clear</p>
              <p className="mt-1 text-xs text-slate-500">All legacy DMS files have a confirmed site.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => {
                const isConfirming = confirmingId === document.id;
                const isAssigning = assigningId === document.id;
                const displayTitle = document.title || document.original_name || 'Untitled document';
                return (
                  <div key={document.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => preview(document)}
                      className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-16"
                      aria-label={`Preview ${displayTitle}`}
                    >
                      {isImage(document.mime_type) && document.file_url
                        ? <img src={document.file_url} alt="" className="h-full w-full object-cover" />
                        : <FileText className="h-7 w-7 text-blue-400" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => preview(document)} className="max-w-full text-left">
                        <p className="truncate text-sm font-semibold text-slate-900 hover:text-blue-700">{displayTitle}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{document.original_name}</p>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                          {(CATEGORY_MAP[document.category] || CATEGORY_MAP.OTHER).label}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {[humanSize(document.file_size), document.created_at ? `Added ${formatDate(document.created_at)}` : null, document.uploaded_by_name ? `by ${document.uploaded_by_name}` : null].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      {isConfirming ? (
                        <>
                          <Button size="sm" variant="ghost" disabled={isAssigning} onClick={() => setConfirmingId(null)}>Cancel</Button>
                          <Button size="sm" disabled={!site?.id || isAssigning} onClick={() => assign(document)} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
                            {isAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Confirm assignment
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" disabled={!site?.id || Boolean(assigningId)} onClick={() => setConfirmingId(document.id)} className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                          Assign to site
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => loadQueue({ offset: documents.length, append: true })} className="gap-2 border-slate-200">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? 'Loading' : 'Load more'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <span className="mr-auto text-xs text-slate-500">{total} document{total === 1 ? '' : 's'} awaiting review</span>
          <Button variant="outline" disabled={Boolean(assigningId)} onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Documents() {
  const { hasPermission, currentSite, isAdmin } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('document_search', 'write');
  const canUpdate = hasPermission('document_search', 'update');
  const canDelete = hasPermission('document_search', 'delete');

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expiring, setExpiring] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [unassignedOpen, setUnassignedOpen] = useState(false);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [unassignedError, setUnassignedError] = useState('');
  const requestSequence = useRef(0);
  const loadedDocumentCountRef = useRef(0);

  useEffect(() => {
    loadedDocumentCountRef.current = documents.length;
  }, [documents.length]);

  const hasActiveFilters = category !== 'ALL' || Boolean(from) || Boolean(to) || expiring;

  const loadDocuments = useCallback(async ({ offset = 0, append = false, quiet = false, signal } = {}) => {
    if (!siteId) {
      requestSequence.current += 1;
      setDocuments([]);
      setSummary(EMPTY_SUMMARY);
      setHasMore(false);
      setError('');
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      return;
    }
    if (from && to && from > to) {
      requestSequence.current += 1;
      setError('The start date cannot be after the end date.');
      setDocuments([]);
      setSummary(EMPTY_SUMMARY);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      return;
    }

    const sequence = ++requestSequence.current;
    if (append) setLoadingMore(true);
    else if (quiet) setRefreshing(true);
    else {
      setLoading(true);
      setLoadingMore(false);
    }
    setError('');

    try {
      // A quiet refresh is used by OCR polling and mutation follow-ups. Refresh
      // every page the user has already loaded instead of collapsing the list
      // back to page one. The API accepts at most 100 rows per request, so very
      // large loaded result sets are refreshed in stable chunks.
      const refreshCount = quiet && !append && offset === 0
        ? Math.max(PAGE_SIZE, loadedDocumentCountRef.current)
        : PAGE_SIZE;
      const pageResults = [];
      for (let pageOffset = offset, remaining = refreshCount; remaining > 0;) {
        const pageLimit = Math.min(100, remaining);
        pageResults.push(await searchDocuments({
          siteId,
          query,
          category,
          from,
          to,
          expiring,
          offset: pageOffset,
          limit: pageLimit,
          signal,
        }));
        pageOffset += pageLimit;
        remaining -= pageLimit;
      }

      const firstPage = pageResults[0];
      const seen = new Set();
      const refreshedDocuments = pageResults
        .flatMap((page) => page.documents)
        .filter((document) => {
          const key = String(document.id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const result = {
        documents: refreshedDocuments,
        summary: firstPage.summary,
        hasMore: offset + refreshedDocuments.length < firstPage.total,
      };
      if (sequence !== requestSequence.current) return;
      setDocuments((current) => (append ? [...current, ...result.documents] : result.documents));
      setSummary(result.summary);
      setHasMore(result.hasMore);
    } catch (requestError) {
      if (sequence !== requestSequence.current || requestError?.code === 'ERR_CANCELED') return;
      const message = documentErrorMessage(requestError, 'Documents could not be loaded.');
      if (message) setError(message);
      // Background polling/refresh failures must retain the last successful
      // result set; otherwise one transient error also stops OCR polling.
      if (!append && !quiet) {
        setDocuments([]);
        setSummary(EMPTY_SUMMARY);
        setHasMore(false);
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [category, expiring, from, query, siteId, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadDocuments({ signal: controller.signal }), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadDocuments]);

  const loadUnassignedCount = useCallback(async ({ signal } = {}) => {
    if (!isAdmin) {
      setUnassignedTotal(0);
      setUnassignedError('');
      return;
    }
    try {
      const result = await listUnassignedDocuments({ limit: 1, signal });
      setUnassignedTotal(result.total);
      setUnassignedError('');
    } catch (requestError) {
      if (requestError?.code === 'ERR_CANCELED') return;
      setUnassignedError(documentErrorMessage(requestError, 'The legacy review queue could not be checked.'));
    }
  }, [isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    void loadUnassignedCount({ signal: controller.signal });
    return () => controller.abort();
  }, [loadUnassignedCount]);

  const hasOcrInProgress = useMemo(
    () => documents.some((document) => document.ocr_status === 'PENDING' || document.ocr_status === 'PROCESSING'),
    [documents]
  );

  useEffect(() => {
    if (!hasOcrInProgress) return undefined;
    let cancelled = false;
    let timer;
    let controller;

    const poll = async () => {
      controller = new AbortController();
      await loadDocuments({ quiet: true, signal: controller.signal });
      if (!cancelled) timer = setTimeout(poll, 4000);
    };

    timer = setTimeout(poll, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [hasOcrInProgress, loadDocuments]);

  const retryOcr = async (document) => {
    try {
      await restartDocumentOcr(document.id, siteId);
      toast.success('Text extraction restarted.');
      loadDocuments({ quiet: true });
    } catch (retryError) {
      toast.error(documentErrorMessage(retryError, 'Text extraction could not be restarted.'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await removeDocument(deleting.id, siteId);
      toast.success('Document deleted.');
      setDeleting(null);
      loadDocuments({ quiet: true });
    } catch (deleteError) {
      toast.error(documentErrorMessage(deleteError, 'Document could not be deleted.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const clearFilters = () => {
    setCategory('ALL');
    setFrom('');
    setTo('');
    setExpiring(false);
  };

  return (
    <div className="min-h-full bg-slate-50/60 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-800 via-blue-700 to-sky-600 px-5 py-6 text-white shadow-xl shadow-blue-200/50 sm:px-7">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[48px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-blue-50 backdrop-blur-sm">
                <ScanText className="h-3.5 w-3.5" /> Secure document workspace
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-lg shadow-blue-950/20">
                  <FolderSearch className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Document Search</h1>
                  <p className="mt-2 text-sm leading-6 text-blue-100">
                    Upload, classify, and search land and legal records{currentSite?.name ? ` for ${currentSite.name}` : ''}.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {canWrite && siteId && (
                  <Button onClick={() => setUploadOpen(true)} className="gap-2 bg-white text-blue-700 shadow-md hover:bg-blue-50">
                    <UploadCloud className="h-4 w-4" /> Upload documents
                  </Button>
                )}
                {(!canWrite || !siteId) && (
                  <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-blue-100">
                    {!siteId ? 'Select a site to continue' : 'Read-only access'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
              <Metric icon={<Files className="h-4 w-4" />} label="Matching records" value={summary.total} helper="Current search scope" />
              <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Searchable" value={summary.searchable} helper="Text extraction ready" />
              <Metric icon={<ScanText className="h-4 w-4" />} label="Processing" value={summary.processing} helper="Extraction in progress" />
              <Metric icon={<CalendarClock className="h-4 w-4" />} label="Expiring soon" value={summary.expiring} helper="Within 30 days" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={200}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/60 pl-12 pr-11 text-sm focus-visible:bg-white focus-visible:ring-blue-500"
                placeholder="Search names, village, plot number, document title, or extracted text"
                aria-label="Search documents"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => loadDocuments({ quiet: true })}
              disabled={refreshing}
              className="h-12 gap-2 rounded-xl border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setCategory('ALL')}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${category === 'ALL'
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              All documents
            </button>
            {DOCUMENT_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                title={item.description}
                onClick={() => setCategory(item.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${category === item.value
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              <span>From date</span>
              <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 normal-case tracking-normal text-slate-600 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-31 bg-transparent text-xs outline-none" />
              </span>
            </label>
            <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              <span>To date</span>
              <span className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 normal-case tracking-normal text-slate-600 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="w-31 bg-transparent text-xs outline-none" />
              </span>
            </label>
            <button
              type="button"
              onClick={() => setExpiring((current) => !current)}
              className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${expiring
                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              <CalendarClock className="h-4 w-4" /> Expiring in 30 days
            </button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-xs text-slate-500 hover:bg-slate-100">
                <X className="mr-1.5 h-3.5 w-3.5" /> Reset filters
              </Button>
            )}
          </div>
        </section>

        {isAdmin && unassignedTotal > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold text-blue-950">{unassignedTotal} legacy document{unassignedTotal === 1 ? ' requires' : 's require'} site review</p>
                <p className="mt-0.5 text-xs text-blue-700">They are quarantined and cannot appear in search until you confirm the correct site.</p>
              </div>
            </div>
            <Button onClick={() => setUnassignedOpen(true)} className="shrink-0 gap-2 bg-blue-600 text-white hover:bg-blue-700">
              Review documents
            </Button>
          </div>
        )}

        {isAdmin && unassignedError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {unassignedError}</span>
            <Button size="sm" variant="outline" onClick={() => loadUnassignedCount()} className="border-amber-200 bg-white text-amber-800">Retry check</Button>
          </div>
        )}

        {summary.failed > 0 && !loading && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {summary.failed} document{summary.failed === 1 ? '' : 's'} need text-extraction attention.</span>
            <span className="hidden text-amber-700 sm:inline">Use Retry on the affected document.</span>
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">Documents could not be loaded</p>
                <p className="mt-0.5 text-xs text-red-700">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadDocuments()} className="border-red-200 bg-white text-red-700 hover:bg-red-100">
              Try again
            </Button>
          </div>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Search results</h2>
              {!loading && !error && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Showing {documents.length} of {summary.total} document{summary.total === 1 ? '' : 's'}
                  {query ? ` matching “${query}”` : ''}
                </p>
              )}
            </div>
            {refreshing && <span className="flex items-center gap-1.5 text-[11px] text-blue-600"><Loader2 className="h-3 w-3 animate-spin" /> Updating</span>}
          </div>

          {loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-39 rounded-2xl" />)}
            </div>
          ) : !error && documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                {query || hasActiveFilters ? <Search className="h-6 w-6" /> : <FileImage className="h-6 w-6" />}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                {!siteId ? 'Select a site to view documents' : query || hasActiveFilters ? 'No matching documents' : 'Your document workspace is empty'}
              </h3>
              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                {!siteId
                  ? 'Choose a site from the site selector to load its secure document workspace.'
                  : query || hasActiveFilters
                  ? 'Try a broader search, another document type, or reset the date filters.'
                  : canWrite
                    ? 'Upload your first document to make titles, details, and extracted text searchable.'
                    : 'Documents will appear here after someone with upload access adds them.'}
              </p>
              {canWrite && siteId && !query && !hasActiveFilters && (
                <Button onClick={() => setUploadOpen(true)} className="mt-4 gap-2 bg-blue-600 text-white hover:bg-blue-700">
                  <UploadCloud className="h-4 w-4" /> Upload first document
                </Button>
              )}
              {(query || hasActiveFilters) && (
                <Button variant="outline" onClick={() => { setQuery(''); clearFilters(); }} className="mt-4 border-slate-200">
                  Clear search and filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                <AnimatePresence initial={false}>
                  {documents.map((document) => (
                    <DocumentCard
                      key={document.id}
                      document={document}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      canRetry={canWrite}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onRetry={retryOcr}
                    />
                  ))}
                </AnimatePresence>
              </div>
              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => loadDocuments({ offset: documents.length, append: true })}
                    className="min-w-36 gap-2 border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Files className="h-4 w-4" />}
                    {loadingMore ? 'Loading' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <UploadDialog open={uploadOpen} siteId={siteId} onClose={() => setUploadOpen(false)} onUploaded={() => loadDocuments({ quiet: true })} />
      {isAdmin && (
        <LegacyDocumentReviewDialog
          open={unassignedOpen}
          site={currentSite}
          onClose={() => setUnassignedOpen(false)}
          onAssigned={(nextTotal) => {
            setUnassignedTotal(nextTotal);
            void loadDocuments({ quiet: true });
            void loadUnassignedCount();
          }}
        />
      )}
      {editing && <EditDialog document={editing} siteId={siteId} onClose={() => setEditing(null)} onSaved={() => loadDocuments({ quiet: true })} />}

      <Dialog open={Boolean(deleting)} onOpenChange={(nextOpen) => { if (!nextOpen && !deleteBusy) setDeleting(null); }}>
        <DialogContent className="border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></span>
              Delete document
            </DialogTitle>
            <DialogDescription>
              Permanently delete “{deleting?.title || deleting?.original_name}”? The document and its search data cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy} className="gap-2">
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
