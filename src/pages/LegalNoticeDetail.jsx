import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Check, ExternalLink, FileText, Loader2, Send, ShieldAlert, Upload, X,
} from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { fmtDate, labelize, money, RISK_STYLE, STATUS_STYLE } from '../components/compliance/complianceUi';
import {
  ComplianceDetailHeader, ComplianceField as Field, ComplianceSurface as Panel,
} from '../components/compliance/ComplianceWorkspace';

const NEXT = {
  RECEIVED: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['REPLY_DRAFTING', 'CLOSED'],
  REPLY_DRAFTING: ['UNDER_REVIEW', 'APPROVAL_PENDING'],
  APPROVAL_PENDING: ['REPLY_DRAFTING'],
  REPLY_SUBMITTED: ['CLOSED'],
};
const Pill = ({ value, styles = STATUS_STYLE }) => <Badge variant="outline" className={cn('rounded-full px-2.5 text-[10px] font-semibold', styles[value] || 'border-slate-200 bg-slate-50 text-slate-600')}>{labelize(value)}</Badge>;

export default function LegalNoticeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reply, setReply] = useState({ draft_reply: '', final_reply: '', submission_proof: '', dispatch_details: '', courier_tracking: '', reason: '' });
  const [status, setStatus] = useState({ status: '', comment: '' });
  const [upload, setUpload] = useState({ file: null, title: '', category: 'NOTICE', confidentiality: 'CONFIDENTIAL' });
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data: result } = await api.get(`/compliance/notices/${id}`); setData(result); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not load notice'); navigate('/legal/notices'); }
    finally { setLoading(false); }
  }, [id, navigate]);
  useEffect(() => { load(); }, [load]);
  const notice = data?.notice;
  const canWrite = hasPermission('legal', 'write');
  const canUpdate = hasPermission('legal', 'update');

  const saveReply = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.patch(`/compliance/notices/${id}`, reply); toast.success('Reply work saved'); setReplyOpen(false); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Reply could not be saved'); }
    finally { setBusy(false); }
  };
  const changeStatus = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const { data: result } = await api.post(`/compliance/notices/${id}/status`, status);
      toast.success(result.approval ? 'Legal reply submitted for approval' : 'Notice status updated');
      setStatusOpen(false); setStatus({ status: '', comment: '' }); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Status could not be updated'); }
    finally { setBusy(false); }
  };
  const review = async (approvalId, decision) => {
    try { await api.post(`/compliance/legal-approvals/${approvalId}/review`, { decision, comment: `${labelize(decision)} by ${user?.name || 'reviewer'}` }); toast.success('Reply approval reviewed'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Approval could not be reviewed'); }
  };
  const uploadDocument = async (event) => {
    event.preventDefault();
    if (!upload.file) return toast.error('Select a document');
    setBusy(true);
    try {
      const body = new FormData(); Object.entries(upload).forEach(([key, value]) => { if (value) body.append(key, value); });
      await api.post(`/compliance-documents/LEGAL_NOTICE/${id}`, body);
      toast.success('Notice evidence uploaded'); setUploadOpen(false);
      setUpload({ file: null, title: '', category: 'NOTICE', confidentiality: 'CONFIDENTIAL' }); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Document upload failed'); }
    finally { setBusy(false); }
  };
  const openDocument = async (documentId) => {
    try { const { data: result } = await api.get(`/compliance-documents/file/${documentId}`); const previewUrl = result.document?.file_url || result.document?.content_url; if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer'); }
    catch (error) { toast.error(error.response?.data?.message || 'Document access denied'); }
  };

  if (loading || !notice) return <div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-48 rounded-[26px]" /><Skeleton className="h-[480px] rounded-[22px]" /></div>;
  const overdue = notice.reply_due_date && new Date(notice.reply_due_date) < new Date() && !['REPLY_SUBMITTED', 'CLOSED'].includes(notice.status);
  return <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
    <ComplianceDetailHeader backTo="/legal/notices" backLabel="Back to notices" eyebrow={notice.notice_number || `NOTICE-${notice.id}`} title={notice.subject} description={`${labelize(notice.notice_type)} · ${labelize(notice.direction)} · reply due ${fmtDate(notice.reply_due_date)}`} icon={ShieldAlert} accent="rose" badges={<><Pill value={notice.status} /><Pill value={notice.risk_level} styles={RISK_STYLE} /></>} actions={<>{canUpdate && <Button variant="outline" onClick={() => { setReply({ draft_reply: notice.draft_reply || '', final_reply: notice.final_reply || '', submission_proof: notice.submission_proof || '', dispatch_details: notice.dispatch_details || '', courier_tracking: notice.courier_tracking || '', reason: 'Reply work updated' }); setReplyOpen(true); }}><FileText className="mr-2 h-4 w-4" />Edit reply</Button>}{canUpdate && (NEXT[notice.status] || []).length > 0 && <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setStatusOpen(true)}><Send className="mr-2 h-4 w-4" />Move workflow</Button>}</>} />
    {overdue && <div className="flex gap-3 border-y border-red-200 bg-red-50 px-4 py-3 text-red-800"><ShieldAlert className="h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Reply deadline is overdue</p><p className="mt-1 text-xs">This notice remains in escalation until submitted or closed.</p></div></div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_330px]"><Panel><Tabs defaultValue="overview"><div className="overflow-x-auto border-b px-4 pt-3"><TabsList className="h-11 bg-transparent"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="reply">Reply workspace</TabsTrigger><TabsTrigger value="documents">Documents ({data.documents.length})</TabsTrigger><TabsTrigger value="approvals">Approvals ({data.approvals.length})</TabsTrigger></TabsList></div>
      <TabsContent value="overview" className="m-0 p-5"><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"><Field label="Sender" value={notice.sender} /><Field label="Recipient" value={notice.recipient} /><Field label="Notice date" value={fmtDate(notice.notice_date)} /><Field label="Date received" value={fmtDate(notice.date_received)} /><Field label="Reply due" value={fmtDate(notice.reply_due_date)} /><Field label="Amount involved" value={money(notice.amount_involved)} /><Field label="Advocate" value={notice.advocate} /><Field label="Courier tracking" value={notice.courier_tracking} /></div><div className="mt-7 border-l-2 border-rose-300 bg-slate-50 px-4 py-3"><Field label="Summary" value={notice.summary} /></div></TabsContent>
      <TabsContent value="reply" className="m-0 p-5"><div className="space-y-5"><Field label="Draft reply" value={notice.draft_reply} /><Field label="Final reply" value={notice.final_reply} /><Field label="Submission proof" value={notice.submission_proof} /><Field label="Dispatch details" value={notice.dispatch_details} /></div></TabsContent>
      <TabsContent value="documents" className="m-0"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-sm font-bold">Notice attachments & proof</h2><p className="mt-1 text-xs text-slate-500">Private, OCR-indexed and download-audited.</p></div>{canWrite && <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4" />Upload</Button>}</div>{data.documents.length ? <div className="divide-y divide-slate-100">{data.documents.map((row) => <button key={row.id} type="button" onClick={() => openDocument(row.id)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-rose-50/40"><FileText className="h-4 w-4 text-rose-600" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{row.title}</p><p className="mt-1 text-[10px] text-slate-400">{labelize(row.category)} · v{row.version_no}</p></div><ExternalLink className="h-3.5 w-3.5 text-slate-400" /></button>)}</div> : <p className="p-10 text-center text-xs text-slate-500">No notice documents uploaded.</p>}</TabsContent>
      <TabsContent value="approvals" className="m-0 p-5"><div className="space-y-3">{data.approvals.length ? data.approvals.map((row) => <div key={row.id} className="rounded-2xl border p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex gap-2"><Pill value={row.status} /><p className="text-xs font-bold">{labelize(row.action_type)}</p></div><p className="mt-2 text-[10px] text-slate-500">{row.request_comment || 'No request comment'} · {row.requested_by_name || 'Unknown requester'}</p></div>{canUpdate && row.status === 'PENDING' && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => review(row.id, 'RETURN')}><X className="mr-1 h-3.5 w-3.5" />Return</Button><Button size="sm" onClick={() => review(row.id, 'APPROVE')}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button></div>}</div></div>) : <p className="p-10 text-center text-xs text-slate-500">No reply approvals.</p>}</div></TabsContent>
    </Tabs></Panel><aside><Panel className="p-5"><h2 className="text-xs font-bold">Reply control</h2><div className="mt-4 space-y-4"><Field label="Current status" value={labelize(notice.status)} /><Field label="Deadline" value={fmtDate(notice.reply_due_date)} /><Field label="Risk" value={labelize(notice.risk_level)} /><Field label="Review manager" value={notice.reviewing_manager_id ? `User #${notice.reviewing_manager_id}` : 'Not assigned'} /></div></Panel></aside></div>
    <Dialog open={replyOpen} onOpenChange={setReplyOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Reply workspace</DialogTitle><DialogDescription>Save drafting, final reply, submission proof and dispatch details before moving the workflow.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={saveReply}><div><Label>Draft reply</Label><Textarea className="mt-1.5 min-h-28" value={reply.draft_reply} onChange={(event) => setReply({ ...reply, draft_reply: event.target.value })} /></div><div><Label>Final reply</Label><Textarea className="mt-1.5" value={reply.final_reply} onChange={(event) => setReply({ ...reply, final_reply: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Submission proof reference</Label><Input className="mt-1.5" value={reply.submission_proof} onChange={(event) => setReply({ ...reply, submission_proof: event.target.value })} /></div><div><Label>Courier / tracking</Label><Input className="mt-1.5" value={reply.courier_tracking} onChange={(event) => setReply({ ...reply, courier_tracking: event.target.value })} /></div></div><div><Label>Dispatch details</Label><Textarea className="mt-1.5" value={reply.dispatch_details} onChange={(event) => setReply({ ...reply, dispatch_details: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save reply</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent><DialogHeader><DialogTitle>Move notice workflow</DialogTitle><DialogDescription>Reply submission requires approval for non-administrator users.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={changeStatus}><div><Label>Next status</Label><select className="mt-1.5 h-10 w-full rounded-xl border px-3 text-sm" value={status.status} onChange={(event) => setStatus({ ...status, status: event.target.value })}><option value="">Choose status</option>{(NEXT[notice.status] || []).map((value) => <option key={value} value={value}>{labelize(value)}</option>)}</select></div><div><Label>Comment</Label><Textarea className="mt-1.5" value={status.comment} onChange={(event) => setStatus({ ...status, comment: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button><Button disabled={busy || !status.status}>Move status</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent><DialogHeader><DialogTitle>Upload notice document</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={uploadDocument}><div><Label>File</Label><Input className="mt-1.5" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} /></div><div><Label>Title</Label><Input className="mt-1.5" value={upload.title} onChange={(event) => setUpload({ ...upload, title: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button><Button disabled={busy}>Upload</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
