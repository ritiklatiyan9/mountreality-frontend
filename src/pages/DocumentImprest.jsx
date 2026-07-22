import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import CameraCapture from '../components/CameraCapture';
import { useDocViewer } from '../components/DocViewer';
import {
  Activity, ArrowUpRight, BellRing, FileBox, FileCheck2,
  Info, Plus, Search, Loader2, Camera, RefreshCw, Undo2, Eye,
  Clock, AlertTriangle, CheckCircle2, ArchiveRestore, ImageOff,
  MoreVertical, Pencil, Trash2, CalendarClock, ShieldCheck, Sparkles,
  TimerReset, Download,
} from 'lucide-react';

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** ISO string → value for <input type="datetime-local"> in LOCAL time. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const isOverdue = (r) => r.status === 'ISSUED' && r.expected_return_at && new Date(r.expected_return_at) < new Date();

const receiverOf = (r) => r.receiver_user_name || r.receiver_name || '—';

/** "due in 2 days" / "3 hours overdue" style hint under the deadline. */
const dueHint = (r) => {
  if (!r.expected_return_at || r.status !== 'ISSUED') return null;
  const ms = new Date(r.expected_return_at) - Date.now();
  const abs = Math.abs(ms);
  const unit = abs >= 864e5 ? [Math.round(abs / 864e5), 'day'] : abs >= 36e5 ? [Math.round(abs / 36e5), 'hour'] : [Math.max(1, Math.round(abs / 6e4)), 'min'];
  const label = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`;
  return ms < 0 ? `${label} overdue` : `due in ${label}`;
};

// ── Issue / Edit dialog (one form, two modes) ───────────────────────────────
// mode 'create': camera proof required, POST multipart.
// mode 'edit':   proof is immutable, PUT json of the editable fields.
function RecordFormDialog({ open, record, peers, siteId, onOpenChange, onSaved }) {
  const editing = !!record;
  const [form, setForm] = useState({ document_name: '', description: '', remarks: '' });
  const [receiverMode, setReceiverMode] = useState('user');
  const [receiverUserId, setReceiverUserId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({ document_name: record.document_name || '', description: record.description || '', remarks: record.remarks || '' });
      setReceiverMode(record.receiver_user_id ? 'user' : 'outside');
      setReceiverUserId(record.receiver_user_id ? String(record.receiver_user_id) : '');
      setReceiverName(record.receiver_name || '');
      setHasDeadline(!!record.expected_return_at);
      setExpectedReturnAt(toLocalInput(record.expected_return_at));
    } else {
      setForm({ document_name: '', description: '', remarks: '' });
      setReceiverMode('user'); setReceiverUserId(''); setReceiverName('');
      setHasDeadline(false); setExpectedReturnAt('');
    }
    setPhoto(null);
  }, [open, record]);

  const submit = async () => {
    if (!form.document_name.trim()) return toast.error('Enter the document name');
    if (receiverMode === 'user' && !receiverUserId) return toast.error('Select who is receiving the document');
    if (receiverMode === 'outside' && !receiverName.trim()) return toast.error('Enter the receiver’s name');
    if (hasDeadline && !expectedReturnAt) return toast.error('Pick the expected return time (or turn the toggle off)');
    if (!editing && !photo) return toast.error('Capture the handover photo — it is the proof of this imprest');

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/document-imprest/${record.id}`, {
          site_id: siteId,
          document_name: form.document_name.trim(),
          description: form.description.trim() || null,
          remarks: form.remarks.trim() || null,
          receiver_user_id: receiverMode === 'user' ? receiverUserId : null,
          receiver_name: receiverMode === 'outside' ? receiverName.trim() : null,
          expected_return_at: hasDeadline && expectedReturnAt ? new Date(expectedReturnAt).toISOString() : null,
        });
        toast.success('Record updated');
      } else {
        const fd = new FormData();
        fd.append('site_id', String(siteId));
        fd.append('document_name', form.document_name.trim());
        if (form.description.trim()) fd.append('description', form.description.trim());
        if (form.remarks.trim()) fd.append('remarks', form.remarks.trim());
        if (receiverMode === 'user') fd.append('receiver_user_id', receiverUserId);
        else fd.append('receiver_name', receiverName.trim());
        if (hasDeadline && expectedReturnAt) fd.append('expected_return_at', new Date(expectedReturnAt).toISOString());
        fd.append('photo', photo);
        await api.post('/document-imprest', fd);
        toast.success('Document handover recorded');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${editing ? 'update' : 'record'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="rounded-t-3xl bg-slate-950 px-6 py-5 text-white">
          <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
            {editing ? <Pencil className="h-5 w-5 text-amber-300" /> : <FileBox className="h-5 w-5 text-emerald-300" />}
          </div>
          <DialogTitle className="text-xl text-white">
            {editing ? 'Edit record' : 'Issue document'}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {editing
              ? 'Update the handover details. The proof photo is locked for audit integrity.'
              : 'Capture proof at the time of issue and assign a clear return plan.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-6 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Document name <span className="text-red-500">*</span>
              </Label>
              <Input
                className="h-11 rounded-xl border-slate-200 bg-slate-50"
                placeholder="e.g. Registry file — Plot A-12"
                value={form.document_name}
                onChange={(e) => setForm((f) => ({ ...f, document_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Given to</Label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
                <Tabs value={receiverMode} onValueChange={setReceiverMode} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-lg bg-slate-100 p-1">
                    <TabsTrigger value="user" className="rounded-md text-xs">Team member</TabsTrigger>
                    <TabsTrigger value="outside" className="rounded-md text-xs">Outside person</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {receiverMode === 'user' ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Recipient <span className="text-red-500">*</span>
                </Label>
                <Select value={receiverUserId} onValueChange={setReceiverUserId}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 rounded-xl">
                    {peers.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <div className="w-full flex items-center justify-between">
                          <span className="truncate font-medium text-slate-800">{p.name || p.email}</span>
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{p.role}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!peers.length && (
                  <p className="text-xs text-amber-600">No team members are available for this site yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Recipient full name <span className="text-red-500">*</span>
                </Label>
                <Input
                  className="h-11 rounded-xl border-slate-200 bg-slate-50"
                  placeholder="Enter receiver name"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Description</Label>
            <Textarea
              placeholder="What does this document contain? (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700"><CalendarClock className="mr-1.5 inline h-3.5 w-3.5 text-slate-500" /> Expected return</Label>
                  <p className="text-xs text-slate-500 mt-1">Toggle off for no deadline</p>
                </div>
                <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
              </div>
              {hasDeadline && (
                <Input type="datetime-local" className="h-11 bg-white" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Remarks</Label>
              <Textarea
                className="bg-white"
                rows={3}
                placeholder="Internal note about this handover (optional)"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Handover proof <span className="text-red-500">*</span>
              {editing ? <span className="ml-1 text-slate-500 font-normal">(locked)</span> : null}
            </Label>
            {editing ? (
              record.photo_url && (
                <img
                  src={record.photo_url}
                  alt="Handover proof"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 object-cover"
                  style={{ maxHeight: 220 }}
                />
              )
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <CameraCapture photo={photo} onCapture={setPhoto} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-10 rounded-xl">
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="h-10 gap-1.5 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Save changes' : 'Record handover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Return dialog ────────────────────────────────────────────────────────────
function ReturnDialog({ record, siteId, onOpenChange, onReturned }) {
  const [photo, setPhoto] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [withPhoto, setWithPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('site_id', String(siteId));
      if (withPhoto && photo) fd.append('photo', photo);
      if (remarks.trim()) fd.append('return_remarks', remarks.trim());
      await api.post(`/document-imprest/${record.id}/return`, fd);
      toast.success('Document marked as returned');
      onOpenChange(null);
      onReturned();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark returned');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(v) => { if (!saving && !v) onOpenChange(null); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Undo2 className="h-5 w-5 text-emerald-600" /> Mark Returned</DialogTitle>
          <DialogDescription>
            &ldquo;{record?.document_name}&rdquo; — given to {record ? receiverOf(record) : ''} on {fmtDateTime(record?.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-slate-500" /> Attach return photo</Label>
                <p className="text-xs text-slate-500 mt-0.5">Optional proof of the document coming back</p>
              </div>
              <Switch checked={withPhoto} onCheckedChange={(v) => { setWithPhoto(v); if (!v) setPhoto(null); }} />
            </div>
            {withPhoto && <CameraCapture photo={photo} onCapture={setPhoto} />}
          </div>

          <div className="space-y-1.5">
            <Label>Return remarks</Label>
            <Input placeholder="Condition, notes… (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirm ───────────────────────────────────────────────────────────
function DeleteDialog({ record, siteId, onOpenChange, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    setDeleting(true);
    try {
      await api.delete(`/document-imprest/${record.id}`, { params: { site_id: siteId } });
      toast.success('Record deleted');
      onOpenChange(null);
      onDeleted();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(v) => { if (!deleting && !v) onOpenChange(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Delete Record
          </DialogTitle>
          <DialogDescription>
            This permanently removes &ldquo;{record?.document_name}&rdquo; and its proof photos from the register. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={deleting} className="gap-1.5">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail / proof viewer ────────────────────────────────────────────────────
function DetailDialog({ record, onOpenChange }) {
  const openDoc = useDocViewer();
  if (!record) return null;
  const overdue = isOverdue(record);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onOpenChange(null); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBox className="h-5 w-5 text-indigo-600" /> {record.document_name}
          </DialogTitle>
          <DialogDescription>{record.description || 'No description'}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Handover proof</p>
            {record.photo_url
              ? <button type="button" className="w-full cursor-pointer" onClick={() => openDoc({ url: record.photo_url, title: 'Imprest Photo' })}>
                  <img src={record.photo_url} alt="Handover proof" className="rounded-xl border w-full object-cover max-h-72 hover:opacity-90 transition-opacity" />
                </button>
              : <div className="rounded-xl border p-6 text-center text-slate-400 text-xs">Photo unavailable</div>}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Return proof</p>
            {record.return_photo_url
              ? <button type="button" className="w-full cursor-pointer" onClick={() => openDoc({ url: record.return_photo_url, title: 'Return Photo' })}>
                  <img src={record.return_photo_url} alt="Return proof" className="rounded-xl border w-full object-cover max-h-72 hover:opacity-90 transition-opacity" />
                </button>
              : <div className="rounded-xl border border-dashed p-6 text-center text-slate-400 text-xs">
                  {record.status === 'RETURNED' ? 'No photo attached at return' : 'Not returned yet'}
                </div>}
          </div>
        </div>

        <div className="rounded-xl border divide-y text-sm">
          <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Given to</span><span className="font-medium">{receiverOf(record)}{record.receiver_user_name ? '' : record.receiver_name ? ' (outside)' : ''}</span></div>
          <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Issued by</span><span className="font-medium">{record.issued_by_name || record.issued_by_email || '—'}</span></div>
          <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Issued on</span><span>{fmtDateTime(record.created_at)}</span></div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-slate-500">Expected return</span>
            <span className={overdue ? 'text-red-600 font-semibold' : ''}>{record.expected_return_at ? fmtDateTime(record.expected_return_at) : 'Open-ended'}</span>
          </div>
          {record.status === 'RETURNED' && (
            <>
              <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Returned on</span><span className="text-emerald-700 font-medium">{fmtDateTime(record.returned_at)}</span></div>
              <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Return received by</span><span>{record.return_received_by_name || '—'}</span></div>
              {record.return_remarks && <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Return remarks</span><span>{record.return_remarks}</span></div>}
            </>
          )}
          {record.remarks && <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Remarks</span><span>{record.remarks}</span></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DocumentImprest() {
  const { hasPermission, currentSite } = useAuth();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0, issued: 0, returned: 0, overdue: 0 });
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [returning, setReturning] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const canWrite = hasPermission('document_imprest', 'write');
  const canUpdate = hasPermission('document_imprest', 'update');
  const canDelete = hasPermission('document_imprest', 'delete');

  const fetchRecords = useCallback(async () => {
    if (!currentSite?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/document-imprest?site_id=${currentSite.id}`);
      setRecords(data.records || []);
      setStats(data.stats || { total: 0, issued: 0, returned: 0, overdue: 0 });
    } catch {
      toast.error('Failed to load document imprest register');
    } finally {
      setLoading(false);
    }
  }, [currentSite?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => {
    if (!currentSite?.id || (!canWrite && !canUpdate)) {
      setPeers([]);
      return;
    }
    api.get('/document-imprest/peers', { params: { site_id: currentSite.id } })
      .then(({ data }) => setPeers(data.peers || []))
      .catch(() => setPeers([]));
  }, [currentSite?.id, canWrite, canUpdate]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (tab === 'ISSUED' && r.status !== 'ISSUED') return false;
      if (tab === 'RETURNED' && r.status !== 'RETURNED') return false;
      if (tab === 'OVERDUE' && !isOverdue(r)) return false;
      if (!needle) return true;
      return [r.document_name, r.description, receiverOf(r), r.issued_by_name]
        .some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [records, tab, q]);

  const statCards = [
    { label: 'Out (Issued)', value: stats.issued, icon: <ArchiveRestore className="h-5 w-5" />, tile: 'from-indigo-500 to-blue-600 shadow-indigo-200' },
    { label: 'Overdue', value: stats.overdue, icon: <AlertTriangle className="h-5 w-5" />, tile: 'from-red-500 to-rose-600 shadow-red-200' },
    { label: 'Returned', value: stats.returned, icon: <CheckCircle2 className="h-5 w-5" />, tile: 'from-emerald-500 to-green-600 shadow-emerald-200' },
    { label: 'Total Records', value: stats.total, icon: <FileBox className="h-5 w-5" />, tile: 'from-slate-600 to-slate-800 shadow-slate-200' },
  ];

  const completionRate = stats.total ? Math.round((stats.returned / stats.total) * 100) : 0;
  const overdueRecords = records.filter(isOverdue).slice(0, 3);

  return (
    <div className="mx-auto max-w-[1450px] space-y-5 p-4 pb-8 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-400">Workspace</span><span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-700">Operations</span><span className="text-slate-300">/</span><span>Document imprest</span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live register
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[24px] bg-[#111b3f] px-5 py-6 text-white shadow-[0_24px_70px_-30px_rgba(30,41,90,0.8)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-indigo-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> DOCUMENT CONTROL CENTER
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Keep every handover accountable.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100/75 sm:text-[15px]">
              Track physical documents, capture proof at the point of issue, and close the loop when they come back.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {canWrite && (
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-[#18234c] shadow-lg shadow-black/10 hover:bg-indigo-50">
                  <Plus className="h-4 w-4" /> Issue document
                </Button>
              )}
              <Button variant="ghost" onClick={fetchRecords} className="h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh register
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-medium text-indigo-100/65">Return completion</p><p className="mt-1 text-lg font-semibold">{completionRate}% closed</p></div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/15 text-cyan-200"><Activity className="h-4 w-4" /></div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${completionRate}%` }} /></div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-100/60"><span>{stats.returned} returned</span><span>{stats.issued} currently out</span></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map(({ label, value, icon, tile }) => (
          <Card key={label} className="rounded-2xl border-slate-200/80 bg-white shadow-[0_8px_30px_-24px_rgba(15,23,42,0.5)]">
            <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label === 'Overdue' ? 'Needs follow-up' : label === 'Returned' ? 'Closed handovers' : 'Current register'}</p></div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tile} text-white shadow-md`}>{icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_42px_-30px_rgba(15,23,42,0.5)]">
          <div className="border-b border-slate-100 px-4 pb-0 pt-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex items-center gap-2"><h2 className="text-base font-bold tracking-tight text-slate-950">Document register</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{filtered.length} shown</span></div><p className="mt-1 text-sm text-slate-500">A clear audit trail for every physical handover.</p></div>
              <Button variant="outline" size="sm" className="h-9 rounded-xl border-slate-200 text-slate-600"><Download className="h-3.5 w-3.5" /> Export</Button>
            </div>
            <div className="mt-5 flex gap-5 overflow-x-auto">
              {[
                ['ALL', 'All records', stats.total],
                ['ISSUED', 'Currently out', stats.issued],
                ['OVERDUE', 'Overdue', stats.overdue],
                ['RETURNED', 'Returned', stats.returned],
              ].map(([value, label, count]) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={`relative whitespace-nowrap pb-3 text-xs font-semibold transition-colors ${tab === value ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
                  {label}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === value ? 'bg-indigo-50 text-indigo-600' : value === 'OVERDUE' && count > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                  {tab === value && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-indigo-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:px-6">
            <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="h-9 rounded-xl border-slate-200 bg-white pl-9 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-indigo-200" placeholder="Search document, receiver, issuer…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Button variant="outline" size="sm" onClick={fetchRecords} className="h-9 rounded-xl border-slate-200 bg-white text-slate-600"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync</Button>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading register…</div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100"><FileBox className="h-5 w-5 text-slate-400" /></div><div><p className="text-sm font-semibold text-slate-700">No records{tab !== 'ALL' ? ' in this view' : ' yet'}</p><p className="mt-1 text-xs text-slate-400">{canWrite ? 'Use “Issue document” to record the first handover.' : 'No document handovers are available for this site.'}</p></div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-white"><tr>{['Proof', 'Document', 'Given to', 'Return due', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:px-6">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((r) => {
                      const overdue = isOverdue(r);
                      const hint = dueHint(r);
                      return (
                        <tr key={r.id} className={`cursor-pointer transition-colors ${overdue ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'}`} onClick={() => setViewing(r)}>
                          <td className="px-4 py-3 sm:px-6">{r.photo_url ? <img src={r.photo_url} alt="proof" className="h-10 w-14 rounded-xl border object-cover ring-offset-1 hover:ring-2 hover:ring-indigo-300" /> : <div className="grid h-10 w-14 place-items-center rounded-xl border bg-slate-100"><ImageOff className="h-4 w-4 text-slate-400" /></div>}</td>
                          <td className="max-w-[240px] px-4 py-3 sm:px-6"><p className="truncate font-semibold text-slate-900">{r.document_name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{r.description || `Issued by ${r.issued_by_name || r.issued_by_email || '—'}`}</p></td>
                          <td className="px-4 py-3 sm:px-6"><span className="inline-flex items-center gap-2 whitespace-nowrap"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">{(receiverOf(r)[0] || '?').toUpperCase()}</span><span className="text-slate-700">{receiverOf(r)}</span>{!r.receiver_user_name && r.receiver_name && <Badge variant="outline" className="border-slate-200 px-1.5 py-0 text-[10px] text-slate-500">outside</Badge>}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 sm:px-6">{r.expected_return_at ? <div><span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'font-semibold text-rose-600' : 'font-medium text-slate-600'}`}>{overdue && <AlertTriangle className="h-3.5 w-3.5" />}{fmtDateTime(r.expected_return_at)}</span>{hint && <p className={`text-[10px] ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>{hint}</p>}</div> : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" /> Open-ended</span>}</td>
                          <td className="px-4 py-3 sm:px-6">{r.status === 'RETURNED' ? <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">Returned</Badge> : overdue ? <Badge className="rounded-full border-rose-200 bg-rose-50 text-rose-700" variant="outline">Overdue</Badge> : <Badge className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">Out</Badge>}</td>
                          <td className="px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-end gap-1.5">{canUpdate && r.status === 'ISSUED' && <Button variant="outline" size="sm" className="h-8 gap-1 rounded-lg border-slate-200 text-xs" onClick={() => setReturning(r)}><Undo2 className="h-3.5 w-3.5" /> Return</Button>}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuItem onClick={() => setViewing(r)} className="gap-2"><Eye className="h-4 w-4" /> View details</DropdownMenuItem>{canUpdate && <DropdownMenuItem onClick={() => { setEditing(r); setFormOpen(true); }} className="gap-2"><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>}{canUpdate && r.status === 'ISSUED' && <DropdownMenuItem onClick={() => setReturning(r)} className="gap-2"><Undo2 className="h-4 w-4" /> Mark returned</DropdownMenuItem>}{canDelete && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setDeleting(r)} className="gap-2 text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          {!loading && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-400 sm:px-6"><span>Showing {filtered.length} of {records.length} records</span><button type="button" className="inline-flex items-center gap-1 font-semibold text-indigo-600">Open audit trail <ArrowUpRight className="h-3 w-3" /></button></div>}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_42px_-30px_rgba(15,23,42,0.5)]">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Attention needed</h3><p className="mt-1 text-xs text-slate-400">Handover deadlines that need action</p></div><span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600"><BellRing className="h-4 w-4" /></span></div>
            <div className="mt-4 space-y-2.5">{overdueRecords.length > 0 ? overdueRecords.map((r) => <div key={`${r.id}-alert`} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{r.document_name}</p><p className="mt-1 truncate text-[11px] text-slate-500">With {receiverOf(r)}</p></div><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-rose-600">Overdue</span></div><div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>{r.issued_by_name || r.issued_by_email || '—'}</span><span>{dueHint(r)}</span></div></div>) : <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">All document handovers are within their return window.</div>}</div>
            <button type="button" onClick={() => setTab('OVERDUE')} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">Review overdue items <ArrowUpRight className="h-3 w-3" /></button>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_42px_-30px_rgba(15,23,42,0.5)]">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Register health</h3><p className="mt-1 text-xs text-slate-400">Current site activity</p></div><Info className="h-4 w-4 text-slate-300" /></div>
            <div className="mt-5 space-y-4"><div><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Return completion</span><span className="font-bold text-slate-800">{completionRate}%</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%` }} /></div></div><div><div className="flex items-center justify-between text-xs"><span className="text-slate-500">Proof coverage</span><span className="font-bold text-slate-800">{records.length ? Math.round((records.filter((r) => r.photo_url).length / records.length) * 100) : 0}%</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${records.length ? Math.round((records.filter((r) => r.photo_url).length / records.length) * 100) : 0}%` }} /></div></div></div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><FileCheck2 className="h-4 w-4 text-indigo-500" /><span><strong className="text-slate-700">Camera-backed register.</strong> Every issue can be verified later.</span></div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 shadow-[0_12px_42px_-30px_rgba(15,23,42,0.5)]"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><TimerReset className="h-4 w-4" /></div><div><h3 className="text-sm font-bold text-slate-900">Close the loop faster</h3><p className="mt-1 text-xs leading-5 text-slate-500">Issue with a deadline so owners always know what comes next.</p></div></div>{canWrite && <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-4 h-9 w-full rounded-xl bg-indigo-600 text-xs hover:bg-indigo-700"><Plus className="h-3.5 w-3.5" /> Record a handover</Button>}</section>
        </aside>
      </div>

      <RecordFormDialog
        open={formOpen && (editing ? canUpdate : canWrite)}
        record={editing}
        peers={peers}
        siteId={currentSite?.id}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        onSaved={fetchRecords}
      />
      <ReturnDialog record={canUpdate ? returning : null} siteId={currentSite?.id} onOpenChange={setReturning} onReturned={fetchRecords} />
      <DeleteDialog record={canDelete ? deleting : null} siteId={currentSite?.id} onOpenChange={setDeleting} onDeleted={fetchRecords} />
      <DetailDialog record={viewing} onOpenChange={setViewing} />
    </div>
  );
}
