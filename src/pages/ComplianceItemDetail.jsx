import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, CheckCircle2, ClipboardCheck,
  Download, ExternalLink, FilePlus2, FileText, History, IndianRupee, ListChecks,
  Loader2, Paperclip, PencilLine, Plus, RefreshCw, RotateCcw, ShieldCheck, Upload,
  UserRound, X,
} from 'lucide-react';
import {
  fmtDate, labelize, money, RISK_STYLE, STATUS_OPTIONS, STATUS_STYLE,
} from '../components/compliance/complianceUi';

const Pill = ({ value, styles }) => <Badge variant="outline" className={cn('rounded-full px-2.5 text-[10px] font-semibold', styles[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>{labelize(value)}</Badge>;
const Panel = ({ children, className }) => <section className={cn('rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,.45)]', className)}>{children}</section>;
const Field = ({ label, value, children }) => <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><div className="mt-1.5 text-sm font-medium text-slate-800">{children || value || '—'}</div></div>;

export default function ComplianceItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', comment: '', override_reason: '' });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedule, setReschedule] = useState({ new_due_date: '', reason: '' });
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkForm, setCheckForm] = useState({ title: '', description: '', is_mandatory: true, due_date: '' });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ file: null, title: '', category: 'SUBMISSION_PROOF', confidentiality: 'INTERNAL', issue_date: '', expiry_date: '' });
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeForm, setFinanceForm] = useState({ expense_id: '', cost_type: 'COMPLIANCE_FEE', notes: '' });
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data: result } = await api.get(`/compliance/items/${id}`); setData(result); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not load compliance item'); navigate('/compliance/register'); }
    finally { setLoading(false); }
  }, [id, navigate]);
  useEffect(() => { load(); }, [load]);
  const item = data?.item;
  const canWrite = hasPermission('compliance', 'write');
  const canUpdate = hasPermission('compliance', 'update');
  const canAdmin = hasPermission('compliance_settings', 'update');
  const pendingMandatory = useMemo(() => (data?.checklist || []).filter((row) => row.is_mandatory && row.status !== 'COMPLETED').length, [data]);

  const changeStatus = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data: result } = await api.post(`/compliance/items/${id}/status`, statusForm);
      toast.success(result.approval ? 'Completion submitted for approval' : 'Status updated');
      setStatusOpen(false); setStatusForm({ status: '', comment: '', override_reason: '' }); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Status could not be changed'); }
    finally { setBusy(false); }
  };
  const submitReschedule = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data: result } = await api.post(`/compliance/items/${id}/reschedule`, reschedule);
      toast.success(result.pending_approval ? 'Due-date change sent for approval' : 'Due date changed');
      setRescheduleOpen(false); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Due date could not be changed'); }
    finally { setBusy(false); }
  };
  const addChecklist = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post(`/compliance/items/${id}/checklist`, checkForm); toast.success('Checklist item added'); setCheckOpen(false); setCheckForm({ title: '', description: '', is_mandatory: true, due_date: '' }); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Checklist item could not be added'); }
    finally { setBusy(false); }
  };
  const toggleChecklist = async (row) => {
    try { await api.patch(`/compliance/items/${id}/checklist/${row.id}`, { status: row.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' }); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Checklist could not be updated'); }
  };
  const uploadDocument = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) return toast.error('Select a document');
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(uploadForm).forEach(([key, value]) => { if (value) body.append(key, value); });
      await api.post(`/compliance-documents/COMPLIANCE/${id}`, body);
      toast.success('Evidence uploaded and queued for OCR'); setUploadOpen(false);
      setUploadForm({ file: null, title: '', category: 'SUBMISSION_PROOF', confidentiality: 'INTERNAL', issue_date: '', expiry_date: '' }); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Document upload failed'); }
    finally { setBusy(false); }
  };
  const openDocument = async (documentId) => {
    try { const { data: result } = await api.get(`/compliance-documents/file/${documentId}`); if (result.document.file_url) window.open(result.document.file_url, '_blank', 'noopener,noreferrer'); else toast.error('Preview URL is unavailable'); }
    catch (error) { toast.error(error.response?.data?.message || 'Document access denied'); }
  };
  const reviewDate = async (changeId, decision) => {
    try { await api.post(`/compliance/due-date-changes/${changeId}/review`, { decision, comment: `${decision} by ${user?.name || 'administrator'}` }); toast.success(`Date change ${decision.toLowerCase()}`); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not review date change'); }
  };
  const reviewApproval = async (approvalId, decision) => {
    try { await api.post(`/compliance/approvals/${approvalId}/review`, { decision, comment: `${labelize(decision)} by ${user?.name || 'administrator'}` }); toast.success('Approval reviewed'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not review approval'); }
  };
  const linkExpense = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await api.post(`/compliance/items/${id}/finance-links`, financeForm);
      toast.success('Existing expense linked without creating a duplicate entry');
      setFinanceOpen(false); setFinanceForm({ expense_id: '', cost_type: 'COMPLIANCE_FEE', notes: '' }); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Expense could not be linked'); }
    finally { setBusy(false); }
  };

  if (loading || !item) return <div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-44 rounded-[24px]"/><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96 rounded-[22px] lg:col-span-2"/><Skeleton className="h-96 rounded-[22px]"/></div></div>;
  const overdue = item.current_due_date && new Date(item.current_due_date) < new Date() && !['COMPLETED','CANCELLED','NOT_APPLICABLE'].includes(item.status);
  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
    <header className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 px-5 py-6 text-white sm:px-7">
      <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative"><Link to="/compliance/register" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"><ArrowLeft className="h-3.5 w-3.5"/>Back to register</Link><div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex flex-wrap items-center gap-2">{Pill({ value: item.status, styles: STATUS_STYLE })}{Pill({ value: item.risk_level, styles: RISK_STYLE })}<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.compliance_code}</span></div><h1 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl">{item.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{item.description || labelize(item.compliance_type)}</p></div><div className="flex flex-wrap gap-2">{canUpdate && <><Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => { setReschedule({ new_due_date: item.current_due_date?.slice(0,10) || '', reason: '' }); setRescheduleOpen(true); }}><CalendarClock className="mr-2 h-4 w-4"/>Reschedule</Button><Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => { setStatusForm({ status: '', comment: '', override_reason: '' }); setStatusOpen(true); }}><RefreshCw className="mr-2 h-4 w-4"/>Change status</Button></>}</div></div></div>
    </header>
    {overdue && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="text-sm font-bold">This obligation is overdue</p><p className="mt-1 text-xs">The original deadline remains in the audit trail. Use the controlled reschedule workflow if the authority granted more time.</p></div></div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <Panel className="overflow-hidden">
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto border-b border-slate-100 px-4 pt-3"><TabsList className="h-11 bg-transparent"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="checklist">Checklist ({data.checklist.length})</TabsTrigger><TabsTrigger value="evidence">Evidence ({data.documents.length})</TabsTrigger><TabsTrigger value="finance">Finance ({data.finance_links?.length || 0})</TabsTrigger><TabsTrigger value="history">Timeline ({data.history.length})</TabsTrigger><TabsTrigger value="approvals">Approvals</TabsTrigger></TabsList></div>
          <TabsContent value="overview" className="m-0 p-5"><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"><Field label="Compliance type" value={labelize(item.compliance_type)}/><Field label="Category" value={labelize(item.category)}/><Field label="Frequency" value={labelize(item.frequency)}/><Field label="Original due date" value={fmtDate(item.original_due_date)}/><Field label="Current due date"><span className={overdue ? 'text-red-600' : ''}>{fmtDate(item.current_due_date)}</span></Field><Field label="Grace period" value={`${item.grace_period_days || 0} days`}/><Field label="Responsible employee" value={item.assigned_to || 'Unassigned'}/><Field label="Relevant law" value={item.applicable_law}/><Field label="Section / reference" value={item.section_reference}/><Field label="Financial impact" value={money(item.financial_impact)}/><Field label="Priority" value={labelize(item.priority)}/><Field label="Approval required" value={item.approval_required ? 'Yes' : 'No'}/></div>{item.notes && <div className="mt-7 rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Internal notes</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">{item.notes}</p></div>}<div className="mt-6 flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/expenses')}><IndianRupee className="mr-2 h-4 w-4"/>Record fee or penalty</Button></div></TabsContent>
          <TabsContent value="checklist" className="m-0"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold">Completion checklist</h2><p className="mt-1 text-xs text-slate-500">Mandatory items block final completion unless an administrator records an override.</p></div>{canWrite && <Button size="sm" className="rounded-xl" onClick={() => setCheckOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>Add task</Button>}</div>{data.checklist.length ? <div className="divide-y">{data.checklist.map((row) => <div key={row.id} className="flex items-start gap-3 p-4"><Checkbox checked={row.status === 'COMPLETED'} disabled={!canUpdate} onCheckedChange={() => toggleChecklist(row)} className="mt-0.5"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={cn('text-xs font-semibold', row.status === 'COMPLETED' && 'text-slate-400 line-through')}>{row.title}</p>{row.is_mandatory && <Badge variant="outline" className="border-red-200 bg-red-50 text-[9px] text-red-600">Required</Badge>}</div><p className="mt-1 text-[10px] text-slate-400">{row.description || 'No description'} {row.due_date ? `· due ${fmtDate(row.due_date)}` : ''}</p></div>{row.completed_by_name && <span className="text-[10px] text-emerald-600">Completed by {row.completed_by_name}</span>}</div>)}</div> : <div className="p-10 text-center text-xs text-slate-500">No checklist items have been added.</div>}</TabsContent>
          <TabsContent value="evidence" className="m-0"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold">Documents & evidence</h2><p className="mt-1 text-xs text-slate-500">Private signed URLs, version history and OCR indexing.</p></div>{canWrite && <Button size="sm" className="rounded-xl" onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4"/>Upload evidence</Button>}</div>{data.documents.length ? <div className="grid gap-3 p-5 sm:grid-cols-2">{data.documents.map((row) => <button type="button" key={row.id} onClick={() => openDocument(row.id)} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileText className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{row.title}</p><p className="mt-1 text-[10px] text-slate-400">v{row.version_no} · {labelize(row.category)} · {labelize(row.confidentiality)}</p><p className="mt-1 text-[10px] text-slate-400">{row.expiry_date ? `Expires ${fmtDate(row.expiry_date)}` : fmtDate(row.created_at)}</p></div><ExternalLink className="h-3.5 w-3.5 text-slate-400"/></button>)}</div> : <div className="p-10 text-center text-xs text-slate-500">No supporting evidence uploaded.</div>}</TabsContent>
          <TabsContent value="finance" className="m-0"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold">Linked accounting expenses</h2><p className="mt-1 text-xs text-slate-500">References existing expense records; no financial entry is duplicated.</p></div>{canUpdate && <Button size="sm" onClick={() => setFinanceOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>Link expense</Button>}</div>{data.finance_links?.length ? <div className="divide-y">{data.finance_links.map((row) => <div key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-semibold">{labelize(row.cost_type)} · Expense #{row.expense_id}</p><p className="mt-1 text-[10px] text-slate-400">{row.category || 'Uncategorised'} · {fmtDate(row.date)} · {row.remark || row.notes || 'No notes'}</p></div><p className="text-sm font-bold">{money(Number(row.debit || 0) || Number(row.credit || 0))}</p></div>)}</div> : <div className="p-10 text-center text-xs text-slate-500">No finance records linked.</div>}</TabsContent>
          <TabsContent value="history" className="m-0 p-5">{data.history.length ? <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-slate-200">{data.history.map((row) => <div key={row.id} className="relative flex gap-4"><span className="relative z-10 mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-4 border-white bg-blue-500 shadow-sm"/><div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{labelize(row.previous_status)} → {labelize(row.new_status)}</p><p className="text-[10px] text-slate-400">{fmtDate(row.changed_at, true)}</p></div><p className="mt-1 text-[10px] text-slate-500">{row.changed_by_name || 'System'}{row.comment ? ` · ${row.comment}` : ''}</p></div></div>)}</div> : <p className="text-xs text-slate-500">No status history.</p>}</TabsContent>
          <TabsContent value="approvals" className="m-0 p-5"><div className="space-y-5">{data.due_date_changes.filter((row) => row.status === 'PENDING').map((row) => <div key={`date-${row.id}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="text-xs font-bold text-amber-900">Due-date change awaiting review</p><p className="mt-1 text-xs text-amber-800">{fmtDate(row.old_due_date)} → {fmtDate(row.new_due_date)}</p><p className="mt-1 text-[10px] text-amber-700">{row.reason} · requested by {row.requested_by_name}</p></div>{canAdmin && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => reviewDate(row.id, 'REJECTED')}><X className="mr-1 h-3.5 w-3.5"/>Reject</Button><Button size="sm" onClick={() => reviewDate(row.id, 'APPROVED')}><Check className="mr-1 h-3.5 w-3.5"/>Approve</Button></div>}</div></div>)}{data.approvals.filter((row) => row.status === 'PENDING').map((row) => <div key={`approval-${row.id}`} className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="text-xs font-bold text-blue-900">{labelize(row.action_type)} awaiting approval</p><p className="mt-1 text-[10px] text-blue-700">{row.request_comment || 'No comment'} · requested by {row.requested_by_name}</p></div>{canAdmin && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => reviewApproval(row.id, 'RETURN')}>Return</Button><Button size="sm" variant="outline" onClick={() => reviewApproval(row.id, 'REJECT')}>Reject</Button><Button size="sm" onClick={() => reviewApproval(row.id, 'APPROVE')}>Approve</Button></div>}</div></div>)}{!data.due_date_changes.some((row) => row.status === 'PENDING') && !data.approvals.some((row) => row.status === 'PENDING') && <div className="p-10 text-center text-xs text-slate-500">No approvals are awaiting action.</div>}</div></TabsContent>
        </Tabs>
      </Panel>
      <div className="space-y-4"><Panel className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-900">Completion</p><span className="text-lg font-bold text-blue-700">{item.completion_percentage}%</span></div><Progress value={item.completion_percentage} className="mt-3 h-2"/><p className="mt-3 text-[10px] leading-4 text-slate-500">{pendingMandatory ? `${pendingMandatory} mandatory checklist item(s) remain.` : 'All mandatory checklist items are complete.'}</p></Panel><Panel className="p-5"><h2 className="text-xs font-bold text-slate-900">Responsibility</h2><div className="mt-4 space-y-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserRound className="h-4 w-4"/></span><div><p className="text-[10px] text-slate-400">Primary owner</p><p className="text-xs font-semibold text-slate-700">{item.assigned_to_name || 'Unassigned'}</p></div></div><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck className="h-4 w-4"/></span><div><p className="text-[10px] text-slate-400">Reviewer / approver</p><p className="text-xs font-semibold text-slate-700">{item.reviewer_name || item.approver_name || 'Not assigned'}</p></div></div></div></Panel><Panel className="p-5"><h2 className="text-xs font-bold text-slate-900">Reminder schedule</h2><div className="mt-3 flex flex-wrap gap-1.5">{(item.reminder_days || []).map((day) => <Badge key={day} variant="outline" className="rounded-full text-[9px]">{day === 0 ? 'Due day' : `${day}d before`}</Badge>)}</div></Panel></div>
    </div>
    <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent><DialogHeader><DialogTitle>Change compliance status</DialogTitle><DialogDescription>Only configured workflow transitions are accepted. Every change is written to the timeline.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={changeStatus}><div><Label>New status</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}><option value="">Choose status</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></div><div><Label>Comment</Label><Textarea className="mt-1.5" value={statusForm.comment} onChange={(e) => setStatusForm({ ...statusForm, comment: e.target.value })}/></div>{statusForm.status === 'COMPLETED' && pendingMandatory > 0 && canAdmin && <div><Label>Mandatory checklist override reason</Label><Textarea className="mt-1.5" value={statusForm.override_reason} onChange={(e) => setStatusForm({ ...statusForm, override_reason: e.target.value })}/></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button><Button disabled={busy || !statusForm.status}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Change status</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}><DialogContent><DialogHeader><DialogTitle>Request due-date change</DialogTitle><DialogDescription>The old date, new date, reason, requester and reviewer are preserved.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitReschedule}><div><Label>New due date</Label><Input className="mt-1.5" type="date" value={reschedule.new_due_date} onChange={(e) => setReschedule({ ...reschedule, new_due_date: e.target.value })}/></div><div><Label>Reason</Label><Textarea className="mt-1.5" value={reschedule.reason} onChange={(e) => setReschedule({ ...reschedule, reason: e.target.value })}/></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button><Button disabled={busy || !reschedule.reason.trim()}>Submit change</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={checkOpen} onOpenChange={setCheckOpen}><DialogContent><DialogHeader><DialogTitle>Add checklist task</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={addChecklist}><div><Label>Task title</Label><Input className="mt-1.5" value={checkForm.title} onChange={(e) => setCheckForm({ ...checkForm, title: e.target.value })}/></div><div><Label>Description</Label><Textarea className="mt-1.5" value={checkForm.description} onChange={(e) => setCheckForm({ ...checkForm, description: e.target.value })}/></div><div><Label>Due date</Label><Input className="mt-1.5" type="date" value={checkForm.due_date} onChange={(e) => setCheckForm({ ...checkForm, due_date: e.target.value })}/></div><label className="flex items-center gap-2 text-xs"><Checkbox checked={checkForm.is_mandatory} onCheckedChange={(value) => setCheckForm({ ...checkForm, is_mandatory: value })}/>Mandatory for completion</label><DialogFooter><Button type="button" variant="outline" onClick={() => setCheckOpen(false)}>Cancel</Button><Button disabled={busy}>Add task</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent><DialogHeader><DialogTitle>Upload compliance evidence</DialogTitle><DialogDescription>PDF, Word or image up to 25 MB. Files remain private and OCR runs in the background.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={uploadDocument}><div><Label>File</Label><Input className="mt-1.5" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}/></div><div><Label>Document title</Label><Input className="mt-1.5" value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Category</Label><Input className="mt-1.5" value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}/></div><div><Label>Confidentiality</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={uploadForm.confidentiality} onChange={(e) => setUploadForm({ ...uploadForm, confidentiality: e.target.value })}><option>INTERNAL</option><option>CONFIDENTIAL</option><option>RESTRICTED</option></select></div><div><Label>Issue date</Label><Input className="mt-1.5" type="date" value={uploadForm.issue_date} onChange={(e) => setUploadForm({ ...uploadForm, issue_date: e.target.value })}/></div><div><Label>Expiry date</Label><Input className="mt-1.5" type="date" value={uploadForm.expiry_date} onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}/></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload evidence</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={financeOpen} onOpenChange={setFinanceOpen}><DialogContent><DialogHeader><DialogTitle>Link an existing expense</DialogTitle><DialogDescription>Use the expense ID from the accounting module. This creates only a reference and never posts a second ledger entry.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={linkExpense}><div><Label>Expense ID</Label><Input className="mt-1.5" type="number" min="1" value={financeForm.expense_id} onChange={(e) => setFinanceForm({ ...financeForm, expense_id: e.target.value })}/></div><div><Label>Cost type</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={financeForm.cost_type} onChange={(e) => setFinanceForm({ ...financeForm, cost_type: e.target.value })}><option>COMPLIANCE_FEE</option><option>RENEWAL_FEE</option><option>PENALTY</option><option>ADVOCATE_FEE</option><option>COURT_FEE</option><option>CONSULTANT_FEE</option><option>SECURITY_DEPOSIT</option><option>SETTLEMENT</option></select></div><div><Label>Notes</Label><Textarea className="mt-1.5" value={financeForm.notes} onChange={(e) => setFinanceForm({ ...financeForm, notes: e.target.value })}/></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFinanceOpen(false)}>Cancel</Button><Button disabled={busy || !financeForm.expense_id}>Link expense</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
